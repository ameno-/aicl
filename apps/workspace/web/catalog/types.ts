import type { ComponentType } from 'react';

/**
 * A renderer for one catalog entry (see shared/components.ts). It receives the
 * raw JSON props the agent or user stored on the shape and must render
 * something sensible for any input: normalise, show a friendly empty state,
 * never throw.
 */
export interface ComponentRendererProps {
  props: Record<string, unknown>;
  width: number;
  height: number;
}

export type ComponentRenderer = ComponentType<ComponentRendererProps>;
