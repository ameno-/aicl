import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  dampingRatio,
  sampleSpring,
  springEasing,
  springProgress,
  springEasings,
} from './easing.js';
import { spring, springTiers } from './springs.js';

test('a critical spring never passes its target', () => {
  const values = sampleSpring(spring.fast);
  for (const value of values) {
    assert.ok(value <= 1, `${value} should not exceed 1`);
  }
});

test('a spring starts at 0 and ends at 1', () => {
  const values = sampleSpring(spring.moderate);
  assert.equal(values[0], 0);
  assert.equal(values[values.length - 1], 1);
});

test('a critical spring is monotonic', () => {
  const values = sampleSpring(spring.moderate);
  for (let i = 1; i < values.length; i += 1) {
    assert.ok(
      (values[i] as number) >= (values[i - 1] as number),
      `sample ${i} went backwards`,
    );
  }
});

test('the slow tier overshoots by about its bounce', () => {
  const values = sampleSpring(spring.slow);
  const peak = Math.max(...values);
  assert.ok(peak > 1.1, `peak ${peak} should overshoot past 10%`);
  assert.ok(peak < 1.15, `peak ${peak} should stay near 12%`);
});

test('the damping ratio maps bounce to overshoot', () => {
  assert.equal(dampingRatio(0), 1);
  assert.ok(dampingRatio(0.12) < 1);
  assert.ok(dampingRatio(0.12) > 0.5);
});

test('progress is 0 before the start and approaches 1 at the end', () => {
  assert.equal(springProgress(spring.fast, 0), 0);
  assert.ok(springProgress(spring.fast, spring.fast.duration) > 0.99);
});

test('a spring easing is a CSS linear() function', () => {
  const easing = springEasing(spring.fast);
  assert.ok(easing.startsWith('linear('));
  assert.ok(easing.endsWith(')'));
  assert.ok(easing.includes('%'));
});

test('every tier produces an enter and an exit easing', () => {
  const easings = springEasings();
  for (const tier of springTiers) {
    assert.ok(easings[tier].enter.startsWith('linear('));
    assert.ok(easings[tier].exit.includes('cubic-bezier'));
  }
});

test('an exit is a tween, never a spring', () => {
  // A `linear()` stop list cannot carry a time, so an exit cannot be one.
  for (const tier of springTiers) {
    assert.ok(!springEasings()[tier].exit.startsWith('linear('));
  }
});

test('every exit is faster than its entrance', () => {
  for (const tier of springTiers) {
    assert.ok(
      spring[tier].exit.duration < spring[tier].duration,
      `${tier} exit should be quicker than its entrance`,
    );
  }
});
