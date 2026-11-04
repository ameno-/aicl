/**
 * Rewrites docs/catalog/items.json from the pinned sample registries.
 *
 * The registries are the source of truth. The documentation sites describe
 * a subset; this script reads registry.json at the commit in
 * docs/catalog/sources.json.
 *
 *   node packages/react/scripts/discover-registries.mjs --fetch
 *
 * Without --fetch the script checks that items.json matches the pin and
 * exits. A drift here means someone moved the pin without rediscovering.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const sourcesPath = join(repo, 'docs', 'catalog', 'sources.json');
const itemsPath = join(repo, 'docs', 'catalog', 'items.json');

const sources = JSON.parse(await readFile(sourcesPath, 'utf8'));
const fetchNow = process.argv.includes('--fetch');

function registryUrl(source) {
  const owner = source.repo.replace('https://github.com/', '');
  return `https://raw.githubusercontent.com/${owner}/${source.commit}/${source.registry}`;
}

async function loadRegistry(name) {
  const source = sources[name];
  if (!fetchNow) return null;
  const response = await fetch(registryUrl(source));
  if (!response.ok) {
    throw new Error(`could not fetch ${name} registry (${response.status}) from ${registryUrl(source)}`);
  }
  return response.json();
}

function normalize(name, registry) {
  return registry.items.map((item) => ({
    source: name,
    name: item.name,
    type: item.type,
    title: item.title ?? item.name,
    description: (item.description ?? '').replace(/\s+/g, ' ').trim(),
    categories: item.categories ?? [],
  }));
}

if (!fetchNow) {
  const items = JSON.parse(await readFile(itemsPath, 'utf8'));
  const pins = items.pins ?? {};
  for (const name of Object.keys(sources)) {
    if (pins[name] !== sources[name].commit) {
      throw new Error(
        `${name} is pinned at ${sources[name].commit} but items.json was discovered at ${pins[name] ?? 'nothing'}. Run with --fetch.`,
      );
    }
  }
  console.log(`docs/catalog/items.json matches the pin (${items.items.length} items)`);
  process.exit(0);
}

const items = [];
for (const name of Object.keys(sources)) {
  const registry = await loadRegistry(name);
  items.push(...normalize(name, registry));
}

const document = {
  pins: Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, source.commit])),
  items,
};

await writeFile(itemsPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
console.log(`wrote docs/catalog/items.json (${items.length} items)`);
