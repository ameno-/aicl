/** Which app-level overlay is open (command menu, settings, shortcuts help). */
import { useSyncExternalStore } from 'react';

export type Overlay = 'palette' | 'settings' | 'shortcuts' | null;

let current: Overlay = null;
const listeners = new Set<() => void>();

export function setOverlay(next: Overlay): void {
  if (next === current) return;
  current = next;
  for (const l of [...listeners]) l();
}

export const getOverlay = (): Overlay => current;

export function useOverlay(): Overlay {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}
