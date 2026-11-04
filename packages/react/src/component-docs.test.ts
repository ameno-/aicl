import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { allSlots, primitives } from './contract.js';

const repo = new URL('../../../', import.meta.url);

const components = await readFile(new URL('docs/components.md', repo), 'utf8');
const llms = await readFile(new URL('docs/llms.txt', repo), 'utf8');

test('the generated component doc names every primitive', () => {
  for (const primitive of primitives) {
    assert.ok(
      components.includes(primitive.name),
      `docs/components.md does not mention ${primitive.name}`,
    );
  }
});

test('the generated component doc lists every slot', () => {
  for (const slot of allSlots()) {
    assert.ok(
      components.includes(`\`${slot}\``),
      `docs/components.md does not list the slot ${slot}`,
    );
  }
});

test('the generated component doc lists every state', () => {
  for (const primitive of primitives) {
    for (const [attribute, values] of Object.entries(primitive.states ?? {})) {
      assert.ok(
        components.includes(`\`${attribute}\``),
        `docs/components.md does not list ${primitive.name}'s ${attribute}`,
      );
      for (const value of values) {
        assert.ok(
          components.includes(`\`${value}\``),
          `docs/components.md does not list ${primitive.name}'s ${attribute}="${value}"`,
        );
      }
    }
  }
});

test('llms.txt points at the docs an agent needs', () => {
  for (const page of [
    './docs/DESIGN-SYSTEM.md',
    './docs/LIBRARY.md',
    './docs/catalog/README.md',
    './docs/catalog/index.md',
    './docs/INVENTORY.md',
    './docs/ROADMAP.md',
    './docs/components.md',
    './docs/DECISIONS.md',
    './docs/ADOPTION.md',
  ]) {
    assert.ok(llms.includes(page), `llms.txt does not point at ${page}`);
  }
});

function slug(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

test('every primitive has its own page, naming its motion and its samples', async () => {
  const { incorporations } = await import('./incorporation.js');
  for (const record of incorporations) {
    const page = await readFile(new URL(`docs/components/${slug(record.name)}.md`, repo), 'utf8');
    assert.ok(page.startsWith(`# ${record.name}\n`), `${record.name} page is missing its heading`);
    if (record.motion.tier === 'none') {
      assert.ok(page.includes('Still.'), `${record.name} should say it is still`);
    } else {
      for (const behavior of record.motion.behaviors) {
        assert.ok(page.includes(`\`${behavior}\``), `${record.name} page omits motion ${behavior}`);
      }
    }
    for (const name of [...record.aligns.looseleaf, ...record.aligns.fluid]) {
      assert.ok(page.includes(name), `${record.name} page does not cite ${name}`);
    }
  }
});

test('the catalog index names every discovered item', async () => {
  const index = await readFile(new URL('docs/catalog/index.md', repo), 'utf8');
  const discovered = JSON.parse(await readFile(new URL('docs/catalog/items.json', repo), 'utf8')) as {
    items: { name: string }[];
  };
  for (const item of discovered.items) {
    assert.ok(index.includes(`\`${item.name}\``), `catalog index omits ${item.name}`);
  }
});
