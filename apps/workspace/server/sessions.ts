/**
 * The session hub: many persistent agent conversations (work package A).
 *
 * Each conversation is one Pi AgentSession whose transcript lives in
 * `<workspace>/.aicl/sessions/*.jsonl`; `index.json` beside them lists the
 * conversations (title, timestamps, which file). Sessions are created lazily:
 * the hub only builds a Pi session when a conversation is first read or run.
 *
 * The hub knows nothing about the Pi SDK: `createAgent` (main.ts) builds the
 * session, which keeps this module testable with fakes.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Message, Part, StreamEvent } from '@aicl/core';
import { MAIN_SESSION_ID, type SessionInfo } from '../shared/runtime.ts';
import { createPiEventMapper, type PiEvent } from './pi-mapper.ts';

/** The slice of a Pi AgentSession the hub uses. */
export interface AgentLike {
  readonly messages: readonly unknown[];
  readonly isStreaming: boolean;
  readonly sessionFile?: string | undefined;
  readonly model?: { provider: string; id: string } | undefined;
  subscribe(listener: (event: unknown) => void): () => void;
  prompt(text: string): Promise<void>;
  abort(): Promise<void>;
  dispose?(): void;
}

export interface IndexEntry {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  kind: SessionInfo['kind'];
  /** Transcript file name inside the sessions dir; absent until Pi writes it (after the first reply). */
  file?: string;
  /** 'auto' once titled from the first message, 'user' once renamed; absent = default title. */
  titleSource?: 'auto' | 'user';
  preview?: string;
}

export class SessionError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'SessionError';
  }
}

/* ── History conversion ───────────────────────────────────────────── */

const CONTEXT_BLOCK = /\s*<canvas-context>[\s\S]*?<\/canvas-context>/g;

/** Removes the hidden context block the server appends to user prompts. */
export function stripCanvasContext(text: string): string {
  return text.replace(CONTEXT_BLOCK, '').trim();
}

interface PiContent {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
}

interface PiMessage {
  role?: string;
  content?: string | PiContent[];
  toolCallId?: string;
  isError?: boolean;
  timestamp?: number;
}

/**
 * Pi AgentMessage[] → @aicl/core Message[]. One Pi prompt can span several
 * assistant/toolResult messages; like the live stream they become ONE
 * assistant message, so reloaded history looks like what was streamed.
 */
export function convertHistory(history: readonly unknown[], sessionId = 'session'): Message[] {
  const results = new Map<string, boolean>();
  for (const raw of history) {
    const m = raw as PiMessage;
    if (m.role === 'toolResult' && m.toolCallId) results.set(m.toolCallId, Boolean(m.isError));
  }

  const out: Message[] = [];
  let assistant: Message | null = null;
  const flush = () => {
    if (assistant && assistant.parts.length) out.push(assistant);
    assistant = null;
  };
  const nextId = (role: string) => `${sessionId}-${role}-${out.length + (assistant ? 1 : 0)}`;

  for (const raw of history) {
    const m = raw as PiMessage;
    if (m.role === 'user') {
      flush();
      const text = stripCanvasContext(
        typeof m.content === 'string'
          ? m.content
          : (m.content ?? []).map((c) => (c.type === 'text' ? (c.text ?? '') : '')).join('\n'),
      );
      if (!text) continue;
      out.push({ id: nextId('user'), role: 'user', parts: [{ type: 'text', text }], createdAt: m.timestamp });
    } else if (m.role === 'assistant') {
      assistant ??= { id: nextId('assistant'), role: 'assistant', parts: [], createdAt: m.timestamp };
      const parts: Part[] = [];
      for (const c of Array.isArray(m.content) ? m.content : []) {
        if (c.type === 'text' && c.text) parts.push({ type: 'text', text: c.text });
        else if (c.type === 'thinking' && c.thinking) parts.push({ type: 'reasoning', text: c.thinking });
        else if (c.type === 'toolCall') {
          const isError = results.get(c.id ?? '');
          parts.push({
            type: 'tool-call',
            toolCallId: c.id ?? '',
            name: c.name ?? 'tool',
            args: c.arguments ?? {},
            argsText: JSON.stringify(c.arguments ?? {}, null, 2),
            status: isError === false ? 'success' : 'error',
          });
        }
      }
      assistant.parts.push(...parts);
    }
    // toolResult and other roles (bash, custom) carry no transcript of their own.
  }
  flush();
  return out;
}

