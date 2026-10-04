/**
 * The one listbox contract behind `TriggerMenu`, `SessionSearch`, and `Select`
 * (D12). Keyboard and IME fixes land here once instead of in three ports.
 *
 * @internal Adapters bind it; consumers do not.
 */

import { createStore } from './store.js';
import type { ReadableStore } from './types.js';

export interface ComboboxState<I> {
  open: boolean;
  items: I[];
  activeIndex: number;
  query: string;
}

export interface ComboboxModel<I> {
  state: ReadableStore<ComboboxState<I>>;
  setItems(items: I[]): void;
  setQuery(query: string): void;
  open(): void;
  close(): void;
  /** Moves the active option, wrapping and skipping disabled items. */
  move(delta: 1 | -1): void;
  setActive(index: number): void;
  /** Returns the active item, if enabled, and closes. */
  accept(): I | undefined;
}

export function createComboboxModel<I>(options: { isDisabled?: (item: I) => boolean } = {}): ComboboxModel<I> {
  const isDisabled = options.isDisabled ?? (() => false);
  const store = createStore<ComboboxState<I>>({ open: false, items: [], activeIndex: -1, query: '' });

  const firstEnabled = (items: I[], from: number, step: 1 | -1): number => {
    const n = items.length;
    for (let i = 0; i < n; i++) {
      const index = (((from + step * i) % n) + n) % n;
      if (!isDisabled(items[index]!)) return index;
    }
    return -1;
  };

  return {
    state: store,
    setItems(items) {
      store.update((s) => {
        // Keep the active option when it survives filtering; else the first enabled.
        const current = s.items[s.activeIndex];
        const kept = current === undefined ? -1 : items.indexOf(current);
        const activeIndex = kept >= 0 && !isDisabled(items[kept]!) ? kept : firstEnabled(items, 0, 1);
        return { ...s, items, activeIndex };
      });
    },
    setQuery(query) {
      store.update((s) => (s.query === query ? s : { ...s, query }));
    },
    open() {
      store.update((s) => (s.open ? s : { ...s, open: true, activeIndex: firstEnabled(s.items, 0, 1) }));
    },
    close() {
      store.update((s) => (s.open ? { ...s, open: false } : s));
    },
    move(delta) {
      store.update((s) => {
        if (!s.items.length) return s;
        const from = s.activeIndex < 0 ? (delta === 1 ? 0 : s.items.length - 1) : s.activeIndex + delta;
        return { ...s, open: true, activeIndex: firstEnabled(s.items, from, delta) };
      });
    },
    setActive(index) {
      store.update((s) => {
        const item = s.items[index];
        if (item === undefined || isDisabled(item) || s.activeIndex === index) return s;
        return { ...s, activeIndex: index };
      });
    },
    accept() {
      const s = store.get();
      const item = s.items[s.activeIndex];
      if (item === undefined || isDisabled(item)) return undefined;
      store.set({ ...s, open: false });
      return item;
    },
  };
}
