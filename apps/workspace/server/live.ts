/**
 * Wave 2, work package B — live plan (plan_update) and streaming terminal output.
 * CONTRACT: shared/agentic.ts + server/feature.ts.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { LivePlan, LivePlanStep, TerminalChunk } from '../shared/agentic.ts';
import { json } from './http.ts';
import type { FeatureContext, FeatureModule } from './feature.ts';
import { sessionIdFromToolContext } from './session-context.ts';

export const MAX_TERMINAL_LINES = 400;
const STATUSES = ['pending', 'running', 'done', 'error'] as const;

export const LIVE_PROMPT = `# Live plan and terminal

For multi-step work, call plan_update first with the steps (status "pending"), then call it again as you go: mark the step you are on "running" and finished ones "done" (or "error"). Each call replaces the whole plan; keep labels unchanged so steps keep their identity. The user watches the plan live. Commands you run with bash stream to the user live, so there is no need to paste their output back.`;

/* ── plan ─────────────────────────────────────────────────────────── */

interface StepInput {
  id?: string;
  label: string;
  status?: string;
}

/** Replace a plan: ids stay stable by label (or by the id given); new steps get fresh ids. */
export function applyPlan(sessionId: string, previous: LivePlan | null, input: { title?: string; steps: StepInput[] }, now = Date.now()): LivePlan {
  const byLabel = new Map((previous?.steps ?? []).map((s) => [s.label, s.id]));
  const taken = new Set<string>();
  const reserved = new Set((previous?.steps ?? []).map((s) => s.id));
  let counter = 0;
  const steps: LivePlanStep[] = input.steps.map((s) => {
    let id = s.id && !taken.has(s.id) ? s.id : byLabel.get(s.label);
    if (!id || taken.has(id)) {
      do id = `s${++counter}`;
      while (taken.has(id) || reserved.has(id));
    }
    taken.add(id);
    const status = (STATUSES as readonly string[]).includes(s.status ?? '') ? (s.status as LivePlanStep['status']) : 'pending';
    return { id, label: s.label, status };
  });
  return { sessionId, ...(input.title ? { title: input.title } : {}), steps, updatedAt: now };
}

export function renderPlan(plan: LivePlan): string {
  const mark = { pending: '[ ]', running: '[~]', done: '[x]', error: '[!]' } as const;
  const done = plan.steps.filter((s) => s.status === 'done').length;
  return [`${plan.title ?? 'Plan'} (${done}/${plan.steps.length} done)`, ...plan.steps.map((s) => `${mark[s.status]} ${s.id} ${s.label}`)].join('\n');
}

/* ── terminal ─────────────────────────────────────────────────────── */

/** The text in `next` that `prev` did not already show (Pi sends rolling snapshots of the output tail). */
export function newText(prev: string, next: string): string {
  if (next.startsWith(prev)) return next.slice(prev.length);
  for (let k = Math.min(prev.length, next.length); k > 0; k--) {
    if (prev.endsWith(next.slice(0, k))) return next.slice(k);
  }
  return next;
}

interface TerminalState {
  command?: string;
  lines: string[];
  /** Unfinished last line. */
  partial: string;
  snapshot: string;
  done: boolean;
  exitCode?: number;
}

const textOf = (result: unknown): string => {
  const content = (result as { content?: Array<{ type?: string; text?: string }> } | undefined)?.content;
  return Array.isArray(content) ? content.map((c) => (c.type === 'text' ? (c.text ?? '') : '')).join('') : '';
};

const EXIT_RE = /\n*Command exited with code (\d+)\s*$/;

