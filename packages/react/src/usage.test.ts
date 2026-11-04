import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLAYGROUND_INPUTS } from './compose.js';
import { primitives } from './contract.js';
import { usages } from './usage.js';

test('every primitive has one usage record, in contract order', () => {
  assert.deepEqual(
    usages.map((usage) => usage.name),
    primitives.map((primitive) => primitive.name),
  );
  for (const usage of usages) {
    assert.ok(usage.when.length > 40, `${usage.name} when`);
    assert.ok(usage.not.length > 40, `${usage.name} not`);
    assert.ok(usage.example.includes('<'), `${usage.name} example`);
    assert.ok(
      usage.when.includes(usage.name) || usage.example.includes(usage.name),
      `${usage.name} is not named`,
    );
  }
});

test('a canvas input is a primitive whose usage tells you how to ask for it', () => {
  for (const input of PLAYGROUND_INPUTS) {
    const usage = usages.find((item) => item.name === input.primitive);
    assert.ok(usage?.canvas, `${input.primitive} has no canvas line`);
    for (const phrase of input.phrases) {
      assert.ok(usage.canvas!.includes(`\`${phrase}\``), `${input.primitive} omits ${phrase}`);
    }
  }
  for (const usage of usages) {
    if (!usage.canvas) continue;
    assert.ok(
      PLAYGROUND_INPUTS.some((input) => input.primitive === usage.name),
      `${usage.name} claims a canvas input it does not have`,
    );
  }
});
