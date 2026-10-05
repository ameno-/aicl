/**
 * Toast queue: core owns the queue and timers, the adapter owns the region.
 * Timers are injectable so the queue is testable without real time.
 */

import { createStore } from './store.js';
import type { ReadableStore } from './types.js';

export type ToastVariant = 'info' | 'success' | 'error';

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** ms; `0` persists until dismissed. Errors with an action always persist. */
  duration?: number;
  action?: { label: string; onAction: () => void };
}

export interface ToastState extends ToastInput {
  id: string;
  variant: ToastVariant;
  paused: boolean;
}

export interface ToastQueue {
  state: ReadableStore<ToastState[]>;
  push(input: ToastInput): string;
  dismiss(id: string): void;
  pauseAll(): void;
  resumeAll(): void;
}

interface Clock {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  now(): number;
}

const realClock: Clock = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

export function createToastQueue(
  options: { maxVisible?: number; defaultDuration?: number; clock?: Clock } = {},
): ToastQueue {
  const maxVisible = options.maxVisible ?? 3;
  const defaultDuration = options.defaultDuration ?? 5000;
  const clock = options.clock ?? realClock;
  const store = createStore<ToastState[]>([]);
  const timers = new Map<string, { handle?: unknown; remaining: number; startedAt: number }>();
  let seq = 0;

  const schedule = (id: string) => {
    const t = timers.get(id);
    if (!t || t.remaining <= 0) return;
    t.startedAt = clock.now();
    t.handle = clock.setTimeout(() => queue.dismiss(id), t.remaining);
  };

  const queue: ToastQueue = {
    state: store,
    push(input) {
      const id = `toast-${++seq}`;
      const variant = input.variant ?? 'info';
      const persistent = variant === 'error' && input.action !== undefined;
      const duration = persistent ? 0 : (input.duration ?? defaultDuration);
      const toast: ToastState = { ...input, id, variant, paused: false };
      // FIFO overflow: the oldest visible toast leaves to make room.
      const current = store.get();
      const overflow = current.length >= maxVisible ? current.slice(0, current.length - maxVisible + 1) : [];
      for (const old of overflow) queue.dismiss(old.id);
      store.update((s) => [...s, toast]);
      timers.set(id, { remaining: duration, startedAt: clock.now() });
      schedule(id);
      return id;
    },
    dismiss(id) {
      const t = timers.get(id);
      if (t?.handle !== undefined) clock.clearTimeout(t.handle);
      timers.delete(id);
      store.update((s) => (s.some((x) => x.id === id) ? s.filter((x) => x.id !== id) : s));
    },
    pauseAll() {
      for (const t of timers.values()) {
        if (t.handle === undefined) continue;
        clock.clearTimeout(t.handle);
        t.handle = undefined;
        t.remaining -= clock.now() - t.startedAt;
      }
      store.update((s) => (s.every((x) => x.paused) ? s : s.map((x) => ({ ...x, paused: true }))));
    },
    resumeAll() {
      for (const [id, t] of timers) if (t.handle === undefined) schedule(id);
      store.update((s) => (s.some((x) => x.paused) ? s.map((x) => ({ ...x, paused: false })) : s));
    },
  };
  return queue;
}
