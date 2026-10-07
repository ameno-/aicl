/**
 * Pure helpers behind KitTranscript (no React): how one assistant message's
 * parts split into segments, per kit tool-call and reasoning style. Unit-tested
 * under node (server/kits-model.test.ts).
 */
import type { Message, Part, ReasoningPart, ToolCallPart } from '@aicl/core';
import type { ReasoningStyle, ToolCallStyle } from '../../shared/kits.ts';

/** Tools that always render as their own live, answerable component, never folded into a work group. */
export const STANDALONE_TOOLS = new Set(['ask_user', 'plan_update']);

export type WorkItem =
  | { kind: 'reasoning'; part: ReasoningPart; index: number }
  | { kind: 'tool'; part: ToolCallPart; index: number };

export type Segment =
  | { kind: 'text'; part: Extract<Part, { type: 'text' }>; index: number }
  | { kind: 'reasoning'; part: ReasoningPart; index: number }
  | { kind: 'work'; items: WorkItem[]; key: string }
  | { kind: 'standalone'; part: ToolCallPart; index: number }
  | { kind: 'other'; part: Part; index: number };

export interface SegmentOptions {
  toolCalls: ToolCallStyle;
  reasoning: ReasoningStyle;
}

/**
 * Splits parts into segments. `cards` keeps every tool call as its own item (no folding);
 * the other styles fold consecutive calls (and reasoning when `in-work`) into one work group.
 * `work-summary` and `step-rows` fold the whole turn into a single group, placed where the first call was.
 */
export function segmentParts(parts: Part[], opts: SegmentOptions): Segment[] {
  const out: Segment[] = [];
  const foldReasoning = opts.reasoning === 'in-work' && opts.toolCalls !== 'cards';
  const whole = opts.toolCalls === 'work-summary' || opts.toolCalls === 'step-rows';
  let group: Extract<Segment, { kind: 'work' }> | null = null;

  const push = (item: WorkItem) => {
    if (!group) {
      group = { kind: 'work', items: [], key: `w${item.index}` };
      out.push(group);
    }
    group.items.push(item);
  };
  const close = () => {
    if (!whole) group = null;
  };

  parts.forEach((part, index) => {
    if (part.type === 'text') {
      close();
      out.push({ kind: 'text', part, index });
    } else if (part.type === 'reasoning') {
      if (foldReasoning) push({ kind: 'reasoning', part, index });
      else {
        close();
        out.push({ kind: 'reasoning', part, index });
      }
    } else if (part.type === 'tool-call') {
      if (STANDALONE_TOOLS.has(part.name)) {
        close();
        out.push({ kind: 'standalone', part, index });
      } else if (opts.toolCalls === 'cards') {
        out.push({ kind: 'work', items: [{ kind: 'tool', part, index }], key: `w${index}` });
      } else {
        push({ kind: 'tool', part, index });
      }
    } else if (part.type === 'tool-result') {
      // Results are shown by the live renderers; a bare result never needs its own row.
    } else {
      close();
      out.push({ kind: 'other', part, index });
    }
  });
  return out;
}

export const isActive = (s: ToolCallPart['status']) => s === 'pending' || s === 'running';

/** True while any call in the group is still going. */
export const groupActive = (items: WorkItem[]) =>
  items.some((i) => i.kind === 'tool' && isActive(i.part.status));

/** Consecutive successful calls fold into "Ran N actions" (Cofounder); others stay individual. */
export type TimelineEntry = { kind: 'one'; item: WorkItem } | { kind: 'aggregate'; items: WorkItem[] };

export function aggregateTimeline(items: WorkItem[]): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  let run: WorkItem[] = [];
  const flush = () => {
    if (run.length === 1) out.push({ kind: 'one', item: run[0]! });
    else if (run.length > 1) out.push({ kind: 'aggregate', items: run });
    run = [];
  };
  for (const item of items) {
    if (item.kind === 'tool' && item.part.status === 'success') run.push(item);
    else {
      flush();
      out.push({ kind: 'one', item });
    }
  }
  flush();
  return out;
}

/** Visible text of a message (copy action, empty checks). */
export const messageText = (m: Message): string =>
  m.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('\n');

/**
 * Seconds a turn's work took. Order of trust: an observed live timer (caller), the gap to the next
 * message, summed reasoning durations, then a small per-call estimate (history without timestamps).
 */
export function turnSeconds(messages: Message[], index: number): number {
  const m = messages[index]!;
  const next = messages[index + 1];
  if (m.createdAt && next?.createdAt && next.createdAt > m.createdAt) return Math.max(1, Math.round((next.createdAt - m.createdAt) / 1000));
  const thought = m.parts.reduce((s, p) => s + (p.type === 'reasoning' ? (p.durationMs ?? 0) : 0), 0);
  if (thought > 0) return Math.max(1, Math.round(thought / 1000));
  const calls = m.parts.filter((p) => p.type === 'tool-call').length;
  return Math.max(1, calls * 2);
}

/** "2:23 PM" for the Devin turn header. */
export function clock(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
