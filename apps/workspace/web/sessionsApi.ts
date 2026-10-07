/**
 * Session hooks for the browser (shared/runtime.ts, work package A).
 *
 * The server owns the conversations (persisted Pi sessions). Here: the list
 * (GET /api/sessions, kept live by 'session' / 'session-removed' server
 * events), one ChatController per session (history seeded from
 * GET /api/sessions/:id/messages), and the active-session choice.
 */
import { useSyncExternalStore } from 'react';
import { ChatController, createSseTransport, type Message } from '@aicl/core';
import { MAIN_SESSION_ID, type SessionInfo } from '../shared/runtime.ts';
import { toasts, useControllerChat, withCanvasContext, type WorkspaceChat } from './chatStore.ts';
import { onServerEvent } from './events.ts';

/** A tiny external store: a value, listeners, and a hook. */
function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      for (const l of [...listeners]) l();
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

/* ── Session list ─────────────────────────────────────────────────── */

const MAIN: SessionInfo = { id: MAIN_SESSION_ID, title: 'Main', createdAt: 0, updatedAt: 0, status: 'idle', kind: 'chat' };
const list = createStore<SessionInfo[]>([MAIN]);
let started = false;

const byRecent = (a: SessionInfo, b: SessionInfo) => b.updatedAt - a.updatedAt;

function upsert(session: SessionInfo): void {
  const rest = list.get().filter((s) => s.id !== session.id && !(s === MAIN && session.id === MAIN_SESSION_ID));
  list.set([...rest, session].sort(byRecent));
}

/** Loads the list once and keeps it live. Idempotent; every hook calls it. */
function start(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  onServerEvent('session', (e) => upsert(e.session));
  onServerEvent('session-removed', (e) => {
    list.set(list.get().filter((s) => s.id !== e.id));
    holders.delete(e.id);
    if (activeId.get() === e.id) setActiveSession(MAIN_SESSION_ID);
  });
  void fetch('/api/sessions')
    .then((r) => r.json() as Promise<{ sessions: SessionInfo[] }>)
    .then(({ sessions }) => {
      // Merge rather than replace: a 'session' event may have arrived first.
      const known = new Map(sessions.map((s) => [s.id, s]));
      for (const s of list.get()) if (s !== MAIN && !known.has(s.id)) known.set(s.id, s);
      list.set([...known.values()].sort(byRecent));
      if (!known.has(activeId.get())) setActiveSession(MAIN_SESSION_ID);
    })
    .catch(() => {
      started = false;
    });
}

export function useSessions(): SessionInfo[] {
  start();
  return useSyncExternalStore(list.subscribe, list.get, list.get);
}

/* ── Active session ───────────────────────────────────────────────── */

const STORAGE_KEY = 'aicl.activeSession';
const readStored = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY) || MAIN_SESSION_ID;
  } catch {
    return MAIN_SESSION_ID;
  }
};
const activeId = createStore<string>(readStored());

export function getActiveSessionId(): string {
  return activeId.get();
}

export function setActiveSession(id: string): void {
  if (id === activeId.get()) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage unavailable: the choice just won't survive a reload.
  }
  activeId.set(id);
}

export function useActiveSessionId(): string {
  start();
  return useSyncExternalStore(activeId.subscribe, activeId.get, activeId.get);
}

/** Creates a session and makes it active; resolves to its id. */
export async function createSession(options: { title?: string; kind?: SessionInfo['kind'] } = {}): Promise<string> {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!res.ok) throw new Error(`Could not create a chat (${res.status})`);
  const { session } = (await res.json()) as { session: SessionInfo };
  holders.set(session.id, makeHolder(session.id, []));
  upsert(session);
  setActiveSession(session.id);
  return session.id;
}

export async function renameSession(id: string, title: string): Promise<void> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (res.ok) upsert(((await res.json()) as { session: SessionInfo }).session);
}

export async function deleteSession(id: string): Promise<void> {
  if (id === MAIN_SESSION_ID) return;
  const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) return;
  list.set(list.get().filter((s) => s.id !== id));
  holders.delete(id);
  if (activeId.get() === id) setActiveSession(MAIN_SESSION_ID);
}

