/**
 * Wave 2, work package A — human in the loop: the ask_user tool, the approval
 * gate on bash and out-of-.aicl writes, and /api/hitl.
 * CONTRACT: shared/agentic.ts + server/feature.ts.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defineTool, type InlineExtension } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { FREE_WRITE_PREFIX, GATED_TOOLS, type HitlAnswer, type HitlRequest, type QuestionOption } from '../shared/agentic.ts';
import { MAIN_SESSION_ID, type ServerEvent } from '../shared/runtime.ts';
import type { FeatureContext, FeatureModule } from './feature.ts';
import { json, readJson } from './http.ts';
import { sessionIdFromToolContext } from './session-context.ts';

/* ── Pure helpers ─────────────────────────────────────────────────── */

/** True when write/edit may touch `target` without asking: inside <workspace>/.aicl/. */
export function isFreeWrite(workspace: string, target: string): boolean {
  if (!target) return false;
  const rel = path.relative(workspace, path.resolve(workspace, target));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return rel.split(path.sep).join('/').startsWith(FREE_WRITE_PREFIX);
}

/** Does this tool call need approval? */
export function needsApproval(workspace: string, tool: string, input: unknown): boolean {
  if ((GATED_TOOLS as readonly string[]).includes(tool)) return true;
  if (tool === 'write' || tool === 'edit') {
    const target = (input as { path?: unknown } | undefined)?.path;
    return typeof target !== 'string' || !isFreeWrite(workspace, target);
  }
  return false;
}

const oneLine = (s: string, max = 100) => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

/** Human summary of a gated call: "Run `npm test`", "Write src/app.ts (42 lines)". */
export function summarizeCall(tool: string, input: unknown): string {
  const args = (input ?? {}) as Record<string, unknown>;
  const file = typeof args['path'] === 'string' ? args['path'] : 'a file';
  switch (tool) {
    case 'bash':
      return `Run \`${oneLine(String(args['command'] ?? ''))}\``;
    case 'terminal_run':
      return `Run \`${oneLine(String(args['command'] ?? ''))}\` in a terminal`;
    case 'write': {
      const content = typeof args['content'] === 'string' ? args['content'] : '';
      const lines = content ? content.split('\n').length - (content.endsWith('\n') ? 1 : 0) : 0;
      return `Write ${file} (${lines} line${lines === 1 ? '' : 's'})`;
    }
    case 'edit': {
      const edits = Array.isArray(args['edits']) ? args['edits'].length : 1;
      return `Edit ${file} (${edits} change${edits === 1 ? '' : 's'})`;
    }
    default:
      return `Use ${tool}`;
  }
}

/** The text an ask_user call returns to the model. */
export function describeAnswer(request: Extract<HitlRequest, { kind: 'question' }>, answer: HitlAnswer | null): string {
  if (!answer || answer.kind !== 'question') return 'The user dismissed the question without answering.';
  const chosen = answer.optionIds
    .map((id) => request.options.find((o) => o.id === id)?.label)
    .filter((label): label is string => Boolean(label));
  const parts: string[] = [];
  if (chosen.length) parts.push(`The user chose: ${chosen.join(', ')}.`);
  if (answer.text?.trim()) parts.push(`The user wrote: ${answer.text.trim()}`);
  return parts.length ? parts.join(' ') : 'The user dismissed the question without answering.';
}

/* ── Registry ─────────────────────────────────────────────────────── */

interface Waiting {
  request: HitlRequest;
  resolve: (answer: HitlAnswer | null) => void;
  detach: () => void;
}

export interface ResolvedRequest {
  request: HitlRequest;
  answer: HitlAnswer;
}

/** How many answered requests are kept, so cards can still show the choice after a reload. */
const RESOLVED_CAP = 200;

/**
 * Pending requests and the promises waiting on them. `emit` broadcasts to
 * browsers; `history` seeds and persists the answered ones.
 */
export function createRegistry(
  emit: (event: Extract<ServerEvent, { type: 'hitl' | 'hitl-resolved' }>) => void,
  history: { initial?: ResolvedRequest[]; save?: (resolved: ResolvedRequest[]) => void } = {},
) {
  const waiting = new Map<string, Waiting>();
  let resolved = (history.initial ?? []).slice(-RESOLVED_CAP);

  const cancelled = (request: HitlRequest): HitlAnswer =>
    request.kind === 'question' ? { kind: 'question', optionIds: [] } : { kind: 'approval', approved: false, note: 'cancelled' };

  return {
    /** Registers `request` and resolves with the answer, or null when aborted. */
    ask(request: HitlRequest, signal?: AbortSignal): Promise<HitlAnswer | null> {
      return new Promise((resolve) => {
        const finish = (answer: HitlAnswer | null) => {
          const entry = waiting.get(request.id);
          if (!entry) return;
          waiting.delete(request.id);
          entry.detach();
          const final = answer ?? cancelled(request);
          resolved = [...resolved, { request, answer: final }].slice(-RESOLVED_CAP);
          history.save?.(resolved);
          emit({ type: 'hitl-resolved', id: request.id, answer: final });
          resolve(answer);
        };
        const onAbort = () => finish(null);
        signal?.addEventListener('abort', onAbort, { once: true });
        waiting.set(request.id, { request, resolve: finish, detach: () => signal?.removeEventListener('abort', onAbort) });
        emit({ type: 'hitl', request });
        if (signal?.aborted) onAbort();
      });
    },
    /** Resolves a waiting request; false when unknown or the answer kind does not fit. */
    answer(id: string, answer: HitlAnswer): boolean {
      const entry = waiting.get(id);
      if (!entry || entry.request.kind !== answer.kind) return false;
      entry.resolve(answer);
      return true;
    },
    pending: (): HitlRequest[] => [...waiting.values()].map((w) => w.request),
    resolved: (): ResolvedRequest[] => resolved,
  };
}

