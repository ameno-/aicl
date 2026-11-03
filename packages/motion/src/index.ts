/**
 * `@aicl/motion` — the motion and interaction system for AICL surfaces.
 *
 * Three spring tiers and their exits, the fluid-hover geometry, and the
 * weight tokens that keep a label from reflowing when it gets heavier.
 *
 * The package has no framework dependency and touches no DOM at import
 * time. The React bindings live in `@aicl/motion/react`.
 */

export {
  spring,
  springTiers,
  springSpec,
  exitFallbackMs,
  type SpringTier,
  type SpringSpec,
  type SpringTierSpec,
} from './springs.js';

export {
  dampingRatio,
  naturalFrequency,
  springProgress,
  sampleSpring,
  springEasing,
  springEasings,
  exitEasing,
} from './easing.js';

export {
  pickNearest,
  containsPoint,
  centerOf,
  distanceToCenter,
  toLocalPoint,
  type HoverAxis,
  type PickNearestOptions,
  type Point,
  type Rect,
} from './geometry.js';

export {
  fontWeights,
  ghostWeight,
  weightNames,
  isHeavier,
  type WeightName,
} from './weight.js';