/** Last assistant text, whitespace-collapsed and cut to `max` characters. */
export function previewOf(history: readonly unknown[], max = 80): string | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i] as PiMessage;
    if (m.role !== 'assistant' || !Array.isArray(m.content)) continue;
    const text = m.content
      .map((c) => (c.type === 'text' ? (c.text ?? '') : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }
  return undefined;
}

export function titleFrom(promptText: string, max = 48): string {
  const text = stripCanvasContext(promptText).replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/* ── The hub ──────────────────────────────────────────────────────── */

export interface SessionHubOptions {
  /** `<workspace>/.aicl/sessions`. */
  dir: string;
  /** Builds a Pi session: opens `file` (absolute) when given, otherwise starts a new persisted one in `dir`. */
  createAgent(file: string | undefined): Promise<AgentLike>;
  onChange?(session: SessionInfo): void;
  onRemove?(id: string): void;
  now?(): number;
}

export type SessionHub = Awaited<ReturnType<typeof createSessionHub>>;

export async function createSessionHub(options: SessionHubOptions) {
  const now = options.now ?? Date.now;
  const indexPath = path.join(options.dir, 'index.json');
  const entries = new Map<string, IndexEntry>();
  const status = new Map<string, 'running' | 'error'>();
  const agents = new Map<string, Promise<AgentLike>>();
  const busy = new Set<string>();
  let writing: Promise<void> = Promise.resolve();

  await mkdir(options.dir, { recursive: true });
  try {
    const raw = JSON.parse(await readFile(indexPath, 'utf8')) as { sessions?: IndexEntry[] };
    for (const e of raw.sessions ?? []) entries.set(e.id, e);
  } catch {
    // First run, or an unreadable index: start from main alone.
  }
  if (!entries.has(MAIN_SESSION_ID)) {
    const t = now();
    entries.set(MAIN_SESSION_ID, { id: MAIN_SESSION_ID, title: 'Main', createdAt: t, updatedAt: t, kind: 'chat' });
  }

  const info = (e: IndexEntry): SessionInfo => ({
    id: e.id,
    title: e.title,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    status: status.get(e.id) ?? 'idle',
    kind: e.kind,
    ...(e.preview ? { preview: e.preview } : {}),
  });

  const persist = (): Promise<void> => {
    const body = JSON.stringify({ sessions: [...entries.values()] }, null, 2);
    const tmp = `${indexPath}.${process.pid}.tmp`;
    writing = writing
      .catch(() => undefined)
      .then(async () => {
        await writeFile(tmp, body);
        await rename(tmp, indexPath);
      });
    return writing;
  };

  const touch = async (e: IndexEntry): Promise<void> => {
    options.onChange?.(info(e));
    await persist();
  };

  const need = (id: string): IndexEntry => {
    const e = entries.get(id);
    if (!e) throw new SessionError(404, `No session "${id}".`);
    return e;
  };

  function agentFor(id: string): Promise<AgentLike> {
    const e = need(id);
    let agent = agents.get(id);
    if (!agent) {
      const file = e.file ? path.join(options.dir, e.file) : undefined;
      agent = readFile(file ?? '', 'utf8')
        .then(
          () => file,
          () => undefined,
        )
        .then((existing) => options.createAgent(existing))
        .then((a) => {
          if (a.sessionFile && !e.file) e.file = path.basename(a.sessionFile);
          return a;
        });
      agents.set(id, agent);
      agent.catch(() => agents.delete(id));
    }
    return agent;
  }

  await persist();

  return {
    /** Newest activity first. */
    list(): SessionInfo[] {
      return [...entries.values()].sort((a, b) => b.updatedAt - a.updatedAt).map(info);
    },

    get(id: string): SessionInfo | undefined {
      const e = entries.get(id);
      return e && info(e);
    },

    agent: agentFor,

    async create(input: { title?: string; kind?: SessionInfo['kind'] } = {}): Promise<SessionInfo> {
      const t = now();
      const title = input.title?.trim();
      const e: IndexEntry = {
        id: randomUUID().slice(0, 8),
        title: title || 'New chat',
        createdAt: t,
        updatedAt: t,
        kind: input.kind === 'node' ? 'node' : 'chat',
        ...(title ? { titleSource: 'user' as const } : {}),
      };
      entries.set(e.id, e);
      await touch(e);
      return info(e);
    },

    async rename(id: string, title: string): Promise<SessionInfo> {
      const e = need(id);
      const next = title.trim();
      if (!next) throw new SessionError(400, 'A title is required.');
      e.title = next;
      e.titleSource = 'user';
      await touch(e);
      return info(e);
    },

    async remove(id: string): Promise<void> {
      if (id === MAIN_SESSION_ID) throw new SessionError(400, 'The main session cannot be deleted.');
      const e = need(id);
      const agent = await agents.get(id)?.catch(() => undefined);
      if (agent) {
        await agent.abort().catch(() => undefined);
        agent.dispose?.();
      }
      agents.delete(id);
      busy.delete(id);
      status.delete(id);
      entries.delete(id);
      if (e.file) await rm(path.join(options.dir, e.file), { force: true });
      options.onRemove?.(id);
      await persist();
    },

    async messages(id: string): Promise<Message[]> {
      need(id);
      // A stored but unloaded session is read through its agent, like a live one.
      const agent = await agentFor(id);
      return convertHistory(agent.messages, id);
    },

    async stop(id: string): Promise<void> {
      need(id);
      const agent = await agents.get(id)?.catch(() => undefined);
      await agent?.abort();
    },

    isBusy(id: string): boolean {
      return busy.has(id);
    },

    get anyBusy(): boolean {
      return busy.size > 0;
    },

    /** "provider/model" of the session (loading it if needed), for /api/info. */
    async modelLabel(id = MAIN_SESSION_ID): Promise<string | null> {
      const m = (await agentFor(id)).model;
      return m ? `${m.provider}/${m.id}` : null;
    },

    /** Claims the session for one run; 404 if unknown, 409 if it is already running. Call before `run`. */
    reserve(id: string): void {
      need(id);
      if (busy.has(id)) throw new SessionError(409, 'The agent is still working. Stop it or wait.');
      busy.add(id);
    },

    /** Runs one prompt on a reserved session and yields its AICL stream events. */
    async *run(id: string, text: string, signal: AbortSignal): AsyncGenerator<StreamEvent> {
      const e = need(id);
      let failed = false;
      try {
        const agent = await agentFor(id);
        if (!e.titleSource && id !== MAIN_SESSION_ID) {
          const title = titleFrom(text);
          if (title) {
            e.title = title;
            e.titleSource = 'auto';
          }
        }
        status.set(id, 'running');
        e.updatedAt = now();
        void touch(e);

        const map = createPiEventMapper(randomUUID());
        const queue: StreamEvent[] = [];
        let wake: (() => void) | null = null;
        let done = false;
        const push = (events: StreamEvent[]) => {
          if (!events.length) return;
          if (events.some((ev) => ev.type === 'error')) failed = true;
          queue.push(...events);
          wake?.();
        };
        const unsubscribe = agent.subscribe((event) => push(map(event as PiEvent)));
        const onAbort = () => void agent.abort();
        signal.addEventListener('abort', onAbort, { once: true });

        // prompt() resolves only after the whole run, auto-retries included, so it
        // and not agent_end is the end of the turn.
        agent
          .prompt(text)
          .then(
            () => push(map.finish()),
            (cause: unknown) => {
              const message = cause instanceof Error ? cause.message : String(cause);
              push([{ type: 'error', error: { message, retryable: true } }]);
            },
          )
          .finally(() => {
            done = true;
            wake?.();
          });

        try {
          while (true) {
            if (queue.length) {
              yield queue.shift()!;
              continue;
            }
            if (done) return;
            await new Promise<void>((resolve) => (wake = resolve));
            wake = null;
          }
        } finally {
          unsubscribe();
          signal.removeEventListener('abort', onAbort);
          const p = previewOf(agent.messages);
          if (p) e.preview = p;
          if (agent.sessionFile) e.file = path.basename(agent.sessionFile);
        }
      } catch (cause) {
        failed = true;
        throw cause;
      } finally {
        busy.delete(id);
        if (failed) status.set(id, 'error');
        else status.delete(id);
        e.updatedAt = now();
        void touch(e);
      }
    },

    /** Resolves once the index on disk reflects every change so far. */
    flush(): Promise<void> {
      return writing;
    },
  };
}
