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
import { MAIN_SESSION_ID, type SessionInfo, type SessionUsage } from '../shared/runtime.ts';
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
  /** Queues a message for delivery after the current turn's tool calls (Pi `steer`). */
  steer?(text: string): Promise<void>;
  /** Switches the live session's model (persisted in its transcript by Pi). */
  setModel?(model: never): Promise<void>;
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
  /** "provider/id" the user picked for this session; absent = the workspace default. */
  model?: string;
  /** Swarm lineage: who spawned this session, the top of its tree, and what it was asked to do. */
  parentId?: string;
  rootId?: string;
  role?: string;
  task?: string;
  spawnedBy?: 'user' | 'agent';
  usage?: SessionUsage;
  startedAt?: number;
  finishedAt?: number;
  folder?: string;
  pinned?: boolean;
  archived?: boolean;
}

/** A folder path: segments trimmed, empty ones dropped, no leading/trailing slashes. */
export function normalizeFolder(folder: string): string {
  return folder
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('/');
}

export class SessionError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'SessionError';
  }
}

/** A short label for a running tool call: "bash: npm test", "read: src/a.ts". */
export function stepLabel(tool: string, args: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>;
  const pick = [a['command'], a['path'], a['name'], a['to'], a['id'], a['query'], a['question']].find((v) => typeof v === 'string' && v) as string | undefined;
  const flat = pick ? pick.replace(/\s+/g, ' ').trim() : '';
  const detail = flat.length > 50 ? `${flat.slice(0, 49)}…` : flat;
  return detail ? `${tool}: ${detail}` : tool;
}

interface PiLiveEvent {
  type?: string;
  toolName?: string;
  args?: unknown;
  message?: { role?: string; usage?: { input?: number; output?: number; cost?: { total?: number } } };
  assistantMessageEvent?: { type?: string };
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
  createAgent(file: string | undefined, model?: string): Promise<AgentLike>;
  /** "provider/id" → the Pi model, or undefined when unknown or without credentials. */
  resolveModel?(key: string): unknown;
  onChange?(session: SessionInfo): void;
  onRemove?(id: string): void;
  /** Every Pi event from every session's agent (live plans, streaming terminals, …). */
  onAgentEvent?(sessionId: string, event: unknown): void;
  now?(): number;
}

export type SessionHub = Awaited<ReturnType<typeof createSessionHub>>;

