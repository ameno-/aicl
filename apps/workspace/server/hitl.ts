/**
 * Wave 2, work package A — human in the loop: ask_user tool, approval gate, /api/hitl.
 * CONTRACT: shared/agentic.ts + server/feature.ts. A implements; main.ts already mounts it.
 */
import { emptyFeature, type FeatureContext, type FeatureModule } from './feature.ts';

export function createHitl(context: FeatureContext): FeatureModule {
  void context;
  return emptyFeature();
}
