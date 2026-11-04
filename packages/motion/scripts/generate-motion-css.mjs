/**
 * Writes `packages/motion/src/motion.css` from the spring tokens.
 *
 * The CSS and the TypeScript must agree: a stylesheet that ships one curve
 * while the JavaScript ships another is the kind of drift nobody notices
 * until two parts of the same interface move at different speeds. The CSS is
 * therefore generated, and `npm test` fails when the committed copy is stale.
 *
 *   node packages/motion/scripts/generate-motion-css.mjs
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { spring, springProgress, springTiers } from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', 'src', 'motion.css');

/** The critical shape and the one overshooting shape, sampled once each. */
function shapeEasing(spec, samples = 48) {
  const values = [];
  for (let i = 0; i < samples; i += 1) {
    const t = (i / (samples - 1)) * spec.duration;
    values.push(springProgress(spec, t));
  }
  values[0] = 0;
  values[values.length - 1] = 1;
  const stops = values.map((value, i) => {
    const rounded = Math.round(value * 10000) / 10000;
    const percent = Math.round((i / (values.length - 1)) * 10000) / 100;
    return i === 0 ? '0' : `${rounded} ${percent}%`;
  });
  return `linear(${stops.join(', ')})`;
}

const critical = shapeEasing(spring.moderate);
const bouncy = shapeEasing(spring.slow);

const ms = (seconds) => `${Math.round(seconds * 1000)}ms`;

/** An exit is a plain tween, one tier quicker than its entrance. */
const exitEasing = 'cubic-bezier(0.4, 0, 1, 1)';

const css = `/**
 * The AICL motion system.
 *
 * Three spring tiers, and the rule that picks between them: the bigger the
 * thing that moves, the slower the spring. A hover highlight, a focus ring
 * and a tooltip move a few pixels; a dropdown indicator travels; a dialog
 * takes over the view. Nothing invents its own duration.
 *
 * The springs are real springs, encoded as CSS \`linear()\` easing functions.
 * A \`linear()\` stop list is not clamped to [0, 1], so the slow tier's
 * overshoot survives the trip. The curves are generated from the tokens in
 * \`src/springs.ts\` by \`scripts/generate-motion-css.mjs\`; the TypeScript is
 * the source of truth.
 *
 * Import this **after** \`@aicl/styles\`:
 *
 *   import '@aicl/styles';
 *   import '@aicl/motion/motion.css';
 *
 * It replaces the contract's easings with springs, so a stylesheet that says
 * \`transition: opacity var(--aicl-anim) var(--aicl-ease)\` becomes a spring
 * without a single line changing. It also adds the two interaction patterns
 * that need more than a duration: the travelling hover highlight, and weight
 * without reflow.
 */

/* ─── Tokens ────────────────────────────────────────────────────── */

:root {
  /* The shape of a critically damped spring: arrives once, stays. */
  --aicl-ease-spring: ${critical};

  /* The shape of the one tier that overshoots. */
  --aicl-ease-spring-bounce: ${bouncy};

  /* The contract's easings, replaced. These are the names existing
     stylesheets already use, so this is the whole upgrade. */
  --aicl-ease: var(--aicl-ease-spring);
  --aicl-ease-out: var(--aicl-ease-spring-bounce);
  --aicl-ease-in: ${exitEasing};

  /* The tiers, as one shorthand each: duration and shape together, so a
     component cannot pick a slow duration and a fast shape by accident.
     The contract's \`--aicl-anim-*\` names stay durations. */
  --aicl-motion-fast: ${ms(spring.fast.duration)} var(--aicl-ease-spring);
  --aicl-motion-moderate: ${ms(spring.moderate.duration)} var(--aicl-ease-spring);
  --aicl-motion-slow: ${ms(spring.slow.duration)} var(--aicl-ease-spring-bounce);

  /* Exits. Always a tween, always one tier quicker than the entrance it
     belongs to, so a dismissal reads as crisp and final rather than as the
     entrance replayed. */
  --aicl-motion-fast-exit: ${ms(spring.fast.exit.duration)} var(--aicl-ease-in);
  --aicl-motion-moderate-exit: ${ms(spring.moderate.exit.duration)} var(--aicl-ease-in);
  --aicl-motion-slow-exit: ${ms(spring.slow.exit.duration)} var(--aicl-ease-in);

  /* Font weight tokens for weight without reflow. Each pairs a \`wght\` with
     an \`opsz\` so the advance width barely changes when the weight does:
     a heavier weight widens the glyphs and a tighter optical size pulls them
     back. Needs a variable font with both axes. */
  --aicl-weight-normal: 'wght' 400, 'opsz' 14;
  --aicl-weight-medium: 'wght' 500, 'opsz' 16;
  --aicl-weight-semibold: 'wght' 550, 'opsz' 18;
  --aicl-weight-bold: 'wght' 700, 'opsz' 25;
}

/* ─── Fluid hover ───────────────────────────────────────────────── */

/* One highlight per list. It travels under the cursor instead of blinking
   between rows, so the user sees where a click will land before they click.
   The travel is a transform, so it stays on the compositor and reduced
   motion can drop it for free. */
[data-aicl-fluid-hover] {
  background: var(--aicl-hover-bg);
  border-radius: var(--aicl-radius-sm);
  transition:
    transform var(--aicl-motion-fast),
    width var(--aicl-motion-fast),
    height var(--aicl-motion-fast),
    opacity var(--aicl-motion-fast);
}

/* A fresh entry lands on the row it is on rather than sliding over from
   wherever the highlight was last. */
[data-aicl-fluid-hover][data-snap] {
  transition: opacity var(--aicl-motion-fast);
}

/* ─── Weight without reflow ─────────────────────────────────────── */

/* The ghost span reserves the width at the heaviest weight the label can
   take. The visible copy changes weight inside that reserved space, so no
   neighbour moves. */
[data-aicl-weight] {
  display: inline-grid;
  position: relative;
}

[data-aicl-weight] > * {
  grid-area: 1 / 1;
}

[data-aicl-weight-ghost] {
  visibility: hidden;
  font-variation-settings: var(--aicl-weight-semibold);
}

[data-aicl-weight-text] {
  font-variation-settings: var(--aicl-weight-normal);
  transition: font-variation-settings var(--aicl-motion-fast);
}

[data-aicl-weight-text][data-weight='medium'] {
  font-variation-settings: var(--aicl-weight-medium);
}

[data-aicl-weight-text][data-weight='semibold'] {
  font-variation-settings: var(--aicl-weight-semibold);
}

[data-aicl-weight-text][data-weight='bold'] {
  font-variation-settings: var(--aicl-weight-bold);
}

/* ─── Reduced motion ────────────────────────────────────────────── */

/* Fewer and gentler, not none. Opacity and colour keep their fades — they
   help comprehension — but the travel is dropped, so the highlight lands
   where it belongs instead of gliding there. */
@media (prefers-reduced-motion: reduce) {
  [data-aicl-fluid-hover] {
    transition: opacity var(--aicl-motion-fast) var(--aicl-ease-in);
  }

  [data-aicl-weight-text] {
    transition: none;
  }
}
`;

await writeFile(target, css, 'utf8');
console.log(`wrote ${target}`);
console.log(`tiers: ${springTiers.join(', ')}`);
