/**
 * Surface service: terminal (wave 4, see shared/surfaces.ts). Stub until its package lands.
 */
import { emptyFeature, type FeatureModule } from '../feature.ts';
import type { SurfaceContext } from './context.ts';

export function createTerminalSurface(_context: SurfaceContext): FeatureModule {
  return emptyFeature();
}