export type HitlRegistry = ReturnType<typeof createRegistry>;

let activeRegistry: HitlRegistry | null = null;

/**
 * For feature modules whose own tools or routes need an explicit OK (git
 * commit, review submission): shows an approval card and resolves with the
 * answer. Declines when the HITL module is not running.
 */
export async function requestApproval(
  request: { sessionId?: string; tool: string; summary: string; input?: unknown; toolCallId?: string },
  signal?: AbortSignal,
): Promise<{ approved: boolean; note?: string }> {
  if (!activeRegistry) return { approved: false, note: 'approvals are unavailable' };
  const answer = await activeRegistry.ask(
    {
      kind: 'approval',
      id: randomUUID(),
      sessionId: request.sessionId ?? MAIN_SESSION_ID,
      ...(request.toolCallId ? { toolCallId: request.toolCallId } : {}),
      tool: request.tool,
      summary: request.summary,
      input: request.input ?? {},
      createdAt: Date.now(),
    },
    signal,
  );
  if (answer?.kind === 'approval') return { approved: answer.approved, ...(answer.note ? { note: answer.note } : {}) };
  return { approved: false, note: 'cancelled' };
}

/* ── Feature module ───────────────────────────────────────────────── */

const PROMPT = `Asking the user:
- Use ask_user for a real fork the user should decide (which approach, which of a few designs, a preference you cannot infer), not for trivia you can decide yourself. Keep options few (2–4) and concrete, each with a short label. Set allowText when none of the options may fit. After the answer, continue with their choice.
- bash commands, and write/edit outside .aicl/, pause for the user's approval. Do not ask in chat first; just make the call. If it is declined, respect the note and propose an alternative instead of retrying the same call.`;

function readHistory(file: string): ResolvedRequest[] {
  try {
    const list = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    return Array.isArray(list) ? (list as ResolvedRequest[]) : [];
  } catch {
    return [];
  }
}

/** Same as requestApproval (the browser surface's name for it). */
export const askApproval = requestApproval;

export function createHitl(context: FeatureContext): FeatureModule {
  const historyFile = path.join(context.workspace, '.aicl', 'hitl.json');
  const registry = createRegistry((event) => context.relay.broadcast(event), {
    initial: readHistory(historyFile),
    save: (resolved) => {
      try {
        mkdirSync(path.dirname(historyFile), { recursive: true });
        writeFileSync(historyFile, JSON.stringify(resolved));
      } catch (cause) {
        console.error('hitl: could not save history', cause);
      }
    },
  });

  activeRegistry = registry;

  const askUser = defineTool({
    name: 'ask_user',
    label: 'Ask the user',
    description:
      'Ask the user a question and wait for their answer. Shows option buttons in the chat. Use for real decisions only; keep options few and concrete.',
    parameters: Type.Object({
      question: Type.String(),
      options: Type.Array(
        Type.Object({
          id: Type.Optional(Type.String()),
          label: Type.String(),
          description: Type.Optional(Type.String()),
        }),
        { minItems: 1 },
      ),
      multiple: Type.Optional(Type.Boolean({ description: 'Allow choosing several options.' })),
      allowText: Type.Optional(Type.Boolean({ description: 'Also allow a free-text answer.' })),
    }),
    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      const options: QuestionOption[] = params.options.map((o, i) => ({
        id: o.id?.trim() || `opt-${i + 1}`,
        label: o.label,
        ...(o.description ? { description: o.description } : {}),
      }));
      const request: Extract<HitlRequest, { kind: 'question' }> = {
        kind: 'question',
        id: randomUUID(),
        sessionId: sessionIdFromToolContext(ctx),
        toolCallId,
        question: params.question,
        options,
        ...(params.multiple ? { multiple: true } : {}),
        ...(params.allowText ? { allowText: true } : {}),
        createdAt: Date.now(),
      };
      const answer = await registry.ask(request, signal);
      return { content: [{ type: 'text' as const, text: describeAnswer(request, answer) }], details: {} };
    },
  });

  const gate: InlineExtension = {
    name: 'hitl-gate',
    hidden: true,
    factory: (pi) => {
      pi.on('tool_call', async (event, ctx) => {
        if (!needsApproval(context.workspace, event.toolName, event.input)) return undefined;
        const request: HitlRequest = {
          kind: 'approval',
          id: randomUUID(),
          sessionId: sessionIdFromToolContext(ctx),
          toolCallId: event.toolCallId,
          tool: event.toolName,
          summary: summarizeCall(event.toolName, event.input),
          input: event.input,
          createdAt: Date.now(),
        };
        const answer = await registry.ask(request, ctx.signal);
        if (answer?.kind === 'approval' && answer.approved) return undefined;
        const note = answer?.kind === 'approval' ? answer.note?.trim() : '';
        return { block: true, reason: `The user declined: ${note || (answer ? 'no reason given' : 'the turn was cancelled')}` };
      });
    },
  };

  return {
    routes: {
      'GET /api/hitl': (_req, res) => json(res, 200, { pending: registry.pending(), resolved: registry.resolved() }),
      'POST /api/hitl/:id': async (req, res, { params }) => {
        const body = await readJson<HitlAnswer>(req);
        if (body?.kind !== 'question' && body?.kind !== 'approval') return json(res, 400, { message: 'bad answer' });
        const ok = registry.answer(params['id']!, body);
        return json(res, ok ? 200 : 404, ok ? { ok: true } : { message: 'no such pending request' });
      },
    },
    tools: [askUser],
    prompt: PROMPT,
    extensions: [gate],
  };
}
