/**
 * Conversation building blocks per provider kit (AICL-32). KitTranscript
 * (transcript.tsx) composes them for live sessions; web/ui/nodes.tsx composes
 * the same pieces for canvas screens, so a Devin screen and the Devin app read
 * the same. Built from @aicl/fx; layout/disclosure motion uses kit.motion.spring.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion, useReducedMotionConfig } from 'motion/react';
import type { Message, ReasoningPart, ToolCallPart } from '@aicl/core';
import { Markdown } from '@aicl/react/markdown';
import { AnimatedPlan, StreamingText, ThinkingIndicator, ToolCallCard, WorkSummary, cn, type PlanStep } from '@aicl/fx';
import {
  Ban,
  Check,
  ChevronRight,
  Circle,
  Copy,
  Ellipsis,
  Lightbulb,
  LoaderCircle,
  RotateCcw,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Undo2,
  X,
} from 'lucide-react';
import { KITS, type ProviderKit } from '../../shared/kits.ts';
import './kits.css';
import { describe } from '../agentSteps.tsx';
import { ErrorBoundary } from '../ErrorBoundary.tsx';
import { TerminalView } from '../agentic/live.tsx';
import { usePlan, useTerminal, type TerminalState } from '../agentic/liveData.ts';
import { aggregateTimeline, isActive, messageText, type WorkItem } from './model.ts';

/* ── Context ──────────────────────────────────────────────────────── */

export interface KitRender {
  kit: ProviderKit;
  sessionId: string;
  /** Static terminal output by toolCallId (galleries and previews); live sessions use the event store. */
  terminals?: Record<string, TerminalState>;
  /** The one plan_update call that renders as the live plan; older ones read "Updated the plan". */
  lastPlanId?: string | undefined;
}

export const KitRenderContext = createContext<KitRender>({ kit: KITS.aicl, sessionId: 'kit-preview' });
export const useKitRender = () => useContext(KitRenderContext);

export function useReduced(): boolean {
  const a = useReducedMotionConfig();
  const b = useReducedMotion();
  return Boolean(a || b);
}

/** Seconds since `active` became true (frozen when it turns false); null when never observed active. */
export function useElapsed(active: boolean): number | null {
  const start = useRef<number | null>(active ? Date.now() : null);
  const end = useRef<number | null>(null);
  const [, tick] = useState(0);
  if (active) {
    if (start.current == null) start.current = Date.now();
    end.current = null;
  }
  if (!active && start.current != null && end.current == null) end.current = Date.now();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [active]);
  if (start.current == null) return null;
  return ((end.current ?? Date.now()) - start.current) / 1000;
}

/* ── Motion helpers ───────────────────────────────────────────────── */

/** Disclosure body that springs open with the kit's own spring. */
export function Reveal({ open, children, id }: { open: boolean; children: ReactNode; id?: string }) {
  const { kit } = useKitRender();
  const reduced = useReduced();
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="body"
          id={id}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', ...kit.motion.spring }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Chevron({ open }: { open: boolean }) {
  const reduced = useReduced();
  return (
    <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: reduced ? 0 : 0.18 }} className="inline-flex shrink-0 text-faint">
      <ChevronRight size={13} aria-hidden="true" />
    </motion.span>
  );
}