export function createLive(context: FeatureContext): FeatureModule {
  const plansDir = path.join(context.workspace, '.aicl', 'plans');
  const plans = new Map<string, LivePlan | null>();
  const terminals = new Map<string, Map<string, TerminalState>>(); // session → toolCallId → state
  const latestTool = new Map<string, string>();

  const planFile = (sessionId: string) => path.join(plansDir, `${encodeURIComponent(sessionId)}.json`);

  const getPlan = (sessionId: string): LivePlan | null => {
    if (plans.has(sessionId)) return plans.get(sessionId)!;
    let plan: LivePlan | null = null;
    try {
      plan = JSON.parse(readFileSync(planFile(sessionId), 'utf8')) as LivePlan;
    } catch {
      /* none yet */
    }
    plans.set(sessionId, plan);
    return plan;
  };

  const setPlan = (plan: LivePlan) => {
    plans.set(plan.sessionId, plan);
    try {
      mkdirSync(plansDir, { recursive: true });
      writeFileSync(planFile(plan.sessionId), JSON.stringify(plan, null, 2));
    } catch {
      /* in-memory still works */
    }
    context.relay.broadcast({ type: 'plan', plan });
  };

  const plan_update = defineTool({
    name: 'plan_update',
    label: 'Update plan',
    description:
      'Your own live todo list, shown to the user. Replaces the whole plan. Steps: { label, status: pending|running|done|error, id? }. Keep labels stable across calls; call again to mark progress.',
    parameters: Type.Object({
      title: Type.Optional(Type.String()),
      steps: Type.Array(
        Type.Object({
          id: Type.Optional(Type.String()),
          label: Type.String(),
          status: Type.Optional(Type.Union(STATUSES.map((s) => Type.Literal(s)))),
        }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const sessionId = sessionIdFromToolContext(ctx);
      const plan = applyPlan(sessionId, getPlan(sessionId), params);
      setPlan(plan);
      return { content: [{ type: 'text' as const, text: renderPlan(plan) }], details: {} };
    },
  });

  const terminalFor = (sessionId: string, toolCallId: string): TerminalState => {
    let session = terminals.get(sessionId);
    if (!session) terminals.set(sessionId, (session = new Map()));
    let t = session.get(toolCallId);
    if (!t) {
      t = { lines: [], partial: '', snapshot: '', done: false };
      session.set(toolCallId, t);
      // Bound memory: keep the 20 most recent commands per session.
      while (session.size > 20) session.delete(session.keys().next().value!);
    }
    return t;
  };

  const append = (t: TerminalState, text: string) => {
    if (!text) return;
    const parts = (t.partial + text).split('\n');
    t.partial = parts.pop() ?? '';
    t.lines.push(...parts);
    if (t.lines.length > MAX_TERMINAL_LINES) t.lines.splice(0, t.lines.length - MAX_TERMINAL_LINES);
  };

  const emit = (sessionId: string, chunk: Omit<TerminalChunk, 'sessionId'>) =>
    context.relay.broadcast({ type: 'terminal', chunk: { sessionId, ...chunk } });

  function onAgentEvent(sessionId: string, raw: unknown): void {
    const event = raw as {
      type?: string;
      toolName?: string;
      toolCallId?: string;
      args?: { command?: string };
      partialResult?: unknown;
      result?: unknown;
      isError?: boolean;
    };
    if (event?.toolName !== 'bash' || !event.toolCallId) return;
    const id = event.toolCallId;
    if (event.type === 'tool_execution_start') {
      const t = terminalFor(sessionId, id);
      t.command = event.args?.command;
      latestTool.set(sessionId, id);
      emit(sessionId, { toolCallId: id, command: t.command, text: '' });
    } else if (event.type === 'tool_execution_update') {
      const t = terminalFor(sessionId, id);
      const snap = textOf(event.partialResult);
      const fresh = newText(t.snapshot, snap);
      t.snapshot = snap;
      append(t, fresh);
      if (fresh) emit(sessionId, { toolCallId: id, text: fresh });
    } else if (event.type === 'tool_execution_end') {
      const t = terminalFor(sessionId, id);
      let snap = textOf(event.result);
      const exit = EXIT_RE.exec(snap);
      snap = snap.replace(EXIT_RE, '');
      const fresh = snap === '(no output)' ? '' : newText(t.snapshot, snap);
      t.snapshot = snap;
      append(t, fresh);
      if (t.partial) {
        t.lines.push(t.partial);
        t.partial = '';
      }
      t.done = true;
      t.exitCode = exit ? Number(exit[1]) : event.isError ? 1 : 0;
      emit(sessionId, { toolCallId: id, text: fresh, done: true, exitCode: t.exitCode });
    }
  }

  return {
    routes: {
      'GET /api/sessions/:id/plan': (_req, res, { params }) => json(res, 200, { plan: getPlan(params['id']!) }),
      'GET /api/sessions/:id/terminal/:toolId': (_req, res, { params }) => {
        const sessionId = params['id']!;
        const toolId = params['toolId'] === 'latest' ? latestTool.get(sessionId) : params['toolId'];
        const t = toolId ? terminals.get(sessionId)?.get(toolId) : undefined;
        if (!t || !toolId) return json(res, 200, { lines: [], done: false });
        const lines = t.partial ? [...t.lines, t.partial] : t.lines;
        json(res, 200, { toolCallId: toolId, lines, done: t.done, command: t.command, exitCode: t.exitCode });
      },
    },
    tools: [plan_update],
    prompt: LIVE_PROMPT,
    onAgentEvent,
  };
}
