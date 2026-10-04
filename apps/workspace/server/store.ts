/**
 * Workspace state on disk. `<workspace>/.aicl/` is the source of truth, so a
 * scratchpad survives restarts and can be committed with the project.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function createWorkspaceStore(workspaceDir: string) {
  const dir = path.join(workspaceDir, '.aicl');
  const scratchFile = path.join(dir, 'scratchpad.json');

  return {
    dir,
    scratchFile,

    async readScratch(): Promise<unknown | null> {
      try {
        return JSON.parse(await readFile(scratchFile, 'utf8'));
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw cause;
      }
    },

    /** Atomic replace, so a crash mid-write never leaves a torn snapshot. */
    async writeScratch(snapshot: unknown): Promise<void> {
      await mkdir(dir, { recursive: true });
      const tmp = `${scratchFile}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(snapshot));
      await rename(tmp, scratchFile);
    },
  };
}

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;

/** Shape and binding records from a tldraw document snapshot (`{ store: {...} }`). */
export function snapshotRecords(snapshot: unknown): unknown[] {
  const store = (snapshot as { store?: Record<string, unknown> } | null)?.store;
  return store ? Object.values(store) : [];
}
