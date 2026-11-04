import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLAYGROUND_INPUTS, STARTER_PROMPT, composePrompt, compositionJsx } from './compose.js';

test('the starter prompt places the frame in the order it is written', () => {
  const composition = composePrompt(STARTER_PROMPT);
  assert.deepEqual(composition.blocks, ['alert', 'plan', 'card', 'tabs', 'empty']);
  assert.deepEqual(composition.refused, []);
  assert.match(composition.jsx, /Alert/);
  assert.match(composition.jsx, /PlanChecklist/);
  assert.match(composition.jsx, /Tabs/);
  assert.match(composition.jsx, /Empty/);
  assert.doesNotMatch(composition.jsx, /Spinner/);
});

test('a prompt places inputs in mention order and refuses what the library does not export', () => {
  const composition = composePrompt('a popover, then badges, then a command menu');
  assert.deepEqual(composition.blocks, ['badges']);
  assert.deepEqual(composition.refused, ['Popover', 'Command menu']);
  assert.match(composition.note, /Not an input yet: Popover, Command menu/);
});

test('a blank prompt is an empty frame', () => {
  const composition = composePrompt('   ');
  assert.deepEqual(composition.blocks, []);
  assert.equal(composition.jsx, compositionJsx([]));
  assert.match(composition.note, /empty/);
});

test('a word that only shares a stem does not place or refuse', () => {
  const composition = composePrompt('format the comfortable table of contents');
  assert.deepEqual(composition.blocks, []);
  assert.deepEqual(composition.refused, ['Table']);
});

test('each input places once, from its own phrase', () => {
  for (const input of PLAYGROUND_INPUTS) {
    const composition = composePrompt(input.phrases[0]!);
    assert.deepEqual(composition.blocks, [input.id], input.id);
    for (const name of input.imports) assert.match(composition.jsx, new RegExp(`\\b${name}\\b`));
  }
});
