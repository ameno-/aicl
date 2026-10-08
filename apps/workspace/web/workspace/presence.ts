/**
 * Small stores behind agent presence (AICL-41): what the agent last touched on
 * the canvas, and whether the camera follows the agent.
 */
import { useSyncExternalStore } from 'react';
import type { ScratchResult } from '../../shared/scratch.ts';

/* ── What the agent last touched ──────────────────────────────────── */

export interface AgentTouch {
  /** Short shape ids. */
  ids: string[];
  at: number;
}

let touch: AgentTouch | null = null;

/** Called by the executor after each agent op: the shapes it created or changed. */
export function noteAgentTouch(result: ScratchResult): void {
  if (result.op === 'focus' || result.op === 'delete' || result.op === 'clear') return;
  const ids = (result as { ids?: unknown }).ids;
  if (Array.isArray(ids) && ids.length) touch = { ids: ids.filter((i): i is string => typeof i === 'string'), at: Date.now() };
}

export const getAgentTouch = (): AgentTouch | null => touch;

/* ── Follow agent ─────────────────────────────────────────────────── */

let following = false;
const listeners = new Set<() => void>();

export function setFollow(on: boolean): void {
  if (on === following) return;
  following = on;
  for (const l of [...listeners]) l();
}

export const toggleFollow = (): void => setFollow(!following);
export const isFollowing = (): boolean => following;

export function useFollow(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => following,
    () => following,
  );
}

/* ── Which session is "the agent" ─────────────────────────────────── */

/** How long presence lingers after the last sign of work, and how fresh a surface update must be to count. */
export const LINGER_MS = 2500;
