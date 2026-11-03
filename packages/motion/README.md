# `@aicl/motion`

The motion and interaction system for AICL surfaces.

Three spring tiers, the travelling hover highlight, and weight without
reflow. No framework dependency, no animation runtime, and no DOM at import
time. The React bindings live in `@aicl/motion/react`.

The design and the reasons behind it are in
[`docs/DESIGN-SYSTEM.md`](../../docs/DESIGN-SYSTEM.md).

## Install

```bash
npm install @aicl/motion
```

```tsx
import '@aicl/styles';
import '@aicl/motion/motion.css';
```

The stylesheet redefines the contract's easings as springs. Your existing
`transition: opacity var(--aicl-anim) var(--aicl-ease)` becomes a spring
without a line changing.

## Springs, not durations

Three tiers, and the rule that picks between them: **the bigger the thing
that moves, the slower the spring.**

| Tier | Duration | Overshoot | For |
|---|---|---|---|
| `fast` | 80 ms | — | hovers, focus rings, tooltips, selection indicators |
| `moderate` | 160 ms | — | indicators that travel: tab pills, switch thumbs, drawers |
| `slow` | 240 ms | 12% | surfaces that take over the view: dialogs, side panels |

```ts
import { spring, exitFallbackMs } from '@aicl/motion';

spring.fast.duration;      // 0.08
spring.slow.bounce;        // 0.12
exitFallbackMs('slow');    // 260
```

**An exit is its own token.** An exit is a plain tween, one tier quicker than
the entrance it belongs to, so a dismissal reads as crisp and final rather
than as the entrance replayed.

```ts
spring.fast.exit.duration;    // 0.06
spring.moderate.exit.duration; // 0.12
spring.slow.exit.duration;     // 0.16
```

### As CSS

The springs are real springs, encoded as CSS `linear()` easing functions. A
`linear()` stop list is not clamped to `[0, 1]`, so the slow tier's
overshoot survives the trip.

```ts
import { springEasing } from '@aicl/motion';

springEasing(spring.slow);
// linear(0, 0.0312 2.13%, 0.112 4.26%, … 1 100%)
```

`src/motion.css` is generated from the tokens by
`scripts/generate-motion-css.mjs`. A test fails when the committed
stylesheet drifts from the tokens, so the CSS and the TypeScript can never
disagree about how fast something moves.

```bash
node packages/motion/scripts/generate-motion-css.mjs
```

## Fluid hover

One highlight per list. It glides from item to item under the cursor instead
of blinking between rows, so the user sees where a click will land before
they click.

```tsx
import { useFluidHover, FluidHoverHighlight } from '@aicl/motion/react';

function List({ items }: { items: string[] }) {
  const hover = useFluidHover();

  return (
    <div style={{ position: 'relative' }} {...hover.handlers} ref={hover.containerRef}>
      {items.map((item, index) => (
        <div
          key={item}
          ref={(el) => hover.registerItem(index, el)}
          style={{ padding: '8px 12px' }}
        >
          {item}
        </div>
      ))}
      <FluidHoverHighlight hover={hover} />
    </div>
  );
}
```

The rule is one pure function, and it is kept pure so it can be tested
without a browser:

1. An item the pointer is inside wins.
2. Otherwise the item whose centre is nearest wins, along the list's axis
   (`y` for a list, `x` for a strip, `xy` for a grid).
3. Disabled items are skipped but keep their slot.
4. Ties keep the earlier item.

```ts
import { pickNearest } from '@aicl/motion';

pickNearest({ x: 50, y: 42 }, rects, { axis: 'y' });
```

A click that lands in the gap between items is routed to the item that is
lit, so what is lit is what a click hits.

## Weight without reflow

A label that gets heavier when selected gets *wider*, and pushes its
neighbours. The fix is to reserve the space.

```tsx
import { WeightText } from '@aicl/motion/react';

<WeightText active={isSelected}>Transcript</WeightText>
```

Two things make it work:

1. **A ghost span.** An invisible copy of the label at the heaviest weight it
   will ever take sits in the same grid cell, so the cell's width is fixed by
   the heaviest case and the visible copy can change weight inside it.
2. **An optical-size compensation.** Each weight token pairs a `wght` with an
   `opsz` chosen so the advance width barely moves — semibold lands within
   ±0.4 px of regular on realistic label lengths.

Both need a variable font with the `wght` and `opsz` axes. Without them the
pattern degrades to an ordinary font-weight change, which still works, just
without the width compensation.

## Reduced motion

Fewer and gentler, not none. Opacity and colour keep their fades — they help
comprehension — but the travel is dropped, so the hover highlight lands where
it belongs instead of gliding there.

## Files

| File | What |
|---|---|
| `src/springs.ts` | The three tiers and their exits. The source of truth. |
| `src/easing.ts` | The spring sampler and the `linear()` encoder |
| `src/geometry.ts` | Fluid-hover geometry. Pure functions, no DOM. |
| `src/weight.ts` | The weight tokens and the optical-size compensation |
| `src/react.tsx` | `useFluidHover`, `FluidHoverHighlight`, `WeightText` |
| `src/motion.css` | Generated. The tokens, the hover overlay, the weight pattern. |
| `scripts/generate-motion-css.mjs` | Writes `src/motion.css` from the tokens |

## Tests

```bash
npm test --workspace @aicl/motion
```

24 tests: the spring sampler's shape and monotonicity, the overshoot, the
`linear()` output, the drift guard against the committed stylesheet, and the
fluid-hover geometry.
