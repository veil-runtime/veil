import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function safeError(result) {
  const message = `${result.stderr || ''} ${result.error?.message || ''}`;
  if (/EAI_AGAIN|ENOTFOUND|Could not resolve host/i.test(message)) return 'DNS unavailable';
  if (/ETIMEDOUT|timed out/i.test(message)) return 'timeout';
  if (/EPERM|operation not permitted/i.test(message)) return 'subprocess denied';
  if (/EACCES|permission denied/i.test(message)) return 'permission denied';
  return `exit ${result.status ?? 'unknown'}`;
}
export function command(bin, args, cwd, timeout = 15000) {
  const result = spawnSync(bin, args, { cwd, encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', NPM_CONFIG_FETCH_RETRIES: '0', NPM_CONFIG_FETCH_TIMEOUT: '10000' } });
  if (result.status !== 0) throw new Error(`${bin} ${args[0]} failed: ${safeError(result)}`);
  return result.stdout.trim();
}
export function safeFile(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..') || relative.includes('\\')) throw new Error('unsafe path');
  const base = fs.realpathSync(root);
  let cursor = base;
  for (const part of relative.split('/')) {
    cursor = path.join(cursor, part);
    try { if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error('symlink path'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const target = path.resolve(base, relative);
  if (!target.startsWith(base + path.sep)) throw new Error('path escape');
  return target;
}
export function parseNpm(raw, name) {
  const data = JSON.parse(raw);
  const latest = data['dist-tags']?.latest;
  const published = data.versions?.[latest];
  if (!latest || !published || published.name !== name || !published.dist?.integrity || !published.dist?.tarball) throw new Error(`incomplete npm metadata: ${name}`);
  return { name, latest, integrity: published.dist.integrity, tarball: published.dist.tarball, shasum: published.dist.shasum || null, peerDependencies: published.peerDependencies || {}, peerDependenciesMeta: published.peerDependenciesMeta || {} };
}
export function parseGithub(raw) {
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries)) throw new Error('invalid GitHub releases');
  return entries.map(x => ({ tag: x.tagName, name: x.name, publishedAt: x.publishedAt, draft: !!x.isDraft })).sort((a,b) => a.tag.localeCompare(b.tag));
}
function remoteMain(root) {
  const line = command('git',['ls-remote','origin','refs/heads/main'],root);
  const match = line.match(/^([0-9a-f]{40})\s+refs\/heads\/main$/);
  if (!match) throw new Error('remote main unavailable');
  return match[1];
}
export function verifyArtifact(pkg, cwd) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'veil-steward-pack-'));
  try {
    const filename = command('npm',['pack',`${pkg.name}@${pkg.latest}`,'--pack-destination',dir,'--ignore-scripts','--silent'],cwd,30000).split('\n').at(-1);
    const bytes = fs.readFileSync(safeFile(dir,filename));
    const integrity = 'sha512-' + crypto.createHash('sha512').update(bytes).digest('base64');
    if (integrity !== pkg.integrity) throw new Error(`published artifact integrity mismatch: ${pkg.name}@${pkg.latest}`);
    return { sha256:sha(bytes), integrityVerified:true, bytes:bytes.length };
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
}
const maintained = { core: ['README.md','docs/index.html','docs/ecosystem.md','docs/ui.md','docs/getting-started/evaluate.md','docs/getting-started/installation.md','docs/contributing/releases.md'], ui: ['packages/ui/README.md','packages/ui/CHANGELOG.md'] };
export function inspectDocs(root, repo, latest) {
  const refs = [];
  for (const file of maintained[repo]) {
    const full = safeFile(root,file);
    if (!fs.existsSync(full)) continue;
    const lines = fs.readFileSync(full,'utf8').split('\n');
    lines.forEach((line, index) => {
      const match = line.match(/(?:Core|UI|@veil-runtime\/(?:core|ui))[^\n]{0,70}?\b(?:v?0\.\d+\.\d+)\b/i);
      if (match) refs.push({ file, line: index+1, statement: line.trim(), version: (match[0].match(/0\.\d+\.\d+/)||[])[0], historical: /historical|candidate|previous|earlier|prior|then unpublished/i.test(line) || /CHANGELOG/.test(file) });
    });
  }
  return refs;
}
export function digestPlan(plan) { const { digest, ...rest } = plan; return sha(JSON.stringify(rest)); }
export function planAudit(audit) {
  const changes = [];
  for (const finding of audit.findings) if (finding.status === 'verified' && finding.kind === 'stale-current-claim' && finding.replacement && finding.file && finding.statement) {
    changes.push({ repository: finding.repository, file: finding.file, current: finding.statement, proposed: finding.replacement, evidence: finding.evidence, validation: ['git diff --check','python3 tools/verify-documentation.py'], risk: 'low', operation: 'replace-exact', sourceCommit: audit.repositories[finding.repository].commit, remote: audit.repositories[finding.repository].remote });
  }
  changes.sort((a,b) => `${a.repository}/${a.file}/${a.current}`.localeCompare(`${b.repository}/${b.file}/${b.current}`));
  const plan = { schema: 1, repositories: audit.repositories, changes, manualReview: audit.findings.filter(x => x.status !== 'verified' || !x.replacement || !x.file), evidence: audit.evidence };
  plan.digest = digestPlan(plan);
  return plan;
}
export function audit(config) {
  const result = { schema: 1, repositories: {}, packages: {}, findings: [], evidence: {}, routes: ['/', '/developer.html','/ecosystem.html','/ui.html','/getting-started/evaluate.html','/playground/','/showcase/'] };
  for (const [id, repo] of Object.entries(config.repositories)) {
    const root = fs.realpathSync(repo.path);
    const commit = command('git',['rev-parse','HEAD'],root);
    const remote = command('git',['remote','get-url','origin'],root);
    const remoteHead = command('git',['rev-parse','refs/remotes/origin/main'],root);
    result.repositories[id] = { commit, remote, remoteHead, path: root };
    try { const advertised = remoteMain(root); result.repositories[id].advertisedHead=advertised; if (advertised !== remoteHead) result.findings.push({ repository:id, kind:'remote-drift', status:'verified', detail:`origin/main ${remoteHead} differs from advertised ${advertised}`, evidence:'git ls-remote' }); }
    catch (error) { result.findings.push({ repository:id, kind:'remote-unavailable', status:'unverified', detail:error.message }); }
    if (commit !== remoteHead) result.findings.push({ repository:id, kind:'checkout-not-default', status:'suspected', detail:`HEAD ${commit} differs from cached origin/main ${remoteHead}`, evidence:'local refs; remote fetch required' });
    const name = repo.package;
    try {
      let raw = config.capture?.npm?.[id];
      if (!raw) {
        const latest = JSON.parse(command('npm',['view',name,'dist-tags.latest','--json'],root));
        if (typeof latest !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(latest)) throw new Error(`invalid npm latest: ${name}`);
        const manifest = JSON.parse(command('npm',['view',`${name}@${latest}`,'--json'],root));
        raw = JSON.stringify({ 'dist-tags':{latest}, versions:{[latest]:manifest} });
      }
      result.packages[id] = parseNpm(raw,name);
      result.evidence[`npm:${id}`] = config.capture ? 'unverified captured metadata' : 'live npm registry';
      if (!config.capture) {
        try { result.packages[id].artifact = verifyArtifact(result.packages[id],root); }
        catch (error) { result.findings.push({ repository:id, kind:'artifact-unverified', status:'unverified', detail:error.message }); }
      }
    } catch (error) { result.findings.push({ repository:id, kind:'registry-unavailable', status:'unverified', detail:error.message }); }
    let releases;
    try {
      const raw = config.capture?.github?.[id] ?? command('gh',['release','list','-R',repo.github,'--limit','100','--json','tagName,name,publishedAt,isDraft'],root);
      releases = parseGithub(raw);
      result.evidence[`github:${id}`] = config.capture ? 'unverified captured metadata' : 'live GitHub API';
    } catch (error) { result.findings.push({ repository:id, kind:'github-unavailable', status:'unverified', detail:error.message }); }
    const latest = result.packages[id]?.latest;
    const tag = latest && `v${latest}`;
    if (tag && releases && !releases.some(x => x.tag === tag && !x.draft)) result.findings.push({ repository:id, kind:'missing-release', status:config.capture ? 'unverified':'verified', detail:tag, evidence:`github:${id}` });
    if (tag) { const tags = command('git',['tag','--list',tag],root); if (!tags) result.findings.push({ repository:id, kind:'missing-local-tag', status:'suspected', detail:tag, evidence:'local tag inventory; remote fetch required' }); }
    if (!latest) continue;
    const peers = result.packages[id].peerDependencies;
    for (const [peer, range] of Object.entries(peers)) result.findings.push({ repository:id, kind:'peer-dependency', status:config.capture ? 'unverified':'verified', detail:`${peer} ${range}; optional=${result.packages[id].peerDependenciesMeta?.[peer]?.optional === true}`, evidence:`npm:${id}` });
    for (const ref of inspectDocs(root,id,latest)) {
      if (!ref.historical && ref.version !== latest && /\b(current|latest|stable release|published)\b/i.test(ref.statement)) {
        const exact = id === 'core' && ref.file === 'docs/getting-started/evaluate.md' && ref.statement === 'Core and UI are independent published packages. UI 0.4.0 is a stable release for expressive interfaces. Emergence covers experimental reasoning and coordination. Neither UI nor Emergence is included in Core. Sandbox, repository-task and browser capabilities are not published Core';
        result.findings.push({ repository:id, kind:'stale-current-claim', status:exact && !config.capture ? 'verified':'suspected', file:ref.file, line:ref.line, statement:ref.statement, replacement:exact && !config.capture ? ref.statement.replace('UI 0.4.0 is a stable release','UI 0.4.2 is a stable release') : undefined, detail:`mentions ${ref.version}; npm latest ${latest}`, evidence:`npm:${id}` });
      }
    }
  }
  result.findings.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return result;
}
export function applyPlan(plan, options) {
  if (digestPlan(plan) !== plan.digest || options.approval !== plan.digest) throw new Error('plan digest approval mismatch');
  const diff = [];
  for (const [id, repo] of Object.entries(plan.repositories)) {
    const current = command('git',['rev-parse','HEAD'],repo.path);
    if (current !== repo.commit) throw new Error(`stale source: ${id}`);
    if (command('git',['remote','get-url','origin'],repo.path) !== repo.remote) throw new Error(`stale remote URL: ${id}`);
    if (command('git',['rev-parse','refs/remotes/origin/main'],repo.path) !== repo.remoteHead) throw new Error(`stale remote metadata: ${id}`);
    if (!repo.advertisedHead || remoteMain(repo.path) !== repo.advertisedHead || repo.advertisedHead !== repo.remoteHead) throw new Error(`stale or unverified remote: ${id}`);
    if (command('git',['status','--porcelain'],repo.path)) throw new Error(`dirty source: ${id}`);
  }
  if (!Array.isArray(plan.changes) || plan.changes.some(x => x.operation !== 'replace-exact' || x.sourceCommit !== plan.repositories[x.repository]?.commit || typeof x.current !== 'string' || !x.current || typeof x.proposed !== 'string')) throw new Error('invalid or unauthorized plan change');
  const changes = plan.changes;
  if (new Set(changes.map(x=>`${x.repository}\0${x.file}`)).size !== changes.length) throw new Error('duplicate file changes require manual review');
  for (const change of changes) {
    if (!maintained[change.repository]?.includes(change.file)) throw new Error('unauthorized file');
    const repo = plan.repositories[change.repository];
    const source = safeFile(repo.path,change.file);
    const content = fs.readFileSync(source,'utf8');
    if (content.split(change.current).length !== 2) throw new Error('ambiguous or stale statement');
    const updated = content.replace(change.current,change.proposed);
    diff.push({ repository:change.repository,file:change.file,before:content,after:updated });
  }
  if (options.dryRun !== false) return { dryRun:true, changes:diff };
  const worktrees = {};
  try {
    for (const [id,repo] of Object.entries(plan.repositories)) {
      if (!changes.some(x=>x.repository===id)) continue;
      const dir = fs.mkdtempSync(path.join(os.tmpdir(),`veil-steward-${id}-`));
      fs.rmdirSync(dir);
      command('git',['worktree','add','--detach',dir,repo.commit],repo.path);
      worktrees[id] = dir;
    }
    for (const change of diff) fs.writeFileSync(safeFile(worktrees[change.repository],change.file),change.after);
    const results = {};
    for (const [id,dir] of Object.entries(worktrees)) {
      command('git',['diff','--check'],dir);
      if (id === 'core') command('python3',['tools/verify-documentation.py'],dir,60000);
      results[id] = { worktree:dir, diff:command('git',['diff','--',...changes.filter(x=>x.repository===id).map(x=>x.file)],dir) };
    }
    return { dryRun:false, results };
  } catch (error) { for (const [id,dir] of Object.entries(worktrees)) { try { command('git',['worktree','remove','--force',dir],plan.repositories[id].path); } catch {} } throw error; }
}
