/**
 * Wave 2, work package C — agent nodes: agent_send, /api/nodes/:shapeId/run.
 * CONTRACT: shared/agentic.ts + server/feature.ts. C implements; main.ts already mounts it.
 */
import { emptyFeature, type FeatureContext, type FeatureModule } from './feature.ts';

export function createNodes(context: FeatureContext): FeatureModule {
  void context;
  return emptyFeature();
}
