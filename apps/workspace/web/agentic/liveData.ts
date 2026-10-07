/**
 * Browser-side live state for package B: one plan per session and one
 * terminal per tool call, fed by the 'plan' / 'terminal' server events
 * (web/events.ts) with an HTTP fallback for what happened before the page loaded.
 */
import { useEffect, useSyncExternalStore } from 'react';
import type { LivePlan } from '../../shared/agentic.ts';
import { onReconnect, onServerEvent } from '../events.ts';

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

export interface TerminalState {
  toolCallId: string;
  command?: string;
  lines: string[];
  /** Unfinished last line (shown, but not yet a full line). */
  partial: string;
  done: boolean;
  exitCode?: number;
}

const MAX_LINES = 400;
const plans = createStore<Record<string, LivePlan | null>>({});
const terminals = createStore<Record<string, TerminalState>>({});
/** sessionId → latest bash toolCallId */
const latest = createStore<Record<string, string>>({});
const planRequested = new Set<string>();
const termRequested = new Set<string>();
let started = false;

type TerminalReply = { toolCallId?: string; lines: string[]; done: boolean; command?: string; exitCode?: number };

function loadPlan(sessionId: string, replace = false): Promise<void> {
  return fetch(`/api/sessions/${encodeURIComponent(sessionId)}/plan`)
    .then((r) => r.json() as Promise<{ plan: LivePlan | null }>)
    .then(({ plan }) => {
      if (plan && (replace || !plans.get()[sessionId])) plans.set({ ...plans.get(), [sessionId]: plan });
    });
}

function loadTerminal(sessionId: string, wanted: string, replace = false): Promise<void> {
  return fetch(`/api/sessions/${encodeURIComponent(sessionId)}/terminal/${encodeURIComponent(wanted)}`)
    .then((r) => r.json() as Promise<TerminalReply>)
    .then((t) => {
      const id = t.toolCallId;
      if (!id) return;
      const existing = terminals.get()[key(sessionId, id)];
      if (replace || !existing || (!existing.lines.length && !existing.done)) {
        terminals.set({
          ...terminals.get(),
          [key(sessionId, id)]: { toolCallId: id, command: t.command, lines: t.lines, partial: '', done: t.done, exitCode: t.exitCode },
        });
      }
      if (wanted === 'latest' && !latest.get()[sessionId]) latest.set({ ...latest.get(), [sessionId]: id });
    });
}

const key = (sessionId: string, toolCallId: string) => `${sessionId}/${toolCallId}`;

function start(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  onServerEvent('plan', (e) => plans.set({ ...plans.get(), [e.plan.sessionId]: e.plan }));
  onServerEvent('terminal', ({ chunk }) => {
    const k = key(chunk.sessionId, chunk.toolCallId);
    const prev = terminals.get()[k] ?? { toolCallId: chunk.toolCallId, lines: [], partial: '', done: false };
    const parts = (prev.partial + chunk.text).split('\n');
    let partial = parts.pop() ?? '';
    let lines = [...prev.lines, ...parts];
    if (chunk.done && partial) {
      lines.push(partial);
      partial = '';
    }
    if (lines.length > MAX_LINES) lines = lines.slice(-MAX_LINES);
    terminals.set({
      ...terminals.get(),
      [k]: {
        toolCallId: chunk.toolCallId,
        command: chunk.command ?? prev.command,
        lines,
        partial,
        done: chunk.done ?? prev.done,
        exitCode: chunk.exitCode ?? prev.exitCode,
      },
    });
    if (chunk.command !== undefined) latest.set({ ...latest.get(), [chunk.sessionId]: chunk.toolCallId });
  });
  // Events were missed while the stream was down: refetch every plan and terminal we have shown.
  onReconnect(() => {
    for (const id of planRequested) void loadPlan(id, true).catch(() => {});
    for (const k of termRequested) {
      const i = k.indexOf('/');
      void loadTerminal(k.slice(0, i), k.slice(i + 1), true).catch(() => {});
    }
  });
}

export function usePlan(sessionId: string): LivePlan | null {
  start();
  useEffect(() => {
    if (planRequested.has(sessionId)) return;
    planRequested.add(sessionId);
    void loadPlan(sessionId).catch(() => planRequested.delete(sessionId));
  }, [sessionId]);
  const all = useSyncExternalStore(plans.subscribe, plans.get, plans.get);
  return all[sessionId] ?? null;
}

/** One command's output; `toolCallId` undefined or 'latest' follows the session's newest bash call. */
export function useTerminal(sessionId: string, toolCallId?: string): TerminalState | null {
  start();
  const latestMap = useSyncExternalStore(latest.subscribe, latest.get, latest.get);
  const wanted = toolCallId && toolCallId !== 'latest' ? toolCallId : (latestMap[sessionId] ?? 'latest');
  useEffect(() => {
    const k = key(sessionId, wanted);
    if (termRequested.has(k)) return;
    termRequested.add(k);
    void loadTerminal(sessionId, wanted).catch(() => termRequested.delete(k));
  }, [sessionId, wanted]);
  const all = useSyncExternalStore(terminals.subscribe, terminals.get, terminals.get);
  return all[key(sessionId, wanted)] ?? null;
}
