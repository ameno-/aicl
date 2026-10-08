/** Browser data for the Agents view: the handoff log, a ticking clock, and server-run transcripts. */
import { useEffect, useRef, useState } from 'react';
import type { Message } from '@aicl/core';
import type { SwarmEvent } from '../../shared/swarm.ts';
import { onReconnect, onServerEvent } from '../events.ts';

/** Handoff events (spawn, message, result, stop), newest last: seeded from the server, then live. */
export function useSwarmLog(): SwarmEvent[] {
  const [events, setEvents] = useState<SwarmEvent[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void fetch('/api/swarm/log')
        .then((r) => r.json() as Promise<{ events: SwarmEvent[] }>)
        .then((b) => alive && setEvents((cur) => [...b.events, ...cur.filter((e) => !b.events.some((x) => x.id === e.id))].slice(-300)))
        .catch(() => {});
    load();
    const off = [
      onServerEvent('swarm', (e) => setEvents((cur) => (cur.some((x) => x.id === e.event.id) ? cur : [...cur, e.event].slice(-300)))),
      onReconnect(load),
    ];
    return () => {
      alive = false;
      off.forEach((f) => f());
    };
  }, []);
  return events;
}

/** Wall-clock ms, re-rendering every second while `active`. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/**
 * The server snapshot reports a tool call without a result as an error. In a
 * session that is still running, the trailing unanswered calls (an agent_wait,
 * a long bash) are simply in flight: show them as running.
 */
export function markUnfinished(messages: Message[]): Message[] {
  const last = messages[messages.length - 1];
  if (last?.role !== 'assistant') return messages;
  const parts = [...last.parts];
  let changed = false;
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i]!;
    if (part.type !== 'tool-call' || part.status !== 'error') break;
    parts[i] = { ...part, status: 'running' } as typeof part;
    changed = true;
  }
  return changed ? [...messages.slice(0, -1), { ...last, parts }] : messages;
}

/**
 * A session's transcript read from the server (sessions run by agents never
 * stream into the page): reloaded when `version` changes and every 1.5s while `live`.
 */
export function useServerMessages(sessionId: string | undefined, live: boolean, version: unknown): Message[] {
  const [messages, setMessages] = useState<Message[]>([]);
  const current = useRef(sessionId);
  current.current = sessionId;
  useEffect(() => {
    setMessages([]);
  }, [sessionId]);
  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    const load = () =>
      void fetch(`/api/sessions/${encodeURIComponent(sessionId)}/messages`)
        .then((r) => (r.ok ? (r.json() as Promise<{ messages: Message[] }>) : null))
        .then((b) => b && alive && current.current === sessionId && setMessages(live ? markUnfinished(b.messages) : b.messages))
        .catch(() => {});
    load();
    const t = live ? setInterval(load, 1500) : undefined;
    return () => {
      alive = false;
      if (t) clearInterval(t);
    };
  }, [sessionId, live, version]);
  return messages;
}

async function post(url: string, body?: unknown): Promise<{ ok: boolean; message?: string; mode?: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string; mode?: string };
  return { ok: res.ok, ...data };
}

/** Steers a running agent (queued after its current tool calls) or starts a run on an idle one. */
export const messageAgent = (id: string, text: string) => post(`/api/swarm/${encodeURIComponent(id)}/message`, { text });

/** Stops an agent and everything it spawned. */
export const stopAgent = (id: string) => post(`/api/swarm/${encodeURIComponent(id)}/stop`);
