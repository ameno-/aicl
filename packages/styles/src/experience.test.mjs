import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('the contract publishes the experience tokens at their flat defaults', async () => {
  const css = await read('./contract.css');
  for (const token of [
    '--aicl-border-width: 1px',
    '--aicl-press-y: 0px',
    '--aicl-enter-y: 2px',
    '--aicl-enter-rotate: 0deg',
    '--aicl-dialog-enter-y: 4px',
    '--aicl-dialog-enter-rotate: 0deg',
  ]) {
    assert.ok(css.includes(token), `contract.css is missing ${token}`);
  }
});

test('the surfaces arrive and press through those tokens', async () => {
  const css = await read('./components.css');
  assert.match(css, /translateY\(var\(--aicl-enter-y\)\) rotate\(var\(--aicl-enter-rotate\)\)/);
  assert.match(css, /translateY\(var\(--aicl-press-y\)\)/);
  assert.match(css, /rotate\(var\(--aicl-dialog-enter-rotate\)\)/);
  assert.match(css, /border: var\(--aicl-border-width\) solid var\(--aicl-border\)/);
});

test('LooseLeaf moves the edge, the lift, and the arrival', async () => {
  const css = await read('./themes/looseleaf.css');
  assert.match(css, /--aicl-border-width: 1\.5px/);
  assert.match(css, /--aicl-press-y: 2px/);
  assert.match(css, /--aicl-enter-rotate: -0\.7deg/);
  assert.match(css, /--aicl-shadow-2: 3px 3px 0/);
  assert.match(css, /\[data-aicl='button'\]:not\(:disabled\):active/);
  assert.match(css, /inset 0 -0\.45em 0 var\(--aicl-accent-soft\)/);
  assert.doesNotMatch(css, /--aicl-shadow-2: 0 1px 2px/);
});
