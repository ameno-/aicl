/**
 * Wave 2, work package E — canvas graph: /api/graph, canvas_graph tool, neighbourhood context.
 * CONTRACT: shared/agentic.ts + server/feature.ts. E implements; main.ts already mounts it.
 */
import { emptyFeature, type FeatureContext, type FeatureModule } from './feature.ts';

export function createGraph(context: FeatureContext): FeatureModule {
  void context;
  return emptyFeature();
}
