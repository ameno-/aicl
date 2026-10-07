import { useSyncExternalStore } from 'react';

/**
 * Which element inside which screen the user has selected. The screen
 * renderer writes it (click in select mode); the chat reads it and sends it
 * to the agent as context, so "make this denser" has a referent.
 */
export interface UiSelection {
  /** tldraw shape id of the screen (aicl-component with component "screen"). */
  shapeId: string;
  /** UiNode id inside that screen's spec. */
  nodeId: string;
}

let current: UiSelection | null = null;
const listeners = new Set<() => void>();

export function getUiSelection(): UiSelection | null {
  return current;
}

export function setUiSelection(next: UiSelection | null): void {
  if (current?.shapeId === next?.shapeId && current?.nodeId === next?.nodeId) return;
  current = next;
  for (const l of [...listeners]) l();
}

export function subscribeUiSelection(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUiSelection(): UiSelection | null {
  return useSyncExternalStore(subscribeUiSelection, getUiSelection, getUiSelection);
}
