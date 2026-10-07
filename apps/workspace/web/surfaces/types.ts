import type { SurfaceInfo, SurfaceVariant } from '../../shared/surfaces.ts';

/**
 * What every surface view receives. `info` is undefined while the index loads
 * or after the surface closed; views show a quiet empty state then.
 * card: a canvas card (small, fills its box) · panel: a work-panel tab · full: the whole main area.
 */
export interface SurfaceViewProps {
  id: string;
  info: SurfaceInfo | undefined;
  variant: SurfaceVariant;
}
