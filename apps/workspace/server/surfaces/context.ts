import type { FeatureContext } from '../feature.ts';
import type { SurfaceRegistry } from './registry.ts';

/** What every surface service gets: the feature context plus the shared index. */
export interface SurfaceContext extends FeatureContext {
  surfaces: SurfaceRegistry;
}