/* ── Conversations ────────────────────────────────────────────────── */

interface Holder {
  /** What renders now: an empty placeholder until history has loaded. */
  controller: ChatController;
  ready: Promise<void>;
  isReady: boolean;
  store: ReturnType<typeof createStore<ChatController>>;
}

const holders = new Map<string, Holder>();
/** Never sent on: shown for the moment between selecting a stored session and its history arriving. */
const placeholder = new ChatController({ transport: createSseTransport({ url: '/api/chat' }) });

function makeController(sessionId: string, initialMessages: Message[]): ChatController {
  return new ChatController({
    transport: createSseTransport({
      url: '/api/chat',
      fetch: withCanvasContext(() => {
        const staged = takePendingContext();
        return staged.length ? { context: staged.map(({ label, text }) => ({ label, text })) } : {};
      }),
    }),
    body: { sessionId },
    initialMessages,
    onError: (e) => toasts.push({ title: 'The agent stopped', description: e.message, variant: 'error' }),
  });
}

function makeHolder(sessionId: string, initial: Message[] | null): Holder {
  if (initial) {
    const store = createStore(makeController(sessionId, initial));
    return { controller: store.get(), ready: Promise.resolve(), isReady: true, store };
  }
  const store = createStore(placeholder);
  const holder: Holder = { controller: placeholder, ready: Promise.resolve(), isReady: false, store };
  holder.ready = fetch(`/api/sessions/${encodeURIComponent(sessionId)}/messages`)
    .then((r) => (r.ok ? (r.json() as Promise<{ messages: Message[] }>) : { messages: [] }))
    .catch(() => ({ messages: [] as Message[] }))
    .then(({ messages }) => {
      holder.controller = makeController(sessionId, messages);
      holder.isReady = true;
      store.set(holder.controller);
    });
  return holder;
}

function holderFor(sessionId: string): Holder {
  let h = holders.get(sessionId);
  if (!h) holders.set(sessionId, (h = makeHolder(sessionId, null)));
  return h;
}

/** The live conversation for `sessionId` (defaults to the active session). */
export function useSessionChat(sessionId?: string): WorkspaceChat {
  start();
  const active = useSyncExternalStore(activeId.subscribe, activeId.get, activeId.get);
  const id = sessionId ?? active;
  const holder = holderFor(id);
  const controller = useSyncExternalStore(holder.store.subscribe, holder.store.get, holder.store.get);
  return useControllerChat(controller, async (text) => {
    await holder.ready;
    await holder.controller.send(text);
  });
}

/** Send a user message to a session without rendering it (applet intents, CLI-like callers). */
export function sendToSession(text: string, sessionId?: string): void {
  start();
  const holder = holderFor(sessionId ?? activeId.get());
  void holder.ready
    .then(() => holder.controller.send(text))
    .catch((e: unknown) =>
      toasts.push({ title: 'Could not send', description: e instanceof Error ? e.message : String(e), variant: 'error' }),
    );
}

/** Kept for callers of the starter implementation; per-session controllers need no registration. */
export function registerSender(handler: (text: string) => void): () => void {
  void handler;
  return () => {};
}

/* ── Pending context (chips above the composer) ───────────────────── */

export interface PendingContext {
  id: string;
  label: string;
  text: string;
}

const pending = createStore<PendingContext[]>([]);
let pendingSeq = 0;

/** Stage context for the next message; ChatPanel shows it as chips and sends it with the prompt. */
export function addPendingContext(context: { label: string; text: string }): void {
  pending.set([...pending.get(), { id: `ctx-${Date.now()}-${pendingSeq++}`, ...context }]);
}

export function removePendingContext(id: string): void {
  pending.set(pending.get().filter((p) => p.id !== id));
}

/**
 * Takes the staged context. The chat transport sends it as a `context` field
 * beside the message; the server folds it into the hidden <canvas-context>
 * block, so it never appears in the transcript or in reloaded history.
 */
export function takePendingContext(): PendingContext[] {
  const taken = pending.get();
  if (taken.length) pending.set([]);
  return taken;
}

export function usePendingContext(): PendingContext[] {
  return useSyncExternalStore(pending.subscribe, pending.get, pending.get);
}
