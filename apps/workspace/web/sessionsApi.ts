/**
 * Session hooks for the browser (shared/runtime.ts, work package A).
 *
 * CONTRACT: these exports and signatures are fixed. This starter
 * implementation serves one in-memory conversation so the shell (C) and
 * applet intents (B) can be built today; A replaces the internals with many
 * persistent sessions (GET/POST /api/sessions, per-session controllers,
 * history reloaded from GET /api/sessions/:id/messages, live status from
 * server events).
 */
import { useSyncExternalStore } from 'react';
import { MAIN_SESSION_ID, type SessionInfo } from '../shared/runtime.ts';
import { newWorkspaceChat, useWorkspaceChat, type WorkspaceChat } from './chatStore.ts';

/* ── Session list ─────────────────────────────────────────────────── */

const MAIN: SessionInfo = { id: MAIN_SESSION_ID, title: 'Main', createdAt: 0, updatedAt: 0, status: 'idle', kind: 'chat' };

export function useSessions(): SessionInfo[] {
  return [MAIN];
}

let activeId = MAIN_SESSION_ID;
const activeListeners = new Set<() => void>();

export function getActiveSessionId(): string {
  return activeId;
}

export function setActiveSession(id: string): void {
  if (id === activeId) return;
  activeId = id;
  for (const l of [...activeListeners]) l();
}

export function useActiveSessionId(): string {
  return useSyncExternalStore(
    (l) => {
      activeListeners.add(l);
      return () => activeListeners.delete(l);
    },
    getActiveSessionId,
    getActiveSessionId,
  );
}

/** Creates a session and makes it active; resolves to its id. */
export async function createSession(options: { title?: string; kind?: SessionInfo['kind'] } = {}): Promise<string> {
  void options;
  newWorkspaceChat();
  return MAIN_SESSION_ID;
}

export async function renameSession(id: string, title: string): Promise<void> {
  void id;
  void title;
}

export async function deleteSession(id: string): Promise<void> {
  void id;
}

/* ── Conversations ────────────────────────────────────────────────── */

/** The live conversation for `sessionId` (defaults to the active session). */
export function useSessionChat(sessionId?: string): WorkspaceChat {
  void sessionId;
  return useWorkspaceChat();
}

/** Send a user message to a session without rendering it (applet intents, CLI-like callers). */
export function sendToSession(text: string, sessionId?: string): void {
  void sessionId;
  sendHandlers.forEach((h) => h(text));
}

const sendHandlers = new Set<(text: string) => void>();
/** Starter plumbing: the mounted chat registers how to send. A replaces this with per-session controllers. */
export function registerSender(handler: (text: string) => void): () => void {
  sendHandlers.add(handler);
  return () => sendHandlers.delete(handler);
}

/* ── Pending context (chips above the composer) ───────────────────── */

export interface PendingContext {
  id: string;
  label: string;
  text: string;
}

let pending: PendingContext[] = [];
const pendingListeners = new Set<() => void>();
const emitPending = () => pendingListeners.forEach((l) => l());

/** Stage context for the next message; ChatPanel shows it as chips and sends it with the prompt. */
export function addPendingContext(context: { label: string; text: string }): void {
  pending = [...pending, { id: `ctx-${Date.now()}-${pending.length}`, ...context }];
  emitPending();
}

export function removePendingContext(id: string): void {
  pending = pending.filter((p) => p.id !== id);
  emitPending();
}

export function takePendingContext(): PendingContext[] {
  const taken = pending;
  pending = [];
  emitPending();
  return taken;
}

export function usePendingContext(): PendingContext[] {
  return useSyncExternalStore(
    (l) => {
      pendingListeners.add(l);
      return () => pendingListeners.delete(l);
    },
    () => pending,
    () => pending,
  );
}
