/**
 * Session hooks for the browser (shared/runtime.ts, work package A).
 *
 * The server owns the conversations (persisted Pi sessions). Here: the list
 * (GET /api/sessions, kept live by 'session' / 'session-removed' server
 * events), one ChatController per session (history seeded from
 * GET /api/sessions/:id/messages), and the active-session choice.
 */
import { createContext, useContext, useSyncExternalStore } from 'react';
import { ChatController, createSseTransport, type ChatTransport, type Message } from '@aicl/core';
import { MAIN_SESSION_ID, type SessionInfo } from '../shared/runtime.ts';
import { toasts, useControllerChat, withCanvasContext, type WorkspaceChat } from './chatStore.ts';
import { onReconnect, onServerEvent, reconnectNow } from './events.ts';

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
  const load = () =>
    fetch('/api/sessions')
      .then((r) => r.json() as Promise<{ sessions: SessionInfo[] }>)
      .then(({ sessions }) => {
        // Merge rather than replace: a 'session' event may have arrived first.
        const known = new Map(sessions.map((s) => [s.id, s]));
        for (const s of list.get()) if (s !== MAIN && !known.has(s.id)) known.set(s.id, s);
        list.set([...known.values()].sort(byRecent));
        if (!known.has(activeId.get())) setActiveSession(MAIN_SESSION_ID);
      });
  void load().catch(() => {
    started = false;
  });
  // Events were missed while the stream was down.
  onReconnect(() => void load().catch(() => {}));
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

/** The session a rendered transcript belongs to; absent means the dock's active session. */
export const TranscriptSession = createContext<string | null>(null);

