import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { disposition, type CatalogItem } from './catalog.js';
import { incorporations, type IncorporationRecord } from './incorporation.js';
import { primitives } from './contract.js';

const repo = new URL('../../../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('docs/catalog/items.json', repo), 'utf8')) as {
  pins: Record<string, string>;
  items: CatalogItem[];
};
const sources = JSON.parse(await readFile(new URL('docs/catalog/sources.json', repo), 'utf8')) as Record<
  string,
  { commit: string }
>;

test('the discovered catalog matches the pinned commits', () => {
  for (const [name, source] of Object.entries(sources)) {
    assert.equal(catalog.pins[name], source.commit, `${name} was discovered at a different commit than the pin`);
  }
  assert.ok(catalog.items.length > 200, 'discovery looks truncated');
});

test('every primitive has one incorporation record, and every record is a primitive', () => {
  const names = incorporations.map((record) => record.name);
  assert.deepEqual(names, primitives.map((primitive) => primitive.name));
});

test('every incorporation names real shapes, real motion, and a place to see it', () => {
  for (const record of incorporations) {
    assert.ok(record.shapes.includes('S7'), `${record.name} publishes slots, so it has shape S7`);
    if (record.motion.tier === 'none') {
      assert.deepEqual(record.motion.behaviors, [], `${record.name} is still, so it names no motion`);
    } else {
      assert.ok(record.motion.behaviors.length > 0, `${record.name} moves, so it names the motion`);
    }
    assert.ok(record.taken.length > 40, `${record.name} needs a note on what was taken`);
    assert.ok(record.see.length > 10, `${record.name} needs a place to see it`);
  }
});

test('every sample name a record cites was actually discovered', () => {
  const known = new Set(catalog.items.map((item) => `${item.source}:${item.name}`));
  for (const record of incorporations) {
    for (const source of ['looseleaf', 'fluid'] as const) {
      for (const name of record.aligns[source]) {
        assert.ok(known.has(`${source}:${name}`), `${record.name} cites ${source}:${name}, which is not in the catalog`);
      }
    }
  }
});

test('every discovered item has a disposition, and an incorporated one names a primitive', () => {
  const primitiveNames = new Set(primitives.map((primitive) => primitive.name));
  const unclassified: string[] = [];

  for (const item of catalog.items) {
    const decision = disposition(item);
    assert.ok(decision.reason.length > 20, `${item.source}:${item.name} has a thin reason`);
    if (decision.status === 'unclassified') unclassified.push(`${item.source}:${item.name}`);
    if (decision.status === 'incorporated') {
      for (const name of decision.as ?? []) {
        assert.ok(primitiveNames.has(name), `${item.source}:${item.name} claims unknown primitive ${name}`);
      }
    }
    if (decision.status === 'candidate') {
      assert.ok(decision.wave, `${item.source}:${item.name} is a candidate with no wave`);
    }
  }

  assert.deepEqual(unclassified, [], 'these items have no disposition');
});

test('a gallery id and a tour stop that a record names are real', async () => {
  const components = await readFile(new URL('examples/slice-1/Components.tsx', repo), 'utf8');
  const tour = await readFile(new URL('examples/slice-1/Tour.tsx', repo), 'utf8');

  for (const record of incorporations) {
    if (record.gallery) {
      assert.ok(
        components.includes(`id="${record.gallery}"`),
        `${record.name} points at gallery section "${record.gallery}", which Components.tsx does not have`,
      );
    }
    if (record.tour) {
      assert.ok(
        tour.includes(`id: '${record.tour}'`),
        `${record.name} points at tour stop "${record.tour}", which Tour.tsx does not have`,
      );
    }
  }
});

test('the content and motion primitives are on the gallery and, when they move, on the tour', () => {
  const mustShow: Array<[string, string | null]> = [
    ['Badge', 'content'],
    ['Separator', 'content'],
    ['Kbd', 'content'],
    ['Alert', 'content'],
    ['Card', 'content'],
    ['Empty', 'content'],
    ['Tooltip', 'content'],
    ['Progress', 'motion'],
    ['Skeleton', 'motion'],
    ['Spinner', 'motion'],
    ['Tabs', 'motion'],
    ['Collapsible', 'motion'],
    ['Accordion', 'motion'],
  ];
  const byName = new Map(incorporations.map((record) => [record.name, record]));

  for (const [name, gallery] of mustShow) {
    const record = byName.get(name);
    assert.ok(record, name);
    assert.equal(record.gallery, gallery, `${name} should be in the ${gallery} section`);
  }

  for (const name of ['Progress', 'Skeleton', 'Spinner', 'Tabs', 'Collapsible', 'Accordion']) {
    assert.equal(byName.get(name)?.tour, 'motion', `${name} should be on the motion stop`);
  }
});

function record(name: string): IncorporationRecord {
  const found = incorporations.find((entry) => entry.name === name);
  if (!found) throw new Error(name);
  return found;
}

test('the travelling pill and the folding panel are the motions the samples are known for', () => {
  assert.ok(record('Tabs').motion.behaviors.includes('travelling-indicator'));
  assert.ok(record('SegmentedControl').motion.behaviors.includes('travelling-indicator'));
  assert.ok(record('Accordion').motion.behaviors.includes('height'));
  assert.ok(record('Collapsible').motion.behaviors.includes('chevron'));
  assert.equal(record('Separator').motion.tier, 'none');
});
