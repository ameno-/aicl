/**
 * Wave 2, work package B — live plan (plan_update) and streaming terminal output.
 * CONTRACT: shared/agentic.ts + server/feature.ts. B implements; main.ts already mounts it.
 */
import { emptyFeature, type FeatureContext, type FeatureModule } from './feature.ts';

export function createLive(context: FeatureContext): FeatureModule {
  void context;
  return emptyFeature();
}
