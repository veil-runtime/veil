import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { EmergenceState } from './types.js';

/** One-writer journal. Atomic replacement prevents partial JSON after a crash. */
export class FileJournal {
  constructor(private readonly directory: string) {}

  async save(state: EmergenceState): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const path = this.path(state.id);
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(state, null, 2), { flag: 'wx' });
    await rename(temporary, path);
  }

  async load(id: string): Promise<EmergenceState> {
    const value = JSON.parse(await readFile(this.path(id), 'utf8')) as EmergenceState;
    if (value.id !== id) throw new Error('Journal identity mismatch');
    return value;
  }

  private path(id: string): string {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error('Invalid goal id');
    return join(this.directory, `${id}.json`);
  }
}
