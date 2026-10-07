/**
 * Wave 2, package B — live work (browser): the agent's plan and its shell
 * output, in chat (PlanUpdatePart, BashPart) and on the canvas (see
 * web/catalog/live-plan.tsx, live-terminal.tsx). CONTRACT: shared/agentic.ts.
 */
import { useEffect, useRef, useState } from 'react';
import type { Message, ToolCallPart } from '@aicl/core';
import { PlanChecklist, TerminalOutput, type PartProps, type PlanItem } from '@aicl/react';
import { useSessionChat, useTranscriptSessionId } from '../sessionsApi.ts';
import { usePlan, useTerminal, type TerminalState } from './liveData.ts';

/** How many lines a long terminal shows until expanded. */
const COLLAPSED_LINES = 6;

const asItems = (steps: unknown): PlanItem[] =>
  Array.isArray(steps)
    ? steps.flatMap((s, i) => {
        const step = s as { id?: unknown; label?: unknown; status?: unknown };
        if (typeof step?.label !== 'string') return [];
        const status = ['pending', 'running', 'done', 'error'].includes(String(step.status)) ? (step.status as PlanItem['status']) : 'pending';
        return [{ id: typeof step.id === 'string' ? step.id : `i${i}`, label: step.label, status }];
      })
    : [];

/** A session's live plan; before the first event, whatever the tool call carried. */
export function LivePlanView({ sessionId, fallback }: { sessionId: string; fallback?: { title?: string; steps?: unknown } }) {
  const plan = usePlan(sessionId);
  const items = plan ? plan.steps : asItems(fallback?.steps);
  const title = plan ? plan.title : fallback?.title;
  if (!items.length) return <div className="aicl-cmp-empty">No plan yet.</div>;
  return (
    <div className="aicl-live-plan" data-live="plan">
      <PlanChecklist items={items} title={title} />
    </div>
  );
}

/** Terminal output that keeps its tail in view while it streams. */
export function TerminalView({
  state,
  command,
  running,
  collapsible,
}: {
  state: TerminalState | null;
  command?: string;
  running: boolean;
  collapsible?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const all = state ? (state.partial ? [...state.lines, state.partial] : state.lines) : [];
  const long = !!collapsible && all.length > COLLAPSED_LINES;
  const lines = long && !open ? all.slice(-COLLAPSED_LINES) : all;
  const cmd = state?.command ?? command;
  const exit = state?.exitCode;

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-aicl="terminal-output"]');
    if (el) el.scrollTop = el.scrollHeight;
  });

  return (
    <div className="aicl-live-terminal" data-live="terminal" data-running={running || undefined} ref={ref}>
      {cmd ? (
        <div className="aicl-live-terminal-cmd">
          <span aria-hidden>$</span> <code>{cmd}</code>
        </div>
      ) : null}
      {long && !open ? <div className="aicl-live-terminal-more">… {all.length - COLLAPSED_LINES} earlier lines</div> : null}
      <TerminalOutput lines={lines.length ? lines : running ? [''] : ['(no output)']} streaming={running} />
      <div className="aicl-live-terminal-foot">
        {state?.done || !running ? (
          <span data-exit={exit === 0 || exit === undefined ? 'ok' : 'fail'}>{exit === undefined || exit === 0 ? 'exit 0' : `exit ${exit}`}</span>
        ) : (
          <span>running…</span>
        )}
        {long ? (
          <button type="button" onClick={() => setOpen((v) => !v)}>
            {open ? 'Show less' : 'Show all'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const lastPlanCallId = (messages: Message[]): string | undefined => {
  for (let m = messages.length - 1; m >= 0; m--) {
    const parts = messages[m]!.parts;
    for (let p = parts.length - 1; p >= 0; p--) {
      const part = parts[p]!;
      if (part.type === 'tool-call' && part.name === 'plan_update') return part.toolCallId;
    }
  }
  return undefined;
};

export function PlanUpdatePart({ part }: PartProps) {
  const sessionId = useTranscriptSessionId();
  const { messages } = useSessionChat(sessionId);
  if (part.type !== 'tool-call') return null;
  const call = part as ToolCallPart;
  if (lastPlanCallId(messages) !== call.toolCallId) {
    return (
      <div data-aicl="part" data-part="plan-update-old" className="aicl-live-quiet">
        Updated the plan
      </div>
    );
  }
  const args = call.args as { title?: string; steps?: unknown } | undefined;
  return <LivePlanView sessionId={sessionId} fallback={args} />;
}

export function BashPart({ part }: PartProps) {
  const sessionId = useTranscriptSessionId();
  const call = part.type === 'tool-call' ? (part as ToolCallPart) : null;
  const state = useTerminal(sessionId, call?.toolCallId);
  if (!call) return null;
  const command = (call.args as { command?: string } | undefined)?.command;
  const running = !state?.done && (call.status === 'pending' || call.status === 'running');
  return <TerminalView state={state} command={command} running={running} collapsible />;
}
