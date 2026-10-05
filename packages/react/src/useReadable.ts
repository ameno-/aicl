import { useSyncExternalStore } from 'react';
import type { ReadableStore } from '@aicl/core';

/** Binds any core `ReadableStore` to React, tear-free. */
export function useReadable<T>(store: ReadableStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
