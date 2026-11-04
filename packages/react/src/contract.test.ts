import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { allSlots, primitives, sharedSlots } from './contract.js';

const src = new URL('../src/', import.meta.url);

/**
 * Every `data-aicl` value the source renders.
 *
 * Three forms count:
 *
 *   - the literal attribute (`data-aicl="composer"`),
 *   - the spread form a primitive builds as an object
 *     (`'data-aicl': 'sidebar-nav-item'`),
 *   - the dynamic form (`data-aicl={kind}`), resolved against the union of
 *     `kind` in the same file. One implementation renders several surfaces
 *     (`dialog`, `alert-dialog`, `drawer`), so the union is the honest
 *     answer.
 */
async function slotsInSource(): Promise<Map<string, Set<string>>> {
  const files = await readdir(src);
  const byFile = new Map<string, Set<string>>();

  for (const file of files) {
    if (!file.endsWith('.tsx') || file.endsWith('.test.tsx')) continue;
    const text = await readFile(new URL(file, src), 'utf8');
    const slots = new Set<string>();

    for (const match of text.matchAll(/data-aicl="([a-z0-9-]+)"/g)) {
      slots.add(match[1]!);
    }
    for (const match of text.matchAll(/'data-aicl':\s*'([a-z0-9-]+)'/g)) {
      slots.add(match[1]!);
    }

    // The union of `kind`, but only where `kind` is actually used as the
    // slot name. Other `kind:` fields in the tree are content kinds, not
    // surfaces.
    const usesKindAsSlot = /data-aicl=\{kind\}/.test(text) || /data-aicl=\{`\$\{kind\}/.test(text);
    if (usesKindAsSlot) {
      const kinds = [...text.matchAll(/\bkind:\s*((?:'[^']+'\s*\|\s*)*'[^']+')/g)]
        .flatMap((match) => [...match[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!));
      for (const kind of kinds) {
        slots.add(kind);
        slots.add(`${kind}-layer`);
      }
    }

    byFile.set(file, slots);
  }

  return byFile;
}

test('every slot the source renders is in the contract', async () => {
  const byFile = await slotsInSource();
  const documented = new Set(allSlots());
  const undocumented: string[] = [];

  for (const [file, slots] of byFile) {
    for (const slot of slots) {
      if (!documented.has(slot)) undocumented.push(`${file}: ${slot}`);
    }
  }

  assert.deepEqual(
    undocumented.sort(),
    [],
    'these slots are rendered but not documented in the contract',
  );
});

test('every slot in the contract is rendered by the source', async () => {
  const byFile = await slotsInSource();
  const rendered = new Set<string>();
  for (const slots of byFile.values()) {
    for (const slot of slots) rendered.add(slot);
  }

  const phantom: string[] = [];
  for (const slot of allSlots()) {
    if (!rendered.has(slot)) phantom.push(slot);
  }

  assert.deepEqual(
    phantom.sort(),
    [],
    'these slots are documented but never rendered',
  );
});

test('every slot is owned by exactly one primitive, or is shared', async () => {
  const owners = new Map<string, string[]>();
  for (const primitive of primitives) {
    for (const slot of primitive.slots) {
      owners.set(slot, [...(owners.get(slot) ?? []), primitive.name]);
    }
  }

  for (const [slot, names] of owners) {
    assert.equal(
      names.length,
      1,
      `"${slot}" is claimed by ${names.join(' and ')} — a slot belongs to one primitive`,
    );
  }

  for (const slot of sharedSlots.slots) {
    assert.ok(
      !owners.has(slot),
      `"${slot}" is shared but is also claimed by a primitive`,
    );
  }
});

test('a file only renders slots that its primitives claim', async () => {
  const byFile = await slotsInSource();

  for (const [file, slots] of byFile) {
    const claimed = new Set<string>(sharedSlots.slots);
    for (const primitive of primitives) {
      if (!primitive.source.includes(file)) continue;
      for (const slot of primitive.slots) claimed.add(slot);
    }

    for (const slot of slots) {
      assert.ok(
        claimed.has(slot),
        `${file} renders "${slot}", which no primitive claims`,
      );
    }
  }
});

test('every primitive has a summary and a source', () => {
  for (const primitive of primitives) {
    assert.ok(primitive.summary.length > 10, `${primitive.name} needs a summary`);
    assert.ok(primitive.source.length > 0, `${primitive.name} needs a source`);
  }
});

test('the slot list is stable and sorted', () => {
  const slots = allSlots();
  assert.deepEqual(slots, [...slots].sort());
});
