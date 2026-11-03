/**
 * The spring tiers every AICL surface moves on.
 *
 * Three tiers, and the rule that picks between them: **the bigger the thing
 * that moves, the slower the spring.** A hover highlight, a focus ring and a
 * tooltip move a few pixels and settle almost immediately. A dropdown
 * indicator travels. A dialog takes over the view. Nothing invents its own
 * duration — it reaches for a tier, so unrelated parts of the interface move
 * at consistent magnitudes.
 *
 * Each tier carries its own exit. An exit is a plain tween one tier quicker,
 * never the entrance played backwards: a dismissal should read as crisp and
 * final, not as the entrance replayed. Every enter/exit pair below is
 * constructed so the exit is always faster than the enter it belongs to.
 */

export type SpringTier = 'fast' | 'moderate' | 'slow';

/** A spring's shape. `duration` is the settle time in seconds. */
export interface SpringSpec {
  /** Time to settle, in seconds. */
  readonly duration: number;
  /**
   * Overshoot as a fraction: `0` never passes the target, `0.12` peaks 12%
   * past it. Only the largest tier overshoots at all.
   */
  readonly bounce: number;
}

export interface SpringTierSpec extends SpringSpec {
  /** The matching exit: a tween, one tier quicker than the entrance. */
  readonly exit: { readonly duration: number };
}

export const spring = {
  /**
   * 0.08s — hovers, focus rings, fades, tooltips, selection indicators.
   * The smallest travel and the shortest settle.
   */
  fast: {
    duration: 0.08,
    bounce: 0,
    exit: { duration: 0.06 },
  },
  /**
   * 0.16s — indicators that travel: dropdown and tab pills, switch thumbs,
   * panels and drawers that must land exactly, without a wobble.
   */
  moderate: {
    duration: 0.16,
    bounce: 0,
    exit: { duration: 0.12 },
  },
  /**
   * 0.24s — large surfaces: dialogs, side panels, stepped flows. The only
   * tier that overshoots, and only just.
   */
  slow: {
    duration: 0.24,
    bounce: 0.12,
    exit: { duration: 0.16 },
  },
} as const satisfies Record<SpringTier, SpringTierSpec>;

export const springTiers: readonly SpringTier[] = ['fast', 'moderate', 'slow'];

/** The spec of one tier. */
export function springSpec(tier: SpringTier): SpringTierSpec {
  return spring[tier];
}

/**
 * The fallback delay for a deferred unmount that guards an exit animation.
 *
 * A surface that animates out needs to stay mounted until the animation
 * ends, but a throttled or backgrounded tab can stall the animation
 * indefinitely. A timer force-removes the surface after the exit duration
 * plus a safety buffer. Deriving it from the token keeps the timer in step
 * with the motion instead of drifting from it.
 */
export function exitFallbackMs(tier: SpringTier): number {
  return Math.round(spring[tier].exit.duration * 1000) + 100;
}
