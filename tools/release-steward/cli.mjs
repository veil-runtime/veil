#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { audit, planAudit, applyPlan } from './steward.mjs';

const [action, ...args] = process.argv.slice(2);
const option = key => { const i = args.indexOf(key); return i < 0 ? undefined : args[i+1]; };
const read = file => JSON.parse(fs.readFileSync(file,'utf8'));
function write(output, value) {
  const json = JSON.stringify(value,null,2)+'\n';
  if (output) fs.writeFileSync(output,json); else process.stdout.write(json);
}
try {
  if (action === 'audit') {
    const config = read(option('--config') || path.join(import.meta.dirname,'config.json'));
    const report = audit(config);
    write(option('--output'),report);
    const md = option('--markdown');
    if (md) fs.writeFileSync(md,`# Release Steward audit\n\n${report.findings.map(x=>`- **${x.status}** ${x.repository}: ${x.kind}${x.file ? ` in \`${x.file}\`` : ''} — ${x.detail || x.statement || ''}`).join('\n')}\n`);
  } else if (action === 'plan') write(option('--output'),planAudit(read(option('--audit'))));
  else if (action === 'apply') write(option('--output'),applyPlan(read(option('--plan')),{ approval:option('--approve'), dryRun:!args.includes('--execute') }));
  else throw new Error('usage: cli.mjs audit --config config.json [--output audit.json --markdown audit.md] | plan --audit audit.json [--output plan.json] | apply --plan plan.json --approve DIGEST [--execute]');
} catch (error) { process.stderr.write(`Release Steward: ${error.message}\n`); process.exitCode=1; }
