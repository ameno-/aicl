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
    './docs/components.md',
    './docs/DECISIONS.md',
    './docs/ADOPTION.md',
  ]) {
    assert.ok(llms.includes(page), `llms.txt does not point at ${page}`);
  }
});
