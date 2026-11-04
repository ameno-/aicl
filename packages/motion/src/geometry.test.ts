import assert from 'node:assert/strict';
import { test } from 'node:test';

import { pickNearest, toLocalPoint, type Rect } from './geometry.js';

/** A vertical list of three 40px rows with a 4px gap between them. */
function rows(): Rect[] {
  return [
    { top: 0, left: 0, width: 100, height: 40 },
    { top: 44, left: 0, width: 100, height: 40 },
    { top: 88, left: 0, width: 100, height: 40 },
  ];
}

test('the item under the pointer wins', () => {
  const index = pickNearest({ x: 50, y: 50 }, rows());
  assert.equal(index, 1);
});

test('a pointer in the gap resolves to the nearest row', () => {
  // y = 42 is in the 4px gap between row 0 (ends at 40) and row 1 (starts at 44).
  const index = pickNearest({ x: 50, y: 42 }, rows());
  assert.equal(index, 0);
});

test('a pointer past the last row still resolves', () => {
  const index = pickNearest({ x: 50, y: 400 }, rows());
  assert.equal(index, 2);
});

test('a pointer in the container padding resolves to the nearest row', () => {
  const index = pickNearest({ x: 50, y: -30 }, rows());
  assert.equal(index, 0);
});

test('an empty set resolves to nothing', () => {
  assert.equal(pickNearest({ x: 0, y: 0 }, []), null);
});

test('unregistered slots are skipped', () => {
  const sparse: (Rect | undefined)[] = [rows()[0], undefined, rows()[2]];
  const index = pickNearest({ x: 50, y: 90 }, sparse);
  assert.equal(index, 2);
});

test('a disabled item is skipped but keeps its slot', () => {
  const disabled = new Set([1]);
  const index = pickNearest({ x: 50, y: 50 }, rows(), {
    isDisabled: (i) => disabled.has(i),
  });
  // Row 1 is disabled, so row 0 (nearest by centre) wins.
  assert.equal(index, 0);
});

test('the x axis measures horizontally', () => {
  const strip: Rect[] = [
    { top: 0, left: 0, width: 20, height: 40 },
    { top: 0, left: 44, width: 40, height: 40 },
  ];
  // x = 41 is in the gap between the two cells, so containment does not
  // decide and the axis does. Both cells share a y centre, so the y axis
  // ties and keeps the first.
  assert.equal(pickNearest({ x: 41, y: 20 }, strip, { axis: 'x' }), 1);
  assert.equal(pickNearest({ x: 41, y: 20 }, strip, { axis: 'y' }), 0);
});

test('an item the pointer is inside wins on every axis', () => {
  const strip: Rect[] = [
    { top: 0, left: 0, width: 40, height: 40 },
    { top: 0, left: 44, width: 40, height: 40 },
  ];
  assert.equal(pickNearest({ x: 46, y: 20 }, strip, { axis: 'y' }), 1);
});

test('ties keep the earlier item', () => {
  const pair: Rect[] = [
    { top: 0, left: 0, width: 10, height: 10 },
    { top: 20, left: 0, width: 10, height: 10 },
  ];
  // Exactly between the two centres.
  assert.equal(pickNearest({ x: 5, y: 15 }, pair), 0);
});

test('a viewport point converts into container-local coordinates', () => {
  const local = toLocalPoint({ x: 120, y: 80 }, {
    top: 30,
    left: 20,
    width: 200,
    height: 100,
  });
  assert.deepEqual(local, { x: 100, y: 50 });
});
