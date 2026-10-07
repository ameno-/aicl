import type { Message, Part } from '@aicl/core';
import { RUN_COMPOSER_ID, RUN_THREAD_ID } from '../../shared/agentic.ts';
import type { UiNode } from '../../shared/ui-spec.ts';

/** Pure helpers behind a screen's run mode (no React, so they unit-test under node). */

export interface RunTargets {
  /** Node whose children become the live thread. */
  threadId: string | undefined;
  /** Node that becomes the live composer. */
  composerId: string | undefined;
  /** Children of the thread node that stay (the composer, when the thread is its column). */
  keepIds: string[];
}

const kidsOf = (n: UiNode): UiNode[] => (Array.isArray(n.children) ? n.children : []);

function walk(n: UiNode, fn: (n: UiNode, parent: UiNode | null) => void, parent: UiNode | null = null, depth = 0) {
  if (!n || typeof n !== 'object' || depth > 40) return;
  fn(n, parent);
  for (const c of kidsOf(n)) walk(c, fn, n, depth + 1);
}

export function findRunTargets(root: UiNode): RunTargets {
  let composer: { node: UiNode; parent: UiNode | null } | undefined;
  let thread: UiNode | undefined;
  let scroller: UiNode | undefined;
  walk(root, (n, parent) => {
    if (n.id === RUN_COMPOSER_ID) composer = { node: n, parent };
    else if (!composer && n.type === 'composer') composer = { node: n, parent };
    if (n.id === RUN_THREAD_ID) thread = n;
    const p = n.props as Record<string, unknown> | undefined;
    if (!scroller && (n.type === 'column' || n.type === 'row') && p?.['scroll'] === true) scroller = n;
  });
  const c = composer as { node: UiNode; parent: UiNode | null } | undefined;
  const found = (thread ?? scroller) as UiNode | undefined;
  const composerId = c?.node.id;
  if (found) return { threadId: found.id, composerId, keepIds: [] };
  if (c?.parent) return { threadId: c.parent.id, composerId, keepIds: [c.node.id] };
  return { threadId: undefined, composerId, keepIds: [] };
}

type ToolCall = Extract<Part, { type: 'tool-call' }>;

export interface BuildOptions {
  streamingId?: string | undefined;
  busy: boolean;
  label: (part: ToolCall) => string;
}

const isToolCall = (p: Part): p is ToolCall => p.type === 'tool-call';

/** Maps session messages onto the screen's own chat element types. */
export function buildThread(messages: Message[], opts: BuildOptions): UiNode[] {
  const out: UiNode[] = [];
  let lastPlan = -1;
  // The agent's plan is the latest plan_update call; it renders once, at that spot.
  messages.forEach((m, mi) =>
    m.parts.forEach((p, pi) => {
      if (isToolCall(p) && p.name === 'plan_update') lastPlan = mi * 10000 + pi;
    }),
  );
  messages.forEach((m, mi) => {
    const live = opts.busy && m.id === opts.streamingId;
    let text = '';
    const flush = (key: string) => {
      if (text.trim()) {
        out.push({ id: `run-${m.id}-t${key}`, type: m.role === 'user' ? 'userMessage' : 'assistantMessage', props: { text } });
      }
      text = '';
    };
    m.parts.forEach((p, pi) => {
      const key = String(pi);
      if (p.type === 'text') {
        text += p.text;
        return;
      }
      if (m.role === 'user') return;
      if (p.type === 'reasoning') {
        flush(key);
        const streaming = live && pi === m.parts.length - 1;
        const props: Record<string, unknown> = { streaming };
        if (p.text) props['text'] = p.text;
        if (!streaming && typeof p.durationMs === 'number') props['durationSec'] = Math.max(1, Math.round(p.durationMs / 1000));
        out.push({ id: `run-${m.id}-r${key}`, type: 'reasoning', props });
      } else if (isToolCall(p)) {
        flush(key);
        if (p.name === 'plan_update') {
          if (mi * 10000 + pi !== lastPlan) return;
          const a = (p.args ?? {}) as { title?: unknown; steps?: unknown };
          const steps = Array.isArray(a.steps)
            ? a.steps.flatMap((s) => {
                const o = (s ?? {}) as { label?: unknown; status?: unknown };
                return typeof o.label === 'string' ? [{ label: o.label, status: typeof o.status === 'string' ? o.status : 'pending' }] : [];
              })
            : [];
          if (steps.length) out.push({ id: 'run-plan', type: 'plan', props: { ...(typeof a.title === 'string' ? { title: a.title } : {}), steps } });
          return;
        }
        out.push({ id: `run-${m.id}-s${key}`, type: 'toolStep', props: { label: opts.label(p), status: p.status } });
      }
    });
    flush('end');
  });
  if (opts.busy) {
    const last = out[out.length - 1];
    const thinking = last?.type === 'reasoning' && (last.props as Record<string, unknown>)['streaming'] === true;
    if (!thinking) out.push({ id: 'run-streaming', type: 'reasoning', props: { streaming: true } });
  }
  return out;
}

/** Where a screen keeps the session bound to it: the root node's props (normalizeSpec drops unknown top-level fields). */
export function readRunSessionId(root: UiNode | undefined): string | undefined {
  const v = (root?.props as Record<string, unknown> | undefined)?.['runSessionId'];
  return typeof v === 'string' && v ? v : undefined;
}

export function withRunSessionId<T extends { root: UiNode }>(spec: T, sessionId: string): T {
  return { ...spec, root: { ...spec.root, props: { ...(spec.root.props ?? {}), runSessionId: sessionId } } };
}
