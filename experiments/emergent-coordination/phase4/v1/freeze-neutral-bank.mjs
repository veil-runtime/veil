import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { runModelTrial } from './host.mjs';
import { buildNeutralBank } from './neutral-content.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const destination = join(here, 'neutral-bank.json');
const directoryPayloads = {};

for (let seed = 33; seed <= 56; seed++) {
  const byParticipant = {};
  const trial = await runModelTrial({ seed, condition: 'distributed', fault: 'primary-failure',
    openChoice: false, directoryVisibility: true, activationLimit: 3,
    async decide({ audience, observation }) {
      byParticipant[audience] = observation.peerCapabilities;
      return { action: { type: 'wait' }, provenance: { callId: Object.keys(byParticipant).length } };
    },
  });
  if (trial.stop !== 'quiescent' || Object.keys(byParticipant).length !== 3) {
    throw new Error(`Offline directory fixture did not produce three actors for seed ${seed}`);
  }
  directoryPayloads[seed] = byParticipant;
}

const bank = buildNeutralBank(directoryPayloads);
const serialized = `${JSON.stringify(bank, null, 2)}\n`;
await writeFile(destination, serialized, { flag: 'wx' });
const digest = createHash('sha256').update(serialized).digest('hex');
await writeFile(`${destination}.sha256`, `${digest}\n`, { flag: 'wx' });
const packageBytes = await readFile(join(here, 'node_modules/js-tiktoken/package.json'));
console.log(JSON.stringify({ bank: 'neutral-bank.json', sha256: digest,
  tokenizerPackageJsonSha256: createHash('sha256').update(packageBytes).digest('hex'),
  entries: bank.entries.length }, null, 2));
