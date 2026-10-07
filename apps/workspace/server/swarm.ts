/**
 * Multi-agent (AICL-40): agents spawn sub-agents, fan out and wait, steer and
 * stop them; the hub keeps lineage and usage, this module the orchestration,
 * the handoff log and the canvas run frame. CONTRACT: shared/swarm.ts.
 *
 * A child is an ordinary 'node' session whose parentId is the caller. Its
 * tool calls resolve to its own session, so the HITL gate, live plans and
 * terminals work for it unchanged (its approvals appear in the inbox under
 * its name).
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { SessionInfo } from '../shared/runtime.ts';
import { MAX_AGENT_DEPTH, MAX_CONCURRENT_CHILDREN, type SwarmEvent } from '../shared/swarm.ts';
import type { FeatureContext, FeatureModule } from './feature.ts';
import { json, readJson } from './http.ts';
import { lastAssistantText } from './nodes.ts';
import { sessionIdFromToolContext } from './session-context.ts';
import { SessionError, type SessionHub } from './sessions.ts';
import { createSwarmCanvas } from './swarm/canvas.ts';

export const SWARM_PROMPT = `## Sub-agents
You can delegate with spawn_agent {name, role, task, wait?, model?}: it creates a sub-agent with its own conversation that works on the task while the user watches it live (agent tree, canvas run frame). With wait true (default) the tool returns the sub-agent's final reply; with wait false it returns its id at once, so several independent sub-tasks run in parallel: spawn them all with wait:false, then call agent_wait {ids} to collect every reply. Give each one a crisp role and a self-contained task (it does not see this conversation). Delegate independent sub-tasks; do small things yourself. Keep the user informed: say briefly what you delegated and what came back. agent_status {id?} shows your sub-agents' state, agent_message {id, text} steers one (queued while it works), agent_stop {id} stops one. Limits: depth ${MAX_AGENT_DEPTH}, at most ${MAX_CONCURRENT_CHILDREN} sub-agents running at once.`;

export type SwarmHub = Pick<
  SessionHub,
  'get' | 'create' | 'reserve' | 'run' | 'agent' | 'stop' | 'steer' | 'descendants' | 'wasStopped' | 'isBusy'
>;

export interface SwarmDeps {
  hub(): SwarmHub;
  emit(event: SwarmEvent): void;
  canvas?: { spawned(rootId: string): void; changed(rootId: string): void };
  now?(): number;
}

export interface ChildResult {
  id: string;
  name: string;
  status: 'done' | 'error' | 'stopped';
  reply: string;
}

export interface SpawnParams {
  name: string;
  role: string;
  task: string;
  wait?: boolean | undefined;
  model?: string | undefined;
}

const clip = (s: string, max: number) => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

const tokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function createSwarmLogic(deps: SwarmDeps) {
  const now = deps.now ?? Date.now;
  /** Latest run of each session started here, so agent_wait can join it. */
  const jobs = new Map<string, Promise<ChildResult>>();
  /** Spawns past the limit check but not yet reserved, per root. */
  const inflight = new Map<string, number>();

  const nameOf = (id: string) => deps.hub().get(id)?.title ?? id;
  const rootOf = (s: SessionInfo) => s.rootId ?? s.id;

  const depthOf = (id: string): number => {
    let depth = 0;
    let at = deps.hub().get(id);
    while (at?.parentId) {
      depth++;
      at = deps.hub().get(at.parentId);
    }
    return depth;
  };

  const isBelow = (ancestor: string, id: string): boolean => {
    let at = deps.hub().get(id);
    while (at?.parentId) {
      if (at.parentId === ancestor) return true;
      at = deps.hub().get(at.parentId);
    }
    return false;
  };

  const log = (event: Omit<SwarmEvent, 'id' | 'at' | 'fromName' | 'toName'> & { fromName?: string; toName?: string }) =>
    deps.emit({
      id: randomUUID().slice(0, 8),
      at: now(),
      ...event,
      fromName: event.fromName ?? nameOf(event.from),
      toName: event.toName ?? nameOf(event.to),
      text: clip(event.text, 400),
    });

  /** The hidden brief a sub-agent's prompt carries (stripped from its transcript). */
  const brief = (child: SessionInfo): string => {
    if (!child.parentId) return '';
    const parent = child.parentId ? nameOf(child.parentId) : 'the user';
    const lines = [`You are the sub-agent "${child.title}", spawned by "${parent}".`];
    if (child.role) lines.push(`Your role: ${child.role}`);
    lines.push(`Do the task you are given and finish with a concise final reply: it is returned to ${parent}.`);
    return `\n\n<canvas-context>\n${lines.join('\n')}\n</canvas-context>`;
  };

  /** Reserves the child and runs `text` on it in the background; the promise never rejects. */
  function startRun(id: string, text: string, signal?: AbortSignal): Promise<ChildResult> {
    const hub = deps.hub();
    hub.reserve(id);
    const child = hub.get(id)!;
    const job = (async (): Promise<ChildResult> => {
      let error: string | undefined;
      try {
        for await (const event of hub.run(id, text + brief(child), signal ?? new AbortController().signal)) {
          if (event.type === 'error') error = event.error.message;
        }
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      }
      let reply = '(no reply)';
      try {
        reply = lastAssistantText((await hub.agent(id)).messages) ?? reply;
      } catch {
        // the session could not be read back: keep the placeholder
      }
      const status = hub.wasStopped(id) ? 'stopped' : error ? 'error' : 'done';
      const result: ChildResult = { id, name: child.title, status, reply: status === 'error' ? `Failed: ${error}` : reply };
      log({ type: 'result', from: id, to: child.parentId ?? id, text: result.reply, status });
      const info = hub.get(id);
      if (info) deps.canvas?.changed(rootOf(info));
      return result;
    })();
    jobs.set(id, job);
    return job;
  }

  const format = (r: ChildResult) => `[${r.name}] (${r.id}) ${r.status}:\n${r.reply}`;

  /** Resolves one child to its outcome: the tracked run, or polling a run started elsewhere. */
  async function settle(id: string, signal?: AbortSignal): Promise<ChildResult> {
    const hub = deps.hub();
    const tracked = jobs.get(id);
    if (tracked && hub.isBusy(id)) return tracked;
    while (hub.isBusy(id) && !signal?.aborted) await new Promise((r) => setTimeout(r, 250));
    const info = hub.get(id);
    if (tracked) return tracked;
    let reply = '(no reply)';
    try {
      reply = lastAssistantText((await hub.agent(id)).messages) ?? reply;
    } catch {
      // unreadable: keep the placeholder
    }
    return { id, name: info?.title ?? id, status: info?.stopped ? 'stopped' : info?.status === 'error' ? 'error' : 'done', reply };
  }

  function requireChild(caller: string, id: string): SessionInfo {
    const info = deps.hub().get(id);
    if (!info) throw new Error(`No agent "${id}". Use agent_status to list yours.`);
    if (!isBelow(caller, id)) throw new Error(`Agent "${id}" is not one of your sub-agents.`);
    return info;
  }

  return {
    jobs,

    async spawn(caller: string, params: SpawnParams, signal?: AbortSignal): Promise<string> {
      const hub = deps.hub();
      const name = params.name.trim();
      const task = params.task.trim();
      if (!name || !task) throw new Error('spawn_agent needs a name and a task.');
      const parent = hub.get(caller);
      if (!parent) throw new Error(`Unknown calling session "${caller}".`);
      const depth = depthOf(caller);
      if (depth >= MAX_AGENT_DEPTH) {
        throw new Error(`Depth limit reached: sub-agents may nest ${MAX_AGENT_DEPTH} levels deep and you are at level ${depth}. Do this yourself or return to your parent.`);
      }
      const root = rootOf(parent);
      const running = hub.descendants(root).filter((d) => hub.isBusy(d.id)).length + (inflight.get(root) ?? 0);
      if (running >= MAX_CONCURRENT_CHILDREN) {
        throw new Error(`Too many sub-agents running (${running} of ${MAX_CONCURRENT_CHILDREN}). Wait for some with agent_wait or stop one with agent_stop, then spawn again.`);
      }
      inflight.set(root, (inflight.get(root) ?? 0) + 1);
      let job: Promise<ChildResult>;
      let child: SessionInfo;
      const controller = new AbortController();
      try {
        const model = params.model ?? parent.model;
        child = await hub.create({
          title: name,
          kind: 'node',
          parentId: caller,
          role: params.role.trim(),
          task,
          spawnedBy: 'agent',
          ...(model ? { model } : {}),
        });
        job = startRun(child.id, task, controller.signal);
      } finally {
        inflight.set(root, Math.max(0, (inflight.get(root) ?? 1) - 1));
      }
      log({ type: 'spawn', from: caller, to: child.id, text: task, toName: name });
      deps.canvas?.spawned(root);

      if (params.wait === false) {
        return `Started agent "${name}" with id ${child.id}. It is working now; collect its reply with agent_wait {ids: ["${child.id}"]}.`;
      }
      const stop = () => void hub.stop(child.id).catch(() => undefined);
      signal?.addEventListener('abort', stop, { once: true });
      try {
        return format(await job);
      } finally {
        signal?.removeEventListener('abort', stop);
      }
    },

    async wait(caller: string, ids: string[], signal?: AbortSignal): Promise<string> {
      if (!ids.length) throw new Error('agent_wait needs at least one id.');
      for (const id of ids) requireChild(caller, id);
      const results = await Promise.all(ids.map((id) => settle(id, signal)));
      return results.map(format).join('\n\n');
    },

    status(caller: string, id?: string): string {
      const hub = deps.hub();
      const top = id ? requireChild(caller, id) : hub.get(caller);
      if (!top) throw new Error(`Unknown session "${caller}".`);
      const below = hub.descendants(top.id);
      if (id) below.unshift(top);
      if (!below.length) return 'No sub-agents yet.';
      const line = (s: SessionInfo, depth: number): string => {
        const state = s.status === 'running' ? `running${s.currentStep ? ` · ${s.currentStep}` : ''}` : s.stopped ? 'stopped' : s.status === 'error' ? 'error' : s.finishedAt ? 'done' : 'idle';
        const used = s.usage ? ` · ${tokens(s.usage.inputTokens + s.usage.outputTokens)} tokens` : '';
        const last = s.preview ? `\n${'  '.repeat(depth + 1)}last: "${clip(s.preview, 140)}"` : '';
        return `${'  '.repeat(depth)}- ${s.title} (${s.id}) [${state}${used}]${last}`;
      };
      const out: string[] = [];
      const walk = (parent: string, depth: number) => {
        for (const s of below.filter((b) => (b.parentId ?? '') === parent).sort((a, b) => a.createdAt - b.createdAt)) {
          out.push(line(s, depth));
          walk(s.id, depth + 1);
        }
      };
      if (id) {
        out.push(line(top, 0));
        walk(top.id, 1);
      } else walk(caller, 0);
      return out.join('\n');
    },

    /** Steers a running agent (queued after its current tool calls) or restarts an idle one. */
    async message(from: string, id: string, text: string, opts: { check?: boolean } = {}): Promise<'steered' | 'started'> {
      const hub = deps.hub();
      if (opts.check !== false) requireChild(from, id);
      else if (!hub.get(id)) throw new SessionError(404, `No session "${id}".`);
      if (!text.trim()) throw new Error('A message is required.');
      log({ type: 'message', from, to: id, text, fromName: from === 'user' ? 'You' : nameOf(from) });
      if (hub.isBusy(id)) {
        await hub.steer(id, text);
        return 'steered';
      }
      void startRun(id, text);
      return 'started';
    },

    async stop(from: string, id: string, opts: { check?: boolean } = {}): Promise<void> {
      const hub = deps.hub();
      if (opts.check !== false) requireChild(from, id);
      else if (!hub.get(id)) throw new SessionError(404, `No session "${id}".`);
      log({ type: 'stop', from, to: id, text: 'stopped', fromName: from === 'user' ? 'You' : nameOf(from) });
      await hub.stop(id);
    },
  };
}

