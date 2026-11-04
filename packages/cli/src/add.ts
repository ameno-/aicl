import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { itemPath, registryPath } from './repo.js';
import type { CatalogItem } from './types.js';

export interface AddOptions {
  cwd?: string;
  force?: boolean;
  dryRun?: boolean;
}

interface RegistryIndex {
  items: { name: string; registryDependencies?: string[] }[];
}

async function loadIndex(root: string): Promise<RegistryIndex> {
  const text = await readFile(registryPath(root), 'utf8');
  return JSON.parse(text) as RegistryIndex;
}

async function loadItem(name: string, root: string): Promise<CatalogItem> {
  const path = itemPath(name, root);
  if (!existsSync(path)) {
    throw new Error(`unknown item "${name}". Run \`aicl list\` to see the catalog.`);
  }
  return JSON.parse(await readFile(path, 'utf8')) as CatalogItem;
}

function collect(name: string, index: RegistryIndex, into: string[]): void {
  if (into.includes(name)) return;
  const listed = index.items.find((item) => item.name === name);
  if (!listed) throw new Error(`unknown item "${name}". Run \`aicl list\` to see the catalog.`);
  for (const dep of listed.registryDependencies ?? []) collect(dep, index, into);
  into.push(name);
}

export interface AddResult {
  items: string[];
  copied: { from: string; to: string }[];
  skipped: string[];
  npmImports: string[];
  dependencies: string[];
}

export async function addItems(
  names: string[],
  root: string,
  options: AddOptions = {},
): Promise<AddResult> {
  const index = await loadIndex(root);
  const ordered: string[] = [];
  for (const name of names) collect(name, index, ordered);

  const cwd = resolve(options.cwd ?? process.cwd());
  const copied: { from: string; to: string }[] = [];
  const skipped: string[] = [];
  const npmImports: string[] = [];
  const dependencies = new Set<string>();

  for (const name of ordered) {
    const item = await loadItem(name, root);
    npmImports.push(item.npmImport);
    for (const dep of item.dependencies) dependencies.add(dep);

    for (const file of item.files) {
      const from = join(root, file.path);
      const target = file.target ?? file.path.replace(/^packages\/[^/]+\/src\//, 'components/aicl/');
      const to = join(cwd, target);
      if (!existsSync(from)) {
        throw new Error(`${name}: missing source ${file.path}`);
      }
      if (existsSync(to) && !options.force) {
        skipped.push(to);
        continue;
      }
      copied.push({ from, to });
      if (options.dryRun) continue;
      const content = file.content ?? (await readFile(from, 'utf8'));
      await mkdir(dirname(to), { recursive: true });
      await writeFile(to, content, 'utf8');
    }
  }

  return {
    items: ordered,
    copied,
    skipped,
    npmImports: [...new Set(npmImports)],
    dependencies: [...dependencies].sort(),
  };
}
