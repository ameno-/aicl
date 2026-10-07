/**
 * The application's active provider kit (AICL-34). Persisted per browser;
 * every view that renders a conversation reads it.
 */
import { useSyncExternalStore } from 'react';
import { KITS, type KitId, type ProviderKit } from '../../shared/kits.ts';

const KEY = 'aicl.kit';
const listeners = new Set<() => void>();

const read = (): KitId => {
  try {
    const v = localStorage.getItem(KEY) as KitId | null;
    return v && v in KITS ? v : 'aicl';
  } catch {
    return 'aicl';
  }
};

let current: KitId = typeof window === 'undefined' ? 'aicl' : read();

export function setKit(id: KitId): void {
  if (!(id in KITS) || id === current) return;
  current = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* private mode: the choice lasts for this page */
  }
  for (const l of [...listeners]) l();
}

export function useKit(): ProviderKit {
  const id = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
  return KITS[id];
}