/* ── Feature module ───────────────────────────────────────────────── */

const LOG_CAP = 300;

function readLog(file: string): SwarmEvent[] {
  try {
    const list = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    return Array.isArray(list) ? (list as SwarmEvent[]) : [];
  } catch {
    return [];
  }
}

export function createSwarm(context: FeatureContext): FeatureModule {
  const logFile = path.join(context.workspace, '.aicl', 'swarm-log.json');
  let events = readLog(logFile);

  const canvas = createSwarmCanvas({
    relay: context.relay,
    snapshot(rootId) {
      const hub = context.hub();
      const root = hub.get(rootId);
      return root ? { root, sessions: hub.descendants(rootId) } : undefined;
    },
  });

  const logic = createSwarmLogic({
    hub: () => context.hub(),
    canvas,
    emit(event) {
      events = [...events, event].slice(-LOG_CAP);
      try {
        mkdirSync(path.dirname(logFile), { recursive: true });
        writeFileSync(logFile, JSON.stringify(events));
      } catch (cause) {
        console.error('swarm: could not save the log', cause);
      }
      context.relay.broadcast({ type: 'swarm', event });
    },
  });

  const caller = (ctx: unknown) => sessionIdFromToolContext(ctx);
  const reply = (text: string) => ({ content: [{ type: 'text' as const, text }], details: {} });

  const spawnAgent = defineTool({
    name: 'spawn_agent',
    label: 'Spawn a sub-agent',
    description:
      'Create a sub-agent with its own conversation and give it a task. wait true (default): returns its final reply. wait false: returns its id immediately so several run in parallel; collect them with agent_wait. The sub-agent does not see this conversation: make the task self-contained.',
    parameters: Type.Object({
      name: Type.String({ description: 'Short display name, e.g. "Reviewer 1".' }),
      role: Type.String({ description: 'One sentence: who it is and how it should work.' }),
      task: Type.String({ description: 'What to do, with everything it needs.' }),
      wait: Type.Optional(Type.Boolean({ description: 'Wait for the reply (default true). false = fan out.' })),
      model: Type.Optional(Type.String({ description: '"provider/id"; default: your model.' })),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      return reply(await logic.spawn(caller(ctx), params, signal));
    },
  });

  const agentWait = defineTool({
    name: 'agent_wait',
    label: 'Wait for sub-agents',
    description: 'Wait until all the given sub-agents have finished and return each one\'s final reply (fan-in after spawn_agent wait:false).',
    parameters: Type.Object({ ids: Type.Array(Type.String(), { minItems: 1 }) }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      return reply(await logic.wait(caller(ctx), params.ids, signal));
    },
  });

  const agentStatus = defineTool({
    name: 'agent_status',
    label: 'Sub-agent status',
    description: 'The tree of your sub-agents (or one agent and what it spawned): state, current step, tokens, last reply excerpt.',
    parameters: Type.Object({ id: Type.Optional(Type.String()) }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      return reply(logic.status(caller(ctx), params.id));
    },
  });

  const agentMessage = defineTool({
    name: 'agent_message',
    label: 'Message a sub-agent',
    description: 'Steer a sub-agent: the message is delivered after its current tool calls. If it has finished, it starts a new run with the message.',
    parameters: Type.Object({ id: Type.String(), text: Type.String() }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const mode = await logic.message(caller(ctx), params.id, params.text);
      return reply(mode === 'steered' ? 'Delivered; it will see the message after its current step.' : 'It was idle: started a new run with your message. Collect it with agent_wait.');
    },
  });

  const agentStop = defineTool({
    name: 'agent_stop',
    label: 'Stop a sub-agent',
    description: 'Stop a running sub-agent (and anything it spawned).',
    parameters: Type.Object({ id: Type.String() }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      await logic.stop(caller(ctx), params.id);
      return reply(`Stopped ${params.id}.`);
    },
  });

  return {
    tools: [spawnAgent, agentWait, agentStatus, agentMessage, agentStop],
    prompt: SWARM_PROMPT,
    onAgentEvent(sessionId, event) {
      const type = (event as { type?: string } | undefined)?.type;
      if (type !== 'agent_start' && type !== 'agent_end') return;
      const s = context.hub().get(sessionId);
      if (s?.parentId || (s && context.hub().descendants(sessionId).length)) canvas.changed(s.rootId ?? s.id);
    },
    routes: {
      'GET /api/swarm/log': (_req, res) => json(res, 200, { events }),
      'POST /api/swarm/:id/message': async (req, res, { params }) => {
        const body = await readJson<{ text?: unknown }>(req);
        if (typeof body.text !== 'string' || !body.text.trim()) return json(res, 400, { message: 'text is required.' });
        try {
          json(res, 200, { ok: true, mode: await logic.message('user', params['id']!, body.text, { check: false }) });
        } catch (cause) {
          if (cause instanceof SessionError) return json(res, cause.status, { message: cause.message });
          json(res, 409, { message: cause instanceof Error ? cause.message : String(cause) });
        }
      },
      'POST /api/swarm/:id/stop': async (_req, res, { params }) => {
        await logic.stop('user', params['id']!, { check: false });
        json(res, 200, { ok: true });
      },
    },
  };
}
