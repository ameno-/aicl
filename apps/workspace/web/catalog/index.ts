import type { ComponentRenderer } from './types.ts';

/**
 * Renderers keyed by catalog name (shared/components.ts). Filled in by the
 * catalog work package; the shape falls back to an "unknown component" notice
 * for any name missing here.
 */
export const renderers: Record<string, ComponentRenderer> = {};