export function Glyph({ status, size = 14 }: { status: ToolCallPart['status']; size?: number }) {
  const c = { size, strokeWidth: 2.5, 'aria-hidden': true } as const;
  const reduced = useReduced();
  const node =
    status === 'running' || status === 'pending' ? (
      <LoaderCircle {...c} className={cn('text-primary', !reduced && 'animate-spin')} />
    ) : status === 'success' ? (
      <Check {...c} className="text-success" />
    ) : status === 'error' ? (
      <X {...c} className="text-destructive" />
    ) : (
      <Ban {...c} className="text-faint" />
    );
  return (
    <span data-status-icon={status} className="inline-flex size-4 shrink-0 items-center justify-center">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={status === 'pending' ? 'running' : status}
          className="inline-flex"
          initial={reduced ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.16 }}
        >
          {node}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ── Labels and bodies ────────────────────────────────────────────── */

const commandOf = (part: ToolCallPart): string | undefined => {
  const c = (part.args as { command?: unknown } | undefined)?.command;
  return typeof c === 'string' ? c : undefined;
};
const clip = (s: string, n = 48) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** A step in the product's voice. bash names its command; everything else reuses the app's describe(). */
export function stepLabel(part: ToolCallPart): string {
  if (part.name === 'bash') {
    const cmd = commandOf(part);
    if (part.status === 'error') return cmd ? `Command failed: ${clip(cmd)}` : 'Command failed';
    const done = part.status === 'success';
    return cmd ? `${done ? 'Ran' : 'Running'} ${clip(cmd)}` : done ? 'Ran a command' : 'Running a command';
  }
  return describe(part);
}

function BashBody({ part }: { part: ToolCallPart }) {
  const { sessionId, terminals } = useKitRender();
  const live = useTerminal(sessionId, part.toolCallId);
  const state = terminals?.[part.toolCallId] ?? live;
  const running = !state?.done && isActive(part.status);
  return <TerminalView state={state} command={commandOf(part)} running={running} collapsible />;
}

const hasArgs = (part: ToolCallPart) => {
  const a = part.args;
  if (part.argsText) return true;
  return typeof a === 'object' && a !== null ? Object.keys(a).length > 0 : a !== undefined && a !== null;
};

export const hasBody = (part: ToolCallPart) => part.name === 'bash' || hasArgs(part);

export function StepBody({ part }: { part: ToolCallPart }) {
  if (part.name === 'bash') return <BashBody part={part} />;
  return (
    <pre className="m-0 max-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-xs text-foreground">
      {part.argsText ?? JSON.stringify(part.args, null, 2)}
    </pre>
  );
}

/* ── Reasoning ────────────────────────────────────────────────────── */

const seconds = (r: ReasoningPart) => (r.durationMs !== undefined ? Math.max(1, Math.round(r.durationMs / 1000)) : undefined);

/** Reasoning outside a work group: muted inline block (AICL, Cofounder) or "Thought for 24s" disclosure (Lovable). */
export function ReasoningBlock({ part, active }: { part: ReasoningPart; active: boolean }) {
  const { kit } = useKitRender();
  const elapsed = useElapsed(active);
  const [open, setOpen] = useState(false);
  const sec = seconds(part);
  const thoughtFor = kit.transcript.reasoning === 'thought-for';
  const text = part.text?.trim();
  const indicator = (
    <ThinkingIndicator
      variant={kit.transcript.thinking}
      done={!active}
      {...(active ? (elapsed != null ? { elapsedMs: elapsed * 1000 } : {}) : sec ? { elapsedMs: sec * 1000 } : {})}
    />
  );
  if (!thoughtFor) {
    return (
      <div data-aicl="reasoning" data-state={active ? 'pending' : 'done'} className="flex flex-col gap-1 border-l-2 border-border pl-3 text-sm text-muted-foreground">
        {indicator}
        {text ? (
          <>
            <p className={cn('m-0 whitespace-pre-wrap leading-snug', !open && 'line-clamp-3')}>{text}</p>
            {text.length > 160 ? (
              <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-fit text-xs text-faint underline-offset-2 hover:underline">
                {open ? 'Show less' : 'Show more'}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    );
  }
  return (
    <div data-aicl="reasoning" data-state={active ? 'pending' : open ? 'open' : 'closed'} className="text-sm">
      <button
        type="button"
        aria-expanded={text ? open : undefined}
        disabled={!text}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md text-muted-foreground outline-none enabled:hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {indicator}
        {text ? <Chevron open={open} /> : null}
      </button>
      <Reveal open={open && !!text}>
        <p className="m-0 mt-1 whitespace-pre-wrap border-l-2 border-border pl-3 text-muted-foreground">{text}</p>
      </Reveal>
    </div>
  );
}

/* ── Work groups ──────────────────────────────────────────────────── */

interface GroupProps {
  items: WorkItem[];
  /** The group is still in progress (a call is running, or the turn is waiting for the next step). */
  active: boolean;
  /** Seconds to show when no live timer was observed (reloaded history). */
  fallbackSeconds: number;
}

function toolsOf(items: WorkItem[]) {
  return items.flatMap((i) => (i.kind === 'tool' ? [i] : []));
}

function ReasoningRow({ part, active }: { part: ReasoningPart; active: boolean }) {
  const [open, setOpen] = useState(false);
  const sec = seconds(part);
  const text = part.text?.trim();
  return (
    <li data-aicl="reasoning" className="py-1 text-[13px] text-muted-foreground">
      <button type="button" disabled={!text} aria-expanded={text ? open : undefined} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
        <Lightbulb size={14} aria-hidden="true" className={cn('shrink-0', active && 'text-primary')} />
        <span className={cn('italic', active && 'animate-pulse')}>{active ? 'Thinking…' : sec ? `Thought for ${sec}s` : 'Thought'}</span>
        {text ? <Chevron open={open} /> : null}
      </button>
      <Reveal open={open && !!text}>
        <p className="m-0 mt-1 whitespace-pre-wrap pl-6 text-xs leading-snug">{text}</p>
      </Reveal>
    </li>
  );
}

/** One expandable tool row. `variant` picks the look; behaviour (expand, status, live body) is shared. */
function ToolRow({ item, variant }: { item: Extract<WorkItem, { kind: 'tool' }>; variant: 'rail' | 'quiet' | 'timeline' }) {
  const { part } = item;
  const body = hasBody(part);
  const [open, setOpen] = useState(part.name === 'bash' && isActive(part.status));
  const label = stepLabel(part);
  const quiet = variant === 'quiet';
  return (
    <li data-aicl="tool-call" data-status={part.status} data-name={part.name} className="list-none">
      <button
        type="button"
        disabled={!body}
        aria-expanded={body ? open : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
          quiet ? 'text-[13px] text-muted-foreground' : 'text-[13px] text-foreground',
          body && 'enabled:hover:text-foreground',
        )}
      >
        {quiet ? <QuietMark status={part.status} /> : <Glyph status={part.status} />}
        <span className={cn('min-w-0 flex-1 truncate', quiet && isActive(part.status) && 'animate-pulse')}>{label}</span>
        {variant === 'rail' ? <span className="hidden shrink-0 font-mono text-[11px] text-faint sm:inline">{part.name}</span> : null}
        {body ? <Chevron open={open} /> : null}
      </button>
      <Reveal open={open && body}>
        <div className={cn('pb-1', quiet ? 'pl-6' : 'pl-6 pr-1')}>
          <StepBody part={part} />
        </div>
      </Reveal>
    </li>
  );
}

/** Manus: finished steps check off in a small circle; running ones pulse. */
function QuietMark({ status }: { status: ToolCallPart['status'] }) {
  if (status === 'success')
    return (
      <span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-success" data-status-icon="success">
        <Check size={10} strokeWidth={3} />
      </span>
    );
  if (status === 'error')
    return (
      <span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive" data-status-icon="error">
        <X size={10} strokeWidth={3} />
      </span>
    );
  if (status === 'cancelled') return <Ban size={14} aria-hidden="true" className="shrink-0 text-faint" />;
  return (
    <span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center" data-status-icon="running">
      <Circle size={9} className="animate-pulse fill-primary text-primary" />
    </span>
  );
}

/** Devin: the whole turn's reasoning and calls fold into "Worked for 11s". */
function DevinWork({ items, active, fallbackSeconds }: GroupProps) {
  const elapsed = useElapsed(active);
  const last = items[items.length - 1];
  return (
    <div data-aicl="work-group" data-kit-style="work-summary" data-state={active ? 'running' : 'done'}>
      <WorkSummary
        running={active}
        seconds={elapsed ?? fallbackSeconds}
        defaultOpen={active}
        steps={
          <ul className="m-0 flex list-none flex-col p-0">
            {items.map((i) =>
              i.kind === 'reasoning' ? (
                <ReasoningRow key={i.index} part={i.part} active={active && i === last && i.part.durationMs === undefined} />
              ) : (
                <ToolRow key={i.index} item={i} variant="rail" />
              ),
            )}
          </ul>
        }
      />
    </div>
  );
}

/** Manus: "<Agent> is working" with a status dot; quiet one-line rows that check off. */
function ManusWork({ items, active }: GroupProps) {
  const { kit } = useKitRender();
  const [open, setOpen] = useState(active);
  const last = items[items.length - 1];
  const tools = toolsOf(items);
  const failed = tools.some((t) => t.part.status === 'error');
  const label = active ? `${kit.vocabulary.agent} is working` : `${kit.vocabulary.agent} worked${tools.length ? ` · ${tools.length} step${tools.length === 1 ? '' : 's'}` : ''}`;
  return (
    <div data-aicl="work-group" data-kit-style="step-rows" data-state={active ? 'running' : 'done'} className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[13px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          data-fx-part="status-dot"
          aria-hidden="true"
          className={cn('size-2 rounded-full', active ? 'animate-pulse bg-primary' : failed ? 'bg-destructive' : 'bg-success')}
        />
        <span className={cn('font-medium', active && 'text-foreground')}>{label}</span>
        <Chevron open={open} />
      </button>
      <Reveal open={open}>
        <ul className="m-0 mt-2 ml-2 flex list-none flex-col border-l border-border p-0 pl-4">
          {items.map((i) =>
            i.kind === 'reasoning' ? (
              <ReasoningRow key={i.index} part={i.part} active={active && i === last && i.part.durationMs === undefined} />
            ) : (
              <ToolRow key={i.index} item={i} variant="quiet" />
            ),
          )}
        </ul>
      </Reveal>
    </div>
  );
}

/** Lovable: compact chips; click one to expand its detail below. */
function LovableChips({ items }: GroupProps) {
  const tools = toolsOf(items);
  const [openId, setOpenId] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const shown = all ? tools : tools.slice(0, 3);
  const openItem = tools.find((t) => t.part.toolCallId === openId);
  return (
    <div data-aicl="work-group" data-kit-style="collapsed" className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {tools.length > 1 ? <span className="mr-0.5 text-xs text-faint">{tools.length} tools used</span> : null}
        {shown.map((t) => {
          const body = hasBody(t.part);
          const open = openId === t.part.toolCallId;
          return (
            <button
              key={t.index}
              type="button"
              data-aicl="tool-call"
              data-status={t.part.status}
              data-name={t.part.name}
              aria-expanded={body ? open : undefined}
              disabled={!body}
              onClick={() => setOpenId(open ? null : t.part.toolCallId)}
              className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                open ? 'border-primary text-foreground' : 'border-border text-muted-foreground',
                body && 'hover:text-foreground',
              )}
            >
              <Glyph status={t.part.status} size={12} />
              <span className="truncate">{stepLabel(t.part)}</span>
            </button>
          );
        })}
        {tools.length > 3 ? (
          <button
            type="button"
            onClick={() => setAll((a) => !a)}
            className="rounded-full px-2 py-1 text-xs text-faint outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {all ? 'Show less' : `Show all (${tools.length})`}
          </button>
        ) : null}
      </div>
      <Reveal open={!!openItem}>
        <div className="pt-0.5">{openItem ? <StepBody part={openItem.part} /> : null}</div>
      </Reveal>
    </div>
  );
}

/** Cofounder: vertical timeline; consecutive successful calls fold into "Ran N actions". */
function CofounderTimeline({ items, active }: GroupProps) {
  const entries = aggregateTimeline(items);
  return (
    <ol data-aicl="work-group" data-kit-style="timeline" data-state={active ? 'running' : 'done'} className="m-0 flex list-none flex-col p-0">
      {entries.map((e, n) => (
        <TimelineNode key={e.kind === 'one' ? e.item.index : `agg${e.items[0]!.index}`} last={n === entries.length - 1} entry={e} />
      ))}
    </ol>
  );
}

function TimelineNode({ entry, last }: { entry: ReturnType<typeof aggregateTimeline>[number]; last: boolean }) {
  const [open, setOpen] = useState(false);
  const tool = entry.kind === 'one' && entry.item.kind === 'tool' ? entry.item : null;
  const status: ToolCallPart['status'] = entry.kind === 'aggregate' ? 'success' : (tool?.part.status ?? 'success');
  const dot = status === 'error' ? 'bg-destructive' : status === 'running' || status === 'pending' ? 'animate-pulse bg-primary' : 'bg-success';
  const body = entry.kind === 'aggregate' ? true : tool ? hasBody(tool.part) : false;
  const label = entry.kind === 'aggregate' ? `Ran ${entry.items.length} actions` : tool ? stepLabel(tool.part) : 'Thinking';
  const bashRunning = tool && tool.part.name === 'bash' && isActive(tool.part.status);
  const expanded = open || !!bashRunning;
  return (
    <li
      data-aicl={entry.kind === 'aggregate' ? 'tool-aggregate' : 'tool-call'}
      data-status={status}
      data-name={tool?.part.name}
      className="relative pb-2 pl-7"
    >
      {!last ? <span aria-hidden="true" className="absolute left-[7px] top-5 bottom-0 w-px bg-border" /> : null}
      <span aria-hidden="true" className="absolute left-0 top-[5px] flex size-[15px] items-center justify-center rounded-full bg-background ring-1 ring-border">
        <span className={cn('size-[7px] rounded-full', dot)} />
      </span>
      <button
        type="button"
        disabled={!body}
        aria-expanded={body ? expanded : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md py-0.5 text-left text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {entry.kind === 'aggregate' ? <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">done</span> : null}
        {body ? <Chevron open={expanded} /> : null}
      </button>
      <Reveal open={expanded && body}>
        <div className="pt-1">
          {entry.kind === 'aggregate' ? (
            <ul className="m-0 flex list-none flex-col border-l border-border p-0 pl-3">
              {entry.items.map((i) => (i.kind === 'tool' ? <ToolRow key={i.index} item={i} variant="quiet" /> : null))}
            </ul>
          ) : tool ? (
            <StepBody part={tool.part} />
          ) : null}
        </div>
      </Reveal>
    </li>
  );
}

/** AICL default: one ToolCallCard per call (bash adds the live terminal under its card). */
function CardCall({ items }: GroupProps) {
  const item = items[0];
  if (!item || item.kind !== 'tool') return null;
  const { part } = item;
  const bash = part.name === 'bash';
  return (
    <div data-aicl="tool-call" data-status={part.status} data-name={part.name} className="flex flex-col gap-1.5">
      <ToolCallCard
        name={part.name}
        label={stepLabel(part)}
        status={part.status}
        {...(!bash && hasArgs(part) ? { args: part.args } : {})}
      />
      {bash ? <BashBody part={part} /> : null}
    </div>
  );
}

/** Renders one work group in the kit's tool-call style. */
export function WorkGroup(props: GroupProps) {
  const { kit } = useKitRender();
  switch (kit.transcript.toolCalls) {
    case 'work-summary':
      return <DevinWork {...props} />;
    case 'step-rows':
      return <ManusWork {...props} />;
    case 'collapsed':
      return <LovableChips {...props} />;
    case 'timeline':
      return <CofounderTimeline {...props} />;
    default:
      return <CardCall {...props} />;
  }
}

/* ── Plan ─────────────────────────────────────────────────────────── */

const PLAN_STATUS = ['pending', 'running', 'done', 'error'];
const planSteps = (steps: unknown): PlanStep[] =>
  Array.isArray(steps)
    ? steps.flatMap((s, i) => {
        const o = (s ?? {}) as { id?: unknown; label?: unknown; status?: unknown };
        if (typeof o.label !== 'string') return [];
        return [{ id: typeof o.id === 'string' ? o.id : `i${i}`, label: o.label, status: (PLAN_STATUS.includes(String(o.status)) ? o.status : 'pending') as PlanStep['status'] }];
      })
    : [];

/** The agent's plan: live from the session's plan events, else what the call carried. */
export function PlanBlock({ part }: { part: ToolCallPart }) {
  const { sessionId, lastPlanId } = useKitRender();
  const live = usePlan(sessionId);
  if (lastPlanId !== undefined && lastPlanId !== part.toolCallId) {
    return (
      <div data-aicl="part" data-part="plan-update-old" className="aicl-live-quiet text-xs text-faint">
        Updated the plan
      </div>
    );
  }
  const args = part.args as { title?: string; steps?: unknown } | undefined;
  const steps = live ? live.steps : planSteps(args?.steps);
  const title = live ? live.title : args?.title;
  if (!steps.length) return null;
  return (
    <div data-live="plan" className="aicl-live-plan">
      <AnimatedPlan steps={steps as PlanStep[]} title={title || 'Plan'} />
    </div>
  );
}

/* ── Text, avatars, user turns ────────────────────────────────────── */

export function AssistantText({ text, streaming }: { text: string; streaming: boolean }) {
  const { kit } = useKitRender();
  const mode = kit.transcript.streaming;
  const animate = streaming && mode !== 'none';
  return (
    <div data-aicl="part" data-part="text" data-format="markdown" data-streaming={streaming || undefined}>
      {animate ? <StreamingText text={text} streaming mode={mode} caret /> : <Markdown text={text} />}
    </div>
  );
}

export function AssistantHeader({ kit }: { kit: ProviderKit }) {
  const name = kit.vocabulary.agent;
  return (
    <div data-aicl="assistant-header" className="flex items-center gap-2 text-sm font-medium text-foreground">
      <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span>{kit.id === 'manus' ? name.toLowerCase() : name}</span>
    </div>
  );
}

/** A user turn: right-aligned tinted bubble, or Devin's full-width row with a small "You" label. */
export function UserTurn({ kit, children, time }: { kit: ProviderKit; children: ReactNode; time?: string | undefined }) {
  if (kit.transcript.user === 'row') {
    return (
      <div data-aicl="user-turn" data-variant="row" className="flex flex-col gap-1 border-y border-border bg-muted/60 px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-faint">
          <span>You</span>
          {time ? <time className="ml-auto normal-case tabular-nums">{time}</time> : null}
        </div>
        <div className="text-sm">{children}</div>
      </div>
    );
  }
  return (
    <div data-aicl="user-turn" data-variant="bubble" className="flex justify-end">
      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-[var(--aicl-bubble-user)] px-4 py-2.5 text-[15px] text-foreground [overflow-wrap:anywhere]">
        {children}
      </div>
    </div>
  );
}

/* ── Waiting indicator ────────────────────────────────────────────── */

export function Waiting({ kit }: { kit: ProviderKit }) {
  const elapsed = useElapsed(true);
  return (
    <div data-aicl="thinking" data-kit-thinking={kit.transcript.thinking}>
      <ThinkingIndicator variant={kit.transcript.thinking} {...(elapsed != null && elapsed >= 1 ? { elapsedMs: elapsed * 1000 } : {})} />
    </div>
  );
}

/* ── Message actions ──────────────────────────────────────────────── */

type KitAction = ProviderKit['transcript']['actions'][number];

const iconBtn =
  'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:text-primary';

function MenuAction({ label, icon, items }: { label: string; icon: ReactNode; items: Array<{ label: string; onSelect?: () => void }> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={iconBtn}>
        {icon}
      </button>
      {open ? (
        <div role="menu" aria-label={label} className="absolute bottom-full right-0 z-20 mb-1 min-w-40 rounded-lg border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                it.onSelect?.();
                setOpen(false);
              }}
              className="flex w-full rounded-md px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:bg-muted"
            >
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Persistent action bar under an assistant reply, per kit.transcript.actions. */
export function KitActions({ kit, message, onRetry }: { kit: ProviderKit; message: Message; onRetry?: (() => void) | undefined }) {
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  const copy = () => {
    void navigator.clipboard?.writeText(messageText(message));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const render = (a: KitAction): ReactNode => {
    switch (a) {
      case 'copy':
        return (
          <button key={a} type="button" aria-label="Copy" data-action="copy" onClick={copy} className={iconBtn}>
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          </button>
        );
      case 'thumbs':
        return (
          <span key={a} className="inline-flex">
            <button type="button" aria-label="Good response" aria-pressed={vote === 'up'} data-action="thumbs-up" onClick={() => setVote(vote === 'up' ? null : 'up')} className={iconBtn}>
              <ThumbsUp size={14} aria-hidden="true" />
            </button>
            <button type="button" aria-label="Bad response" aria-pressed={vote === 'down'} data-action="thumbs-down" onClick={() => setVote(vote === 'down' ? null : 'down')} className={iconBtn}>
              <ThumbsDown size={14} aria-hidden="true" />
            </button>
          </span>
        );
      case 'retry':
        return (
          <button key={a} type="button" aria-label="Retry" data-action="retry" disabled={!onRetry} onClick={onRetry} className={cn(iconBtn, 'disabled:opacity-40')}>
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        );
      case 'share':
        return (
          <MenuAction
            key={a}
            label="Share"
            icon={<Share2 size={14} aria-hidden="true" />}
            items={[{ label: 'Copy link', onSelect: () => void navigator.clipboard?.writeText(`${location.href.split('#')[0]}#${message.id}`) }, { label: 'Share as…' }]}
          />
        );
      case 'revert':
        return (
          <MenuAction key={a} label="Revert" icon={<Undo2 size={14} aria-hidden="true" />} items={[{ label: 'Revert to here' }, { label: 'Preview this version' }]} />
        );
      case 'more':
        return <MenuAction key={a} label="More" icon={<Ellipsis size={14} aria-hidden="true" />} items={[{ label: 'Fork from here' }, { label: 'Report an issue' }]} />;
    }
  };
  return (
    <div
      data-aicl="message-actions"
      data-kit-actions={kit.id}
      data-feedback={vote ?? 'none'}
      data-copied={copied || undefined}
      data-message-id={message.id}
      data-role={message.role}
      className="flex items-center gap-0.5"
    >
      {kit.transcript.actions.map(render)}
    </div>
  );
}

/** Boundary around one part: a render failure takes down that part only. */
export function PartBoundary({ children, keys }: { children: ReactNode; keys?: readonly unknown[] }) {
  return (
    <ErrorBoundary label="message part" {...(keys ? { resetKeys: keys } : {})}>
      {children}
    </ErrorBoundary>
  );
}

/* ── Single-element forms (canvas screens) ────────────────────────── */

/** One tool step on a screen, in the kit's style. */
export function ScreenStep({ kit, label, status }: { kit: ProviderKit; label: string; status: ToolCallPart['status'] }) {
  return (
    <KitRenderContext.Provider value={{ kit, sessionId: 'screen' }}>
      {kit.transcript.toolCalls === 'cards' ? (
        <div data-aicl="tool-call" data-status={status}>
          <ToolCallCard name="step" label={label} status={status} />
        </div>
      ) : kit.transcript.toolCalls === 'collapsed' ? (
        <div data-aicl="work-group" data-kit-style="collapsed" className="flex">
          <span data-aicl="tool-call" data-status={status} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
            <Glyph status={status} size={12} />
            <span className="truncate">{label}</span>
          </span>
        </div>
      ) : kit.transcript.toolCalls === 'timeline' ? (
        <ol className="m-0 list-none p-0" data-kit-style="timeline">
          <li data-aicl="tool-call" data-status={status} className="relative pb-2 pl-7">
            <span aria-hidden="true" className="absolute left-[7px] top-5 bottom-[-6px] w-px bg-border" />
            <span aria-hidden="true" className="absolute left-0 top-[5px] flex size-[15px] items-center justify-center rounded-full bg-background ring-1 ring-border">
              <span className={cn('size-[7px] rounded-full', status === 'error' ? 'bg-destructive' : isActive(status) ? 'animate-pulse bg-primary' : 'bg-success')} />
            </span>
            <span className="text-sm text-foreground">{label}</span>
          </li>
        </ol>
      ) : (
        <ul className="m-0 list-none p-0" data-kit-style={kit.transcript.toolCalls}>
          <li data-aicl="tool-call" data-status={status} className="flex items-center gap-2 py-0.5 text-[13px] text-muted-foreground">
            {kit.transcript.toolCalls === 'step-rows' ? <QuietMark status={status} /> : <Glyph status={status} />}
            <span className="truncate">{label}</span>
            {kit.transcript.toolCalls === 'work-summary' ? <span className="ml-auto font-mono text-[11px] text-faint">step</span> : null}
          </li>
        </ul>
      )}
    </KitRenderContext.Provider>
  );
}

/** A reasoning element on a screen: Devin shows "Worked for Ns", Lovable "Thought for Ns", others a muted block. */
export function ScreenReasoning({ kit, text, durationSec, streaming }: { kit: ProviderKit; text?: string | undefined; durationSec?: number | undefined; streaming: boolean }) {
  const part: ReasoningPart = { type: 'reasoning', text: text ?? '', ...(durationSec !== undefined && !streaming ? { durationMs: durationSec * 1000 } : {}) };
  return (
    <KitRenderContext.Provider value={{ kit, sessionId: 'screen' }}>
      {kit.transcript.reasoning === 'in-work' ? (
        <div data-aicl="work-group" data-kit-style="work-summary">
          <WorkSummary
            running={streaming}
            seconds={durationSec ?? 0}
            {...(text ? { steps: <span className="text-xs">{text}</span> } : {})}
          />
        </div>
      ) : (
        <ReasoningBlock part={part} active={streaming} />
      )}
    </KitRenderContext.Provider>
  );
}
