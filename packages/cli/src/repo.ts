import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Walk up from this file until the AICL checkout is found. The CLI reads
 * the generated catalog next to the repo, not a published URL.
 */
export function findRepoRoot(start = dirname(fileURLToPath(import.meta.url))): string {
  let dir = start;
  for (;;) {
    const isRepo =
      existsSync(join(dir, 'packages', 'cli', 'package.json')) &&
      existsSync(join(dir, 'packages', 'react', 'package.json'));
    if (isRepo) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error('could not find the AICL repo root');
    }
    dir = parent;
  }
}

export function registryPath(root = findRepoRoot()): string {
  return join(root, 'registry.json');
}

export function itemPath(name: string, root = findRepoRoot()): string {
  return join(root, 'registry', 'r', `${name}.json`);
}
