import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { springEasing } from './easing.js';
import { spring } from './springs.js';

/**
 * The stylesheet is generated from the tokens. If it drifts, two parts of
 * the same interface move at different speeds — the kind of bug nobody
 * notices until it is everywhere.
 */
const css = await readFile(new URL('../src/motion.css', import.meta.url), 'utf8');

test('the critical spring in the stylesheet matches the token', () => {
  assert.ok(
    css.includes(`--aicl-ease-spring: ${springEasing(spring.moderate)};`),
    'the stylesheet is stale — run node scripts/generate-motion-css.mjs',
  );
});

test('the overshooting spring in the stylesheet matches the token', () => {
  assert.ok(
    css.includes(`--aicl-ease-spring-bounce: ${springEasing(spring.slow)};`),
    'the stylesheet is stale — run node scripts/generate-motion-css.mjs',
  );
});

test('every tier duration in the stylesheet matches the token', () => {
  const expected = [
    `--aicl-motion-fast: ${Math.round(spring.fast.duration * 1000)}ms`,
    `--aicl-motion-moderate: ${Math.round(spring.moderate.duration * 1000)}ms`,
    `--aicl-motion-slow: ${Math.round(spring.slow.duration * 1000)}ms`,
    `--aicl-motion-fast-exit: ${Math.round(spring.fast.exit.duration * 1000)}ms`,
    `--aicl-motion-moderate-exit: ${Math.round(spring.moderate.exit.duration * 1000)}ms`,
    `--aicl-motion-slow-exit: ${Math.round(spring.slow.exit.duration * 1000)}ms`,
  ];
  for (const line of expected) {
    assert.ok(css.includes(line), `the stylesheet is missing "${line}"`);
  }
});

test('the contract easings are replaced, not shadowed', () => {
  assert.ok(css.includes('--aicl-ease: var(--aicl-ease-spring);'));
  assert.ok(css.includes('--aicl-ease-out: var(--aicl-ease-spring-bounce);'));
});

test('no timing function smuggles a time into a linear() stop', () => {
  // `linear()` accepts numbers and percentages, never a time. A stop like
  // `linear(0, 60ms)` is invalid and the whole declaration is dropped.
  assert.ok(!/linear\([^)]*ms/.test(css), 'a linear() stop carries a time');
});

test('the stylesheet honours reduced motion', () => {
  assert.ok(css.includes('prefers-reduced-motion: reduce'));
});
