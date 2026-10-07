/** Pure helpers behind the Agents view: the lineage tree, aggregates, formatting. No React. */
import type { SessionInfo } from '../../shared/runtime.ts';

export interface TreeRow {
  session: SessionInfo;
  depth: number;
}

/** Roots (sessions without a known parent) newest first, each followed by its descendants in spawn order. */
export function buildRows(sessions: SessionInfo[]): TreeRow[] {
  const ids = new Set(sessions.map((s) => s.id));
  const kids = new Map<string, SessionInfo[]>();
  const roots: SessionInfo[] = [];
  for (const s of sessions) {
    if (s.parentId && ids.has(s.parentId)) kids.set(s.parentId, [...(kids.get(s.parentId) ?? []), s]);
    else roots.push(s);
  }
  const out: TreeRow[] = [];
  const walk = (s: SessionInfo, depth: number) => {
    out.push({ session: s, depth });
    for (const c of (kids.get(s.id) ?? []).sort((a, b) => a.createdAt - b.createdAt)) walk(c, depth + 1);
  };
  // Trees with agents in them first; within each group, most recently active first.
  const hasKids = (s: SessionInfo) => (kids.get(s.id)?.length ? 1 : 0);
  for (const r of [...roots].sort((a, b) => hasKids(b) - hasKids(a) || b.updatedAt - a.updatedAt)) walk(r, 0);
  return out;
}

export interface Aggregate {
  running: number;
  total: number;
  agents: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** Totals over every session (sub-agents are `agents`; user chats count toward cost and tokens too). */
export function aggregate(sessions: SessionInfo[]): Aggregate {
  const a: Aggregate = { running: 0, total: sessions.length, agents: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  for (const s of sessions) {
    if (s.status === 'running') a.running++;
    if (s.parentId) a.agents++;
    a.inputTokens += s.usage?.inputTokens ?? 0;
    a.outputTokens += s.usage?.outputTokens ?? 0;
    a.costUsd += s.usage?.costUsd ?? 0;
  }
  return a;
}

export type RowState = 'running' | 'error' | 'stopped' | 'done' | 'idle';

export const stateOf = (s: SessionInfo): RowState =>
  s.status === 'running' ? 'running' : s.status === 'error' ? 'error' : s.stopped ? 'stopped' : s.finishedAt ? 'done' : 'idle';

export const formatTokens = (n: number): string => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export const formatCost = (usd: number): string => (usd <= 0 ? '' : usd < 0.01 ? '<$0.01' : `$${usd.toFixed(usd < 1 ? 3 : 2)}`);

export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
}

/** Elapsed time of the latest run; undefined when it never ran. */
export const elapsedOf = (s: SessionInfo, now: number): number | undefined =>
  s.startedAt ? (s.status === 'running' ? now : (s.finishedAt ?? s.startedAt)) - s.startedAt : undefined;