export async function createSessionHub(options: SessionHubOptions) {
  const now = options.now ?? Date.now;
  const indexPath = path.join(options.dir, 'index.json');
  const foldersPath = path.join(options.dir, 'folders.json');
  const entries = new Map<string, IndexEntry>();
  const status = new Map<string, 'running' | 'error'>();
  const agents = new Map<string, Promise<AgentLike>>();
  const busy = new Set<string>();
  const steps = new Map<string, string>();
  const stopped = new Set<string>();
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
    ...(e.model ? { model: e.model } : {}),
    ...(e.parentId ? { parentId: e.parentId } : {}),
    ...(e.rootId ? { rootId: e.rootId } : {}),
    ...(e.role ? { role: e.role } : {}),
    ...(e.task ? { task: e.task } : {}),
    ...(e.spawnedBy ? { spawnedBy: e.spawnedBy } : {}),
    ...(e.usage ? { usage: e.usage } : {}),
    ...(steps.has(e.id) ? { currentStep: steps.get(e.id)! } : {}),
    ...(e.startedAt ? { startedAt: e.startedAt } : {}),
    ...(e.finishedAt ? { finishedAt: e.finishedAt } : {}),
    ...(stopped.has(e.id) ? { stopped: true } : {}),
    ...(e.folder ? { folder: e.folder } : {}),
    ...(e.pinned ? { pinned: true } : {}),
    ...(e.archived ? { archived: true } : {}),
  });

  /** Every session below `id`, nearest first. */
  const descendantsOf = (id: string): IndexEntry[] => {
    const out: IndexEntry[] = [];
    const queue = [id];
    while (queue.length) {
      const at = queue.shift()!;
      for (const e of entries.values()) {
        if (e.parentId === at && !out.includes(e)) {
          out.push(e);
          queue.push(e.id);
        }
      }
    }
    return out;
  };

  /** Folds one live Pi event into the session's usage and current step. */
  const track = (id: string, raw: unknown): void => {
    const e = entries.get(id);
    const event = raw as PiLiveEvent;
    if (!e || !event?.type) return;
    let step: string | undefined;
    if (event.type === 'tool_execution_start') step = stepLabel(event.toolName ?? 'tool', event.args);
    else if (event.type === 'message_update') {
      const t = event.assistantMessageEvent?.type;
      if (t === 'thinking_start') step = 'thinking';
      else if (t === 'text_start') step = 'writing';
    } else if (event.type === 'message_end' && event.message?.role === 'assistant') {
      const u = event.message.usage;
      if (u) {
        const prev = e.usage ?? { inputTokens: 0, outputTokens: 0 };
        const cost = (prev.costUsd ?? 0) + (u.cost?.total ?? 0);
        e.usage = {
          inputTokens: prev.inputTokens + (u.input ?? 0),
          outputTokens: prev.outputTokens + (u.output ?? 0),
          ...(cost > 0 ? { costUsd: cost } : {}),
        };
        options.onChange?.(info(e));
      }
    }
    if (step && busy.has(id) && steps.get(id) !== step) {
      steps.set(id, step);
      options.onChange?.(info(e));
    }
  };

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
        .then((existing) => options.createAgent(existing, e.model))
        .then((a) => {
          if (a.sessionFile && !e.file) e.file = path.basename(a.sessionFile);
          a.subscribe((event) => {
            track(id, event);
            options.onAgentEvent?.(id, event);
          });
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

    /** Which session owns a Pi session file (tools get the file from ctx.sessionManager). */
    idForFile(file: string | undefined): string | undefined {
      if (!file) return undefined;
      const base = path.basename(file);
      for (const e of entries.values()) if (e.file === base) return e.id;
      return undefined;
    },

    async create(
      input: { title?: string; kind?: SessionInfo['kind']; parentId?: string; role?: string; task?: string; spawnedBy?: 'user' | 'agent'; model?: string } = {},
    ): Promise<SessionInfo> {
      const t = now();
      const parent = input.parentId ? need(input.parentId) : undefined;
      const title = input.title?.trim();
      const e: IndexEntry = {
        id: randomUUID().slice(0, 8),
        title: title || 'New chat',
        createdAt: t,
        updatedAt: t,
        kind: input.kind === 'node' ? 'node' : 'chat',
        ...(title ? { titleSource: 'user' as const } : {}),
        ...(parent ? { parentId: parent.id, rootId: parent.rootId ?? parent.id, spawnedBy: input.spawnedBy ?? 'agent' } : {}),
        ...(input.role ? { role: input.role } : {}),
        ...(input.task ? { task: input.task } : {}),
        ...(input.model ? { model: input.model } : {}),
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

    /** Sidebar organisation: move to a folder ('' = no folder), pin, archive. */
    async organize(id: string, change: { folder?: string; pinned?: boolean; archived?: boolean }): Promise<SessionInfo> {
      const e = need(id);
      if (change.folder !== undefined) {
        const folder = normalizeFolder(change.folder);
        if (folder) e.folder = folder;
        else delete e.folder;
      }
      if (change.pinned !== undefined) {
        if (change.pinned) e.pinned = true;
        else delete e.pinned;
      }
      if (change.archived !== undefined) {
        if (change.archived) e.archived = true;
        else delete e.archived;
      }
      await persist();
      options.onChange?.(info(e));
      return info(e);
    },

    /** Every folder: saved ones (they may be empty) plus those sessions are in. */
    async folders(): Promise<string[]> {
      const saved = await readFile(foldersPath, 'utf8')
        .then((t) => JSON.parse(t) as unknown)
        .catch(() => []);
      const all = new Set<string>(Array.isArray(saved) ? saved.filter((f): f is string => typeof f === 'string').map(normalizeFolder).filter(Boolean) : []);
      for (const e of entries.values()) if (e.folder) all.add(e.folder);
      return [...all].sort((a, b) => a.localeCompare(b));
    },

    async addFolder(folder: string): Promise<string[]> {
      const f = normalizeFolder(folder);
      if (!f) throw new SessionError(400, 'A folder name is required.');
      const list = new Set(await this.folders());
      list.add(f);
      await writeFile(foldersPath, JSON.stringify([...list]));
      return this.folders();
    },

    /** Renames a folder (and every sub-folder); its sessions move with it. */
    async renameFolder(from: string, to: string): Promise<string[]> {
      const a = normalizeFolder(from);
      const b = normalizeFolder(to);
      if (!a || !b) throw new SessionError(400, 'Both folder names are required.');
      const move = (f: string) => (f === a ? b : f.startsWith(`${a}/`) ? `${b}${f.slice(a.length)}` : f);
      for (const e of entries.values()) if (e.folder) e.folder = move(e.folder);
      await writeFile(foldersPath, JSON.stringify((await this.folders()).map(move)));
      await persist();
      for (const e of entries.values()) if (e.folder && (e.folder === b || e.folder.startsWith(`${b}/`))) options.onChange?.(info(e));
      return this.folders();
    },

    /** Deletes a folder (and sub-folders); its sessions are kept, out of any folder. */
    async deleteFolder(folder: string): Promise<string[]> {
      const f = normalizeFolder(folder);
      const inside = (x: string) => x === f || x.startsWith(`${f}/`);
      for (const e of entries.values()) {
        if (e.folder && inside(e.folder)) {
          delete e.folder;
          options.onChange?.(info(e));
        }
      }
      await writeFile(foldersPath, JSON.stringify((await this.folders()).filter((x) => !inside(x))));
      await persist();
      return this.folders();
    },

    /** Switches a session's model; remembered across reloads. 409 while it is running. */
    async setModel(id: string, key: string): Promise<SessionInfo> {
      const e = need(id);
      if (busy.has(id)) throw new SessionError(409, 'The agent is still working. Wait for it to finish before switching models.');
      const model = options.resolveModel?.(key);
      if (!model) throw new SessionError(400, `Unknown or unavailable model "${key}".`);
      const agent = await agentFor(id);
      await agent.setModel?.(model as never);
      e.model = key;
      await touch(e);
      return info(e);
    },

    /** Models chosen by sessions (so the picker keeps showing them). */
    modelsInUse(): string[] {
      return [...new Set([...entries.values()].flatMap((e) => (e.model ? [e.model] : [])))];
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
      steps.delete(id);
      stopped.delete(id);
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

    /** Aborts the session's run and, with it, every running session it spawned. */
    async stop(id: string): Promise<void> {
      need(id);
      const targets = [id, ...descendantsOf(id).map((d) => d.id)].filter((x) => x === id || busy.has(x));
      await Promise.all(
        targets.map(async (x) => {
          if (busy.has(x)) {
            stopped.add(x);
            const e = entries.get(x);
            if (e) options.onChange?.(info(e));
          }
          const agent = await agents.get(x)?.catch(() => undefined);
          await agent?.abort();
        }),
      );
    },

    /** Delivers a message to a running session after its current tool calls (Pi steer). */
    async steer(id: string, text: string): Promise<void> {
      need(id);
      if (!busy.has(id)) throw new SessionError(409, 'The agent is not running.');
      const agent = await agentFor(id);
      if (agent.steer) await agent.steer(text);
      else await (agent as AgentLike).prompt(text);
    },

    wasStopped(id: string): boolean {
      return stopped.has(id);
    },

    /** Sessions spawned directly by `id`. */
    children(id: string): SessionInfo[] {
      return [...entries.values()].filter((e) => e.parentId === id).map(info);
    },

    /** All sessions below `id`. */
    descendants(id: string): SessionInfo[] {
      return descendantsOf(id).map(info);
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
        stopped.delete(id);
        steps.delete(id);
        e.startedAt = now();
        delete e.finishedAt;
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
        steps.delete(id);
        if (failed) status.set(id, 'error');
        else status.delete(id);
        e.finishedAt = now();
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
