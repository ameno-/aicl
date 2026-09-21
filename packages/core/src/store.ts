/**
 * Minimal observable store. No dependencies, no framework, ~60 lines.
 *
 * Adapters bridge this to native reactivity (`useSyncExternalStore`, Svelte
 * runes, Vue `shallowRef`), so core never learns which framework is in use.
 */

import type { ReadableStore } from './types.js';

export interface WritableStore<T> extends ReadableStore<T> {
  set(value: T): void;
  update(fn: (current: T) => T): void;
}

export function createStore<T>(initial: T): WritableStore<T> {
  let value = initial;
  const listeners = new Set<(v: T) => void>();

  return {
    get: () => value,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      // Copy before iterating: a listener may unsubscribe during notification,
      // which would otherwise mutate the set mid-iteration.
      for (const listener of [...listeners]) listener(value);
    },

    update(fn) {
      this.set(fn(value));
    },
  };
}

/**
 * Batches synchronous writes into a single notification via microtask.
 *
 * A streaming turn emits many events per frame; without batching, each one
 * triggers a separate render pass. `useSyncExternalStore` deduplicates by
 * snapshot identity, not by frequency, so the batching has to happen here.
 */
export function batched<T>(store: WritableStore<T>): WritableStore<T> {
  const listeners = new Set<(v: T) => void>();
  let scheduled = false;

  store.subscribe(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const value = store.get();
      for (const listener of [...listeners]) listener(value);
    });
  });

  return {
    get: store.get,
    set: store.set,
    update: store.update,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Projects a slice of a store, notifying only when the slice changes. */
export function derived<T, U>(
  source: ReadableStore<T>,
  select: (value: T) => U,
  equals: (a: U, b: U) => boolean = Object.is,
): ReadableStore<U> {
  return {
    get: () => select(source.get()),
    subscribe(listener) {
      let previous = select(source.get());
      return source.subscribe((value) => {
        const next = select(value);
        if (equals(previous, next)) return;
        previous = next;
        listener(next);
      });
    },
  };
}
