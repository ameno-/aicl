/**
 * Springs as CSS `linear()` easing functions.
 *
 * A spring is not a curve you can name — it is a physical response whose
 * shape depends on its damping. But CSS can express one: `linear()` takes a
 * list of stops and interpolates between them, and its output is not clamped
 * to `[0, 1]`, so an overshoot survives the trip.
 *
 * That means the whole motion system ships as plain CSS. No animation
 * runtime, no JavaScript on the critical path, and the same easing in a
 * stylesheet, a `transition`, and a Web Animations call.
 *
 * The sampler below models a damped harmonic oscillator driven to a target
 * of 1:
 *
 *   x(t) = 1 - e^(-ζωt) · (cos(ω_d t) + (ζω / ω_d) · sin(ω_d t))
 *
 * with `ζ` the damping ratio, `ω` the natural frequency and `ω_d` the damped
 * frequency. `ζ = 1` is critical damping — it arrives once and stays. `ζ < 1`
 * overshoots by exactly the tier's `bounce` fraction, because the damping
 * ratio is derived from it rather than the other way round.
 */

import { spring, springTiers, type SpringSpec, type SpringTier } from './springs.js';

/**
 * The damping ratio that produces a given overshoot.
 *
 * `bounce: 0` is critical damping (ζ = 1): the response never passes the
 * target. `bounce: 0.12` peaks 12% past it, which is ζ ≈ 0.56. Larger
 * values approach a bouncing ball (ζ → 0).
 */
export function dampingRatio(bounce: number): number {
  if (bounce <= 0) return 1;
  const l = Math.log(bounce);
  return -l / Math.sqrt(Math.PI * Math.PI + l * l);
}

/**
 * The natural frequency for a spring of a given duration.
 *
 * The response must be settled by the end of the duration, so ω is chosen so
 * the decaying envelope has fallen to 0.1% of its initial size at `t =
 * duration`. Critical damping is tighter than that envelope bound implies —
 * its error is `(1 + ωt)·e^(-ωt)` — so it gets a larger constant that lands
 * the response at 0.1% error exactly when the duration says it should.
 */
export function naturalFrequency(spec: SpringSpec): number {
  const zeta = dampingRatio(spec.bounce);
  if (zeta >= 1) return 9.1182 / spec.duration;
  return 6.9078 / (zeta * spec.duration);
}

/**
 * The spring's progress at time `t` (seconds since the start), as a number
 * that reaches 1 at the target. May exceed 1 while overshooting.
 */
export function springProgress(spec: SpringSpec, t: number): number {
  const omega = naturalFrequency(spec);
  const zeta = dampingRatio(spec.bounce);

  if (t <= 0) return 0;

  if (zeta >= 1) {
    // Critically damped: no oscillation, monotonic approach.
    return 1 - (1 + omega * t) * Math.exp(-omega * t);
  }

  const omegaD = omega * Math.sqrt(1 - zeta * zeta);
  const envelope = Math.exp(-zeta * omega * t);
  return (
    1 -
    envelope * (Math.cos(omegaD * t) + ((zeta * omega) / omegaD) * Math.sin(omegaD * t))
  );
}

/** The number of stops a spring is sampled at. */
const DEFAULT_SAMPLES = 48;

/**
 * Sample a spring into progress values, evenly spaced over its duration.
 * The first sample is 0 and the last is 1.
 */
export function sampleSpring(spec: SpringSpec, samples = DEFAULT_SAMPLES): number[] {
  const count = Math.max(2, samples);
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = (i / (count - 1)) * spec.duration;
    out.push(springProgress(spec, t));
  }
  out[0] = 0;
  out[out.length - 1] = 1;
  return out;
}

/**
 * Render a spring as a CSS `linear()` easing function.
 *
 * The stops are the sampled progress values; the percentages are the
 * normalised times. Values are rounded to four decimals, which is well
 * under what the eye resolves and keeps the emitted CSS short.
 */
export function springEasing(spec: SpringSpec, samples = DEFAULT_SAMPLES): string {
  const values = sampleSpring(spec, samples);
  const stops = values.map((value, i) => {
    const rounded = Math.round(value * 10000) / 10000;
    const percent = Math.round((i / (values.length - 1)) * 10000) / 100;
    return i === 0 ? '0' : `${rounded} ${percent}%`;
  });
  return `linear(${stops.join(', ')})`;
}

/**
 * The CSS easing for every tier, ready to be written into a stylesheet.
 *
 * `exit` is a plain tween at the exit duration — the exit of a spring is not
 * a spring, and it is one tier quicker than the entrance it belongs to.
 */
export function springEasings(): Record<SpringTier, { enter: string; exit: string }> {
  const out = {} as Record<SpringTier, { enter: string; exit: string }>;
  for (const tier of springTiers) {
    out[tier] = {
      enter: springEasing(spring[tier]),
      exit: exitEasing,
    };
  }
  return out;
}

/**
 * The easing of an exit.
 *
 * A tween, not a spring: a dismissal should read as crisp and final rather
 * than as the entrance replayed. A `linear()` stop list cannot express this,
 * because `linear()` accepts numbers and percentages but never a time.
 */
export const exitEasing = 'cubic-bezier(0.4, 0, 1, 1)';
