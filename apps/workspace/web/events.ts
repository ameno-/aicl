/**
 * The page's single connection to GET /api/events.
 *
 * There must be exactly one: the relay sends agent canvas ops to the most
 * recently connected client, so a second EventSource would steal them.
 * Everything that needs server events subscribes here.
 *
 * The connection heals itself: on error or close it reconnects with
 * exponential backoff (capped), and after every *re*connect it tells
 * subscribers (onReconnect) to refetch whatever they hold, since events
 * were missed while it was down.
 */
import { useSyncExternalStore } from 'react';
import type { ServerEvent } from '../shared/runtime.ts';
import type { ScratchOp } from '../shared/scratch.ts';

export type ScratchOpEvent = { type: 'scratch-op'; id: string; op: ScratchOp };
type AnyEvent = ServerEvent | ScratchOpEvent;
type Handler<T extends AnyEvent['type']> = (event: Extract<AnyEvent, { type: T }>) => void;

export type ConnectionState = 'connected' | 'reconnecting' | 'offline';

const handlers = new Map<string, Set<(e: AnyEvent) => void>>();
const reconnectHandlers = new Set<() => void>();
const stateListeners = new Set<() => void>();

const MAX_DELAY_MS = 10_000;
/** The server beats every 5s (server/relay.ts); this much silence means the connection is dead. */
const SILENCE_MS = 13_000;
let source: EventSource | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;
let lastSeen = 0;
let watchdog: ReturnType<typeof setInterval> | null = null;
let state: ConnectionState = 'connected';

function setState(next: ConnectionState): void {
  if (next === state) return;
  state = next;
  for (const l of [...stateListeners]) l();
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

function connect(): void {
  if (source || typeof EventSource === 'undefined') return;
  const es = new EventSource('/api/events');
  source = es;
  lastSeen = Date.now();
  watchdog ??= setInterval(() => {
    if (source && Date.now() - lastSeen > SILENCE_MS) reconnectNow();
  }, 3000);
  es.onopen = () => {
    lastSeen = Date.now();
    const wasDown = attempt > 0 || state !== 'connected';
    attempt = 0;
    setState('connected');
    if (wasDown) for (const h of [...reconnectHandlers]) safely(h);
  };
  es.onmessage = (message) => {
    lastSeen = Date.now();
    let event: AnyEvent;
    try {
      event = JSON.parse(message.data) as AnyEvent;
    } catch {
      return;
    }
    if ((event as { type: string }).type === 'heartbeat') return;
    handlers.get(event.type)?.forEach((h) => h(event));
  };
  es.onerror = () => {
    // Close ourselves so the browser's own (unbounded, fixed-delay) retry never runs beside ours.
    es.close();
    if (source === es) source = null;
    scheduleReconnect();
  };
}

/** Drops the current stream and starts over (backoff applies). Used when the connection is known or suspected dead. */
export function reconnectNow(): void {
  source?.close();
  source = null;
  if (timer) clearTimeout(timer);
  timer = null;
  scheduleReconnect();
}

function safely(fn: () => void): void {
  try {
    fn();
  } catch (cause) {
    console.warn('[aicl] reconnect handler failed', cause);
  }
}

function scheduleReconnect(): void {
  if (timer) return;
  setState(isOffline() ? 'offline' : 'reconnecting');
  const delay = Math.min(MAX_DELAY_MS, 500 * 2 ** attempt);
  attempt++;
  timer = setTimeout(() => {
    timer = null;
    connect();
  }, delay);
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    setState('offline');
    // A half-open socket can sit "connected" for a long time; drop it and retry when back.
    source?.close();
    source = null;
    if (timer) clearTimeout(timer);
    timer = null;
    scheduleReconnect();
  });
  window.addEventListener('online', () => {
    if (timer) clearTimeout(timer);
    timer = null;
    attempt = 0;
    setState('reconnecting');
    connect();
  });
}

/** Subscribe to one event type; returns an unsubscribe function. */
export function onServerEvent<T extends AnyEvent['type']>(type: T, handler: Handler<T>): () => void {
  connect();
  let set = handlers.get(type);
  if (!set) handlers.set(type, (set = new Set()));
  const h = handler as (e: AnyEvent) => void;
  set.add(h);
  return () => set!.delete(h);
}

/** Called after the event stream comes back from a drop: refetch state that events may have changed. */
export function onReconnect(handler: () => void): () => void {
  connect();
  reconnectHandlers.add(handler);
  return () => reconnectHandlers.delete(handler);
}

export function getConnectionState(): ConnectionState {
  return state;
}

function subscribeState(l: () => void): () => void {
  connect();
  stateListeners.add(l);
  return () => stateListeners.delete(l);
}

export function useConnectionState(): ConnectionState {
  return useSyncExternalStore(subscribeState, getConnectionState, getConnectionState);
}