/** For tool-part renderers: the session of the transcript they sit in. */
export function useTranscriptSessionId(): string {
  const active = useActiveSessionId();
  return useContext(TranscriptSession) ?? active;
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

/* ── Turn recovery ────────────────────────────────────────────────── */

/** The turn's stream dropped (network error, server restart) before it finished. */
export class ConnectionLostError extends Error {
  constructor() {
    super('Connection lost');
    this.name = 'ConnectionLostError';
  }
}

/** The session already has a turn running (HTTP 409). */
export class SessionBusyError extends Error {
  constructor() {
    super('The agent is still working on an earlier message.');
    this.name = 'SessionBusyError';
  }
}

/**
 * Turns the ways a turn's stream can fail into typed errors: the server
 * answered 409, the server answered something else (passes through), or the
 * connection died before a message-end/error frame arrived.
 */
function resilient(inner: ChatTransport): ChatTransport {
  return {
    async *send(req, signal) {
      const local = new AbortController();
      const onAbort = () => local.abort();
      signal.addEventListener('abort', onAbort, { once: true });
      const sessionId = String((req.body as Record<string, unknown> | undefined)?.['sessionId'] ?? MAIN_SESSION_ID);
      // A stream can hang without ever erroring (a proxy holding the socket after the server died).
      // When the events stream comes back and the server says this session is idle, our turn is gone.
      let drop: (error: Error) => void = () => {};
      const dead = new Promise<never>((_, reject) => (drop = reject));
      dead.catch(() => {});
      const stopWatching = onReconnect(() => {
        void sessionIsRunning(sessionId).then((running) => {
          if (running === false) drop(new ConnectionLostError());
        });
      });
      const iterator = inner.send(req, local.signal)[Symbol.asyncIterator]();
      let finished = false;
      let reached = false;
      try {
        while (true) {
          const next = iterator.next();
          next.catch(() => {});
          const step = await Promise.race([next, dead]);
          if (step.done) break;
          reached = true;
          if (step.value.type === 'message-end' || step.value.type === 'error') finished = true;
          yield step.value;
        }
        if (reached && !finished && !signal.aborted) throw new ConnectionLostError();
      } catch (cause) {
        if (signal.aborted) throw cause;
        if (cause instanceof ConnectionLostError) {
          reconnectNow();
          throw cause;
        }
        const message = cause instanceof Error ? cause.message : String(cause);
        if (/^Chat request failed: 409/.test(message)) throw new SessionBusyError();
        if (/^Chat request failed: /.test(message)) throw cause;
        reconnectNow(); // the events stream is probably dead too: don't wait for its watchdog
        throw new ConnectionLostError();
      } finally {
        stopWatching();
        signal.removeEventListener('abort', onAbort);
        local.abort();
      }
    },
  };
}

/** Per-session recovery notices, for the connection banner. */
const recovering = createStore<Record<string, 'lost' | 'busy'>>({});

/** Non-null while some conversation is reloading after a dropped turn. */
export function useChatRecovery(): 'lost' | 'busy' | null {
  const all = useSyncExternalStore(recovering.subscribe, recovering.get, recovering.get);
  const values = Object.values(all);
  return values.includes('lost') ? 'lost' : (values[0] ?? null);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const userMessages = (messages: Message[]) => messages.filter((m) => m.role === 'user');
const textOfMessage = (m: Message | undefined) =>
  (m?.parts ?? []).map((p) => (p.type === 'text' ? p.text : '')).join('\n').trim();

/** true/false from the session list; null while the server is unreachable. */
async function sessionIsRunning(sessionId: string): Promise<boolean | null> {
  try {
    const r = await fetch('/api/sessions');
    if (!r.ok) return null;
    const { sessions } = (await r.json()) as { sessions: SessionInfo[] };
    return sessions.find((s) => s.id === sessionId)?.status === 'running';
  } catch {
    return null;
  }
}

/**
 * After a dropped (or refused-as-busy) turn: poll until the server is back and
 * the session idle, reload the transcript from the session file, and re-send
 * the last user message only if the server never saw it.
 */
async function recover(sessionId: string, failed: ChatController, error: ConnectionLostError | SessionBusyError): Promise<void> {
  const busy = error instanceof SessionBusyError;
  recovering.set({ ...recovering.get(), [sessionId]: busy ? 'busy' : 'lost' });
  const local = failed.messages;
  const unsent = textOfMessage(userMessages(local).at(-1));
  const deadline = Date.now() + 120_000;
  try {
    let wait = 500;
    while (Date.now() < deadline) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await sleep(1000);
        continue;
      }
      if ((await sessionIsRunning(sessionId)) === false) break;
      await sleep(wait);
      wait = Math.min(wait * 1.6, 3000);
    }
    const r = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/messages`);
    if (!r.ok) throw new Error(`reload failed (${r.status})`);
    const { messages } = (await r.json()) as { messages: Message[] };
    const holder = holders.get(sessionId);
    if (!holder || holder.controller !== failed) return; // replaced or removed meanwhile
    // The local transcript has the unsent message; the server has it only if it got that far.
    const reached = userMessages(messages).length >= userMessages(local).length;
    const next = makeController(sessionId, messages);
    holder.controller = next;
    holder.store.set(next);
    if (busy) {
      toasts.push({ title: 'The agent was still working', description: 'It has finished its earlier message. Send yours again.', variant: 'info' });
    } else if (!reached && unsent) {
      void next.send(unsent);
    }
  } catch (cause) {
    toasts.push({
      title: 'Could not reload the conversation',
      description: cause instanceof Error ? cause.message : String(cause),
      variant: 'error',
    });
  } finally {
    const { [sessionId]: _done, ...rest } = recovering.get();
    recovering.set(rest);
  }
}

function makeController(sessionId: string, initialMessages: Message[]): ChatController {
  const controller: ChatController = new ChatController({
    transport: resilient(
      createSseTransport({
        url: '/api/chat',
        fetch: withCanvasContext(() => {
          const staged = takePendingContext();
          return staged.length ? { context: staged.map(({ label, text }) => ({ label, text })) } : {};
        }),
      }),
    ),
    body: { sessionId },
    initialMessages,
    onError: (e) => {
      if (e instanceof ConnectionLostError || e instanceof SessionBusyError) void recover(sessionId, controller, e);
      else toasts.push({ title: 'The agent stopped', description: e.message, variant: 'error' });
    },
  });
  return controller;
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
