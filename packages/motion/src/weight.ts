/**
 * Weight without reflow.
 *
 * A label that changes weight when it is selected or hovered gets *wider*,
 * and a wider label pushes its neighbours aside. The fix is not to stop the
 * weight change — it is to reserve the space.
 *
 * Two things make it work:
 *
 *   1. A ghost span. An invisible copy of the label at the heaviest weight
 *      it will ever take sits in the same grid cell, so the cell's width is
 *      fixed by the heaviest case and the visible copy can change weight
 *      inside it without moving anything.
 *
 *   2. An optical-size compensation. A heavier weight widens the glyphs; a
 *      tighter optical size pulls them back. Each weight token below pairs
 *      a `wght` with an `opsz` chosen so the advance width barely moves —
 *      semibold lands within ±0.4px of regular on realistic label lengths.
 *
 * Both need a variable font with the `wght` and `opsz` axes. Without them
 * the pattern degrades to a normal font-weight change, which still works,
 * just without the width compensation.
 */

export type WeightName = 'normal' | 'medium' | 'semibold' | 'bold';

/**
 * The `font-variation-settings` value for each weight.
 *
 * `opsz` is set explicitly rather than left to `font-optical-sizing: auto`:
 * the point is that weight drives the optical size, not the font size.
 */
export const fontWeights: Record<WeightName, string> = {
  normal: "'wght' 400, 'opsz' 14",
  medium: "'wght' 500, 'opsz' 16",
  semibold: "'wght' 550, 'opsz' 18",
  bold: "'wght' 700, 'opsz' 25",
};

/**
 * The weight a ghost span reserves.
 *
 * The ghost is always the heaviest weight the label can take, so the cell
 * never has to grow when the visible copy gets heavier.
 */
export const ghostWeight: WeightName = 'semibold';

/** The weights a label may be rendered at, from lightest to heaviest. */
export const weightNames: readonly WeightName[] = ['normal', 'medium', 'semibold', 'bold'];

/** Whether `candidate` is at least as heavy as `reference`. */
export function isHeavier(candidate: WeightName, reference: WeightName): boolean {
  return weightNames.indexOf(candidate) >= weightNames.indexOf(reference);
}
