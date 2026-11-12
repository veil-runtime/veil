import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseNpm, parseGithub, inspectDocs, planAudit, digestPlan, applyPlan, safeFile, audit } from './steward.mjs';

const npmRaw = (name, version, peers = {}) => JSON.stringify({ 'dist-tags':{latest:version}, versions:{[version]:{name,dist:{integrity:'sha512-test',tarball:'https://registry.npmjs.org/x.tgz'},peerDependencies:peers,peerDependenciesMeta:{'@veil-runtime/core':{optional:true}}}} });
const git = (dir,...args) => { const r=spawnSync('git',args,{cwd:dir,encoding:'utf8'}); assert.equal(r.status,0,r.stderr); return r.stdout.trim(); };
function fixture() {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'steward-test-'));
  git(dir,'init','-q'); git(dir,'config','user.name','Test'); git(dir,'config','user.email','test@example.com');
  const remote=dir+'-remote.git'; git(dir,'init','--bare','-q',remote); git(dir,'remote','add','origin',remote);
  fs.mkdirSync(path.join(dir,'docs/getting-started'),{recursive:true});
  fs.writeFileSync(path.join(dir,'docs/getting-started/evaluate.md'),'Core and UI are independent published packages. UI 0.4.0 is a stable release for expressive interfaces. Emergence covers experimental reasoning and coordination. Neither UI nor Emergence is included in Core. Sandbox, repository-task and browser capabilities are not published Core\n');
  fs.writeFileSync(path.join(dir,'README.md'),'Historical UI 0.4.0 release.\n');
  fs.mkdirSync(path.join(dir,'tools'),{recursive:true}); fs.writeFileSync(path.join(dir,'tools/verify-documentation.py'),'print("ok")\n');
  git(dir,'add','.'); git(dir,'commit','-qm','fixture'); git(dir,'push','-q','origin','HEAD:refs/heads/main'); git(dir,'update-ref','refs/remotes/origin/main','HEAD');
  return dir;
}
function reviewedPlan(config) {
  const report=audit(config);
  const finding=report.findings.find(x=>x.kind==='stale-current-claim');
  finding.status='verified'; finding.replacement=finding.statement.replace('UI 0.4.0','UI 0.4.2');
  return planAudit(report);
}
test('npm and GitHub metadata, optional peer',()=>{
  const p=parseNpm(npmRaw('@veil-runtime/ui','0.4.2',{'@veil-runtime/core':'^0.4.0'}),'@veil-runtime/ui');
  assert.equal(p.latest,'0.4.2'); assert.equal(p.integrity,'sha512-test'); assert.equal(p.peerDependenciesMeta['@veil-runtime/core'].optional,true);
  assert.deepEqual(parseGithub('[{"tagName":"v0.4.1","name":"old","publishedAt":"now","isDraft":false}]')[0].tag,'v0.4.1');
  assert.throws(()=>parseNpm('{}','x'),/incomplete/);
  assert.throws(()=>parseGithub('{}'),/invalid/);
});
test('audit is read only, deterministic, and distinguishes history and missing release',()=>{
  const dir=fixture(); const before=git(dir,'status','--porcelain');
  const config={repositories:{core:{path:dir,package:'@veil-runtime/core',github:'veil-runtime/veil'}},capture:{npm:{core:npmRaw('@veil-runtime/core','0.6.0')},github:{core:'[]'}}};
  const a=audit(config); assert.deepEqual(a,audit(config)); assert.equal(git(dir,'status','--porcelain'),before);
  assert.ok(a.findings.some(x=>x.kind==='missing-release' && x.status==='unverified'));
  assert.ok(a.findings.some(x=>x.kind==='stale-current-claim' && x.file.endsWith('evaluate.md')));
  assert.ok(!a.findings.some(x=>x.file==='README.md'));
  assert.equal(planAudit(a).changes.length,0);
  assert.equal(planAudit(a).digest,planAudit(a).digest);
});
test('failure data is unverified',()=>{ const dir=fixture(); const a=audit({repositories:{core:{path:dir,package:'@veil-runtime/core',github:'veil-runtime/veil'}},capture:{npm:{core:'{}'}}}); assert.equal(a.findings[0].status,'unverified'); });
test('plan approval, stale source, unauthorized path, dry run and idempotence',()=>{
  const dir=fixture(); const config={repositories:{core:{path:dir,package:'@veil-runtime/core',github:'veil-runtime/veil'}},capture:{npm:{core:npmRaw('@veil-runtime/core','0.6.0')},github:{core:'[]'}}};
  const plan=reviewedPlan(config);
  assert.throws(()=>applyPlan(plan,{approval:'bad'}),/digest/);
  assert.equal(applyPlan(plan,{approval:plan.digest}).dryRun,true);
  assert.equal(git(dir,'status','--porcelain'),'');
  const bad=structuredClone(plan); bad.changes[0].file='../../secret'; bad.digest=digestPlan(bad);
  assert.throws(()=>applyPlan(bad,{approval:bad.digest}),/unauthorized/);
  const unknown=structuredClone(plan); unknown.changes[0].operation='run-command'; unknown.digest=digestPlan(unknown);
  assert.throws(()=>applyPlan(unknown,{approval:unknown.digest}),/invalid or unauthorized/);
  const unbound=structuredClone(plan); unbound.changes[0].sourceCommit='0'.repeat(40); unbound.digest=digestPlan(unbound);
  assert.throws(()=>applyPlan(unbound,{approval:unbound.digest}),/invalid or unauthorized/);
  const duplicate=structuredClone(plan); duplicate.changes.push(structuredClone(duplicate.changes[0])); duplicate.digest=digestPlan(duplicate);
  assert.throws(()=>applyPlan(duplicate,{approval:duplicate.digest}),/duplicate file changes/);
  fs.writeFileSync(path.join(dir,'new'),'x'); git(dir,'add','.'); git(dir,'commit','-qm','new');
  assert.throws(()=>applyPlan(plan,{approval:plan.digest}),/stale source/);
});
test('traversal and symlinks are rejected',()=>{
  const dir=fixture(); assert.throws(()=>safeFile(dir,'../escape'),/unsafe/);
  fs.symlinkSync('/tmp',path.join(dir,'link')); assert.throws(()=>safeFile(dir,'link/file'),/symlink/);
  fs.symlinkSync('/tmp/no-such-release-steward-path',path.join(dir,'dangling')); assert.throws(()=>safeFile(dir,'dangling'),/symlink/);
});
test('approved execution writes only isolated worktrees and repeats deterministically',()=>{
  const dir=fixture(); const config={repositories:{core:{path:dir,package:'@veil-runtime/core',github:'veil-runtime/veil'}},capture:{npm:{core:npmRaw('@veil-runtime/core','0.6.0')},github:{core:'[]'}}};
  const plan=reviewedPlan(config);
  const first=applyPlan(plan,{approval:plan.digest,dryRun:false});
  const second=applyPlan(plan,{approval:plan.digest,dryRun:false});
  assert.equal(first.results.core.diff,second.results.core.diff);
  assert.equal(git(dir,'status','--porcelain'),'');
  for (const result of [first,second]) git(dir,'worktree','remove','--force',result.results.core.worktree);
});
test('remote movement invalidates an approved plan',()=>{
  const dir=fixture(); const config={repositories:{core:{path:dir,package:'@veil-runtime/core',github:'veil-runtime/veil'}},capture:{npm:{core:npmRaw('@veil-runtime/core','0.6.0')},github:{core:'[]'}}};
  const plan=reviewedPlan(config);
  fs.writeFileSync(path.join(dir,'remote-change'),'x'); git(dir,'add','.'); git(dir,'commit','-qm','remote change'); git(dir,'push','-q','origin','HEAD:refs/heads/main');
  git(dir,'reset','--hard',plan.repositories.core.commit);
  assert.throws(()=>applyPlan(plan,{approval:plan.digest}),/remote/);
});
test('remote URL change invalidates an approved plan',()=>{
  const dir=fixture(); const config={repositories:{core:{path:dir,package:'@veil-runtime/core',github:'veil-runtime/veil'}},capture:{npm:{core:npmRaw('@veil-runtime/core','0.6.0')},github:{core:'[]'}}};
  const plan=reviewedPlan(config);
  git(dir,'remote','set-url','origin',dir+'-different.git');
  assert.throws(()=>applyPlan(plan,{approval:plan.digest}),/stale remote URL/);
});
