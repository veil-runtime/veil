import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { audit, planAudit } from './steward.mjs';

const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const realGit = spawnSync('which',['git'],{encoding:'utf8'}).stdout.trim();
function git(cwd,...args) {
  const result = spawnSync(realGit,args,{cwd,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  return result.stdout.trim();
}
function fixture(failingValidator = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'veil-steward-failure-test-'));
  const source = path.join(root,'source');
  const remote = path.join(root,'remote.git');
  fs.mkdirSync(source);
  git(source,'init','-q'); git(source,'config','user.name','Test'); git(source,'config','user.email','test@example.invalid');
  git(source,'init','--bare','-q',remote); git(source,'remote','add','origin',remote);
  fs.mkdirSync(path.join(source,'docs/getting-started'),{recursive:true});
  fs.mkdirSync(path.join(source,'tools'));
  fs.writeFileSync(path.join(source,'docs/getting-started/evaluate.md'),'Current Core 0.5.0 release guidance.\n');
  fs.writeFileSync(path.join(source,'tools/verify-documentation.py'),failingValidator ? 'raise SystemExit(17)\n' : 'print("ok")\n');
  git(source,'add','.'); git(source,'commit','-qm','fixture'); git(source,'push','-q','origin','HEAD:refs/heads/main');
  git(source,'update-ref','refs/remotes/origin/main','HEAD');
  const report = audit({repositories:{core:{path:source,package:'@veil-runtime/core',github:'disposable/core'}},capture:{npm:{core:JSON.stringify({'dist-tags':{latest:'0.6.0'},versions:{'0.6.0':{name:'@veil-runtime/core',dist:{integrity:'sha512-fixture',tarball:'file:///fixture.tgz'}}}})},github:{core:'[]'}}});
  const finding = report.findings.find(x=>x.kind==='stale-current-claim');
  assert.ok(finding);
  finding.status='verified'; finding.replacement='Current Core 0.6.0 release guidance.';
  const plan = planAudit(report);
  const planFile = path.join(root,'plan.json');
  fs.writeFileSync(planFile,JSON.stringify(plan));
  const bin = path.join(root,'bin'); fs.mkdirSync(bin);
  const wrapper = path.join(bin,'git');
  fs.writeFileSync(wrapper,`#!${process.execPath}\n` + String.raw`
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const args=process.argv.slice(2);
const add=args[0]==='worktree' && args[1]==='add';
const remove=args[0]==='worktree' && args[1]==='remove';
if(add) {
  fs.writeFileSync(process.env.VEIL_TRACE,args[3]);
  if(process.env.VEIL_FAILURE==='add-unregistered') {
    fs.mkdirSync(args[3]); fs.writeFileSync(args[3]+'/partial','partial');
    process.stderr.write('injected add failure\n'); process.exit(41);
  }
}
if(remove && (process.env.VEIL_FAILURE==='remove-always' || process.env.VEIL_FAILURE==='remove-once' && !fs.existsSync(process.env.VEIL_MARKER))) {
  fs.writeFileSync(process.env.VEIL_MARKER,'failed once');
  process.stderr.write('injected remove failure\n'); process.exit(42);
}
if(remove && process.env.VEIL_FAILURE==='remove-false-success') process.exit(0);
const result=spawnSync(process.env.VEIL_REAL_GIT,args,{stdio:'inherit'});
if(result.error) throw result.error;
if(add && process.env.VEIL_FAILURE==='add-registered' && result.status===0) {
  process.stderr.write('injected post-add failure\n'); process.exit(43);
}
process.exit(result.status ?? 44);
`);
  fs.chmodSync(wrapper,0o755);
  return {root,source,remote,plan,planFile,bin,trace:path.join(root,'trace'),marker:path.join(root,'marker')};
}
function snapshot(f) {
  return {head:git(f.source,'rev-parse','HEAD'),tree:git(f.source,'rev-parse','HEAD^{tree}'),status:git(f.source,'status','--porcelain'),file:fs.readFileSync(path.join(f.source,'docs/getting-started/evaluate.md'),'utf8'),remote:git(f.remote,'show-ref'),tags:git(f.source,'tag','--list')};
}
function invoke(f,mode) {
  return spawnSync(process.execPath,[cli,'apply','--plan',f.planFile,'--approve',f.plan.digest,'--execute'],{cwd:f.root,encoding:'utf8',env:{...process.env,PATH:`${f.bin}${path.delimiter}${process.env.PATH}`,VEIL_REAL_GIT:realGit,VEIL_FAILURE:mode,VEIL_TRACE:f.trace,VEIL_MARKER:f.marker}});
}
function worktreeCount(f) { return git(f.source,'worktree','list','--porcelain').split('\n').filter(x=>x.startsWith('worktree ')).length; }

for (const mode of ['add-unregistered','add-registered']) test(`failed worktree creation cleans ${mode} residue`,t=>{
  const f=fixture(); const before=snapshot(f);
  t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
  const result=invoke(f,mode);
  assert.equal(result.status,1,result.stdout);
  assert.equal(result.stdout,'');
  assert.match(result.stderr,/Release Steward: git worktree failed: exit 4[13]/);
  const dir=fs.readFileSync(f.trace,'utf8');
  assert.equal(fs.existsSync(dir),false);
  assert.equal(worktreeCount(f),1);
  assert.deepEqual(snapshot(f),before);
});

test('transient worktree removal failure retries cleanup after validation failure',t=>{
  const f=fixture(true); const before=snapshot(f);
  t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
  const result=invoke(f,'remove-once');
  assert.equal(result.status,1,result.stdout);
  assert.equal(result.stdout,'');
  assert.match(result.stderr,/Release Steward: python3 tools\/verify-documentation.py failed: exit 17/);
  assert.doesNotMatch(result.stderr,/cleanup incomplete/);
  assert.equal(fs.existsSync(f.marker),true);
  assert.equal(fs.existsSync(fs.readFileSync(f.trace,'utf8')),false);
  assert.equal(worktreeCount(f),1);
  assert.deepEqual(snapshot(f),before);
});

for (const mode of ['remove-always','remove-false-success']) test(`${mode} reports manual cleanup path and rejects execution`,t=>{
  const f=fixture(true); const before=snapshot(f);
  t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
  const result=invoke(f,mode);
  assert.equal(result.status,1,result.stdout);
  assert.equal(result.stdout,'');
  const dir=fs.readFileSync(f.trace,'utf8');
  assert.match(result.stderr,/python3 tools\/verify-documentation.py failed: exit 17/);
  assert.match(result.stderr,/cleanup incomplete: core:/);
  assert.ok(result.stderr.includes(dir));
  assert.match(result.stderr,/git worktree list --porcelain/);
  assert.equal(fs.existsSync(dir),true);
  assert.equal(worktreeCount(f),2);
  assert.deepEqual(snapshot(f),before);
  git(f.source,'worktree','remove','--force',dir);
  assert.equal(fs.existsSync(dir),false);
  assert.equal(worktreeCount(f),1);
});
