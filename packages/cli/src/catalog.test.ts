import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

import { buildCatalog, fxExportNames, primitiveExtras } from './catalog.js';
import { findRepoRoot } from './repo.js';
import type { PrimitiveLike } from './types.js';

const root = findRepoRoot();

const { primitives } = (await import(
  new URL('../../react/dist/contract.js', import.meta.url).href
)) as { primitives: PrimitiveLike[] };

test('every primitive has catalog extras', () => {
  for (const primitive of primitives) {
    assert.ok(primitiveExtras[primitive.name], `${primitive.name} has no catalog extras`);
  }
});

test('every catalog file exists in the repo', () => {
  const items = buildCatalog(primitives);
  const missing: string[] = [];
  for (const item of items) {
    for (const file of item.files) {
      if (!existsSync(join(root, file.path))) missing.push(`${item.name}: ${file.path}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('catalog names are unique and kebab-case', () => {
  const items = buildCatalog(primitives);
  const names = items.map((item) => item.name);
  assert.deepEqual(names, [...new Set(names)]);
  for (const name of names) {
    assert.match(name, /^[a-z][a-z0-9-]*$/);
  }
});

test('fx catalog names every public component export', async () => {
  const barrels = [
    'packages/fx/src/index.ts',
    'packages/fx/src/components/stream/index.ts',
    'packages/fx/src/components/input/index.ts',
  ];
  const src = (await Promise.all(barrels.map((file) => readFile(join(root, file), 'utf8')))).join(
    '\n',
  );
  for (const name of fxExportNames) {
    assert.ok(new RegExp(`\\b${name}\\b`).test(src), `fx barrels do not export ${name}`);
  }
});

test('generated registry names every catalog item', async () => {
  const items = buildCatalog(primitives);
  const indexPath = join(root, 'registry.json');
  assert.ok(existsSync(indexPath), 'registry.json is missing; run the registry build');
  const index = JSON.parse(await readFile(indexPath, 'utf8')) as { items: { name: string }[] };
  const names = new Set(index.items.map((item) => item.name));
  for (const item of items) {
    assert.ok(names.has(item.name), `registry.json missing ${item.name}`);
    assert.ok(existsSync(join(root, 'registry', 'r', `${item.name}.json`)), `missing r/${item.name}.json`);
    assert.ok(existsSync(join(root, item.docs)), `missing ${item.docs}`);
  }
});

test('every registry dependency is a catalog item', () => {
  const items = buildCatalog(primitives);
  const names = new Set(items.map((item) => item.name));
  const missing: string[] = [];
  for (const item of items) {
    for (const dep of item.registryDependencies) {
      if (!names.has(dep)) missing.push(`${item.name} → ${dep}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('catalog extras do not name unknown primitives', () => {
  const known = new Set(primitives.map((primitive) => primitive.name));
  const extra = Object.keys(primitiveExtras).filter((name) => !known.has(name));
  assert.deepEqual(extra, []);
});
