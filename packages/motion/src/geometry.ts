/**
 * Geometry for fluid hover.
 *
 * Fluid hover is one highlight per list. The highlight sits under the
 * pointer, and when the pointer moves to the next row it *travels* there
 * instead of blinking out and blinking in. The user sees where a click will
 * land before they click.
 *
 * The rule is small enough to be a pure function, and it is kept pure so it
 * can be tested without a browser:
 *
 *   1. An item the pointer is inside wins. Always, on every axis.
 *   2. Otherwise the item whose centre is nearest wins — along the list's
 *      axis for a list, in both axes for a grid. A pointer in the gap
 *      between two rows, in the container's padding, or past the last row
 *      still lands on something.
 *   3. Disabled items are skipped, but they stay in the set. A row that is
 *      mounted while clipped out of view keeps its slot, so removing it
 *      would invalidate every measurement.
 *   4. Ties keep the earlier item.
 */

/** A rectangle in container-local coordinates. */
export interface Rect {
  top: number;
  height: number;
  left: number;
  width: number;
}

/** A point in container-local coordinates. */
export interface Point {
  x: number;
  y: number;
}

/**
 * The axis a list resolves its nearest item along.
 *
 * `y` for vertical lists, `x` for horizontal strips, `xy` for grids, where
 * the straight line to each item's centre decides.
 */
export type HoverAxis = 'x' | 'y' | 'xy';

export interface PickNearestOptions {
  /** Defaults to `y`. */
  axis?: HoverAxis;
  /** Skips an item without removing it from the set. */
  isDisabled?: (index: number) => boolean;
}

/** The centre of a rectangle. */
export function centerOf(rect: Rect): Point {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/** Whether a point is inside a rectangle. */
export function containsPoint(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.left &&
    point.x < rect.left + rect.width &&
    point.y >= rect.top &&
    point.y < rect.top + rect.height
  );
}

/** The distance from a point to a rectangle's centre, along one axis or in a straight line. */
export function distanceToCenter(rect: Rect, point: Point, axis: HoverAxis): number {
  const center = centerOf(rect);
  if (axis === 'x') return Math.abs(point.x - center.x);
  if (axis === 'y') return Math.abs(point.y - center.y);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * The index of the item the pointer resolves to, or `null` when the set is
 * empty.
 *
 * `rects` is sparse: a slot for an item that has not registered yet is
 * `undefined` and is skipped.
 */
export function pickNearest(
  point: Point,
  rects: readonly (Rect | undefined)[],
  options: PickNearestOptions = {},
): number | null {
  const axis = options.axis ?? 'y';

  // 1. The item under the pointer wins.
  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i];
    if (!rect) continue;
    if (options.isDisabled?.(i)) continue;
    if (containsPoint(rect, point)) return i;
  }

  // 2. Otherwise the nearest centre.
  let bestIndex: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i];
    if (!rect) continue;
    if (options.isDisabled?.(i)) continue;
    const distance = distanceToCenter(rect, point, axis);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

/** A viewport point expressed in a container's local coordinates. */
export function toLocalPoint(point: Point, containerRect: Rect): Point {
  return {
    x: point.x - containerRect.left,
    y: point.y - containerRect.top,
  };
}
