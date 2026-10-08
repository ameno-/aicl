/**
 * The swarm on the canvas: lays one run (a root session and what it spawned)
 * out as a tree and sends it to the open canvas as a single idempotent `swarm`
 * op. Does nothing without a connected canvas client.
 */
import type { SessionInfo } from '../../shared/runtime.ts';
import type { SwarmRun, SwarmRunNode, SwarmStatus } from '../../shared/scratch.ts';
import type { Relay } from '../relay.ts';

export const CARD_W = 340;
export const CARD_H = 380;
const ROOT_W = 260;
const ROOT_H = 64;
const GAP_X = 48;
const GAP_Y = 220;
const PAD = 40;
const TOP = 56;

export const statusOf = (s: SessionInfo): SwarmStatus =>
  s.status === 'running' ? 'running' : s.status === 'error' ? 'error' : s.stopped ? 'stopped' : s.finishedAt ? 'done' : 'idle';

const clip = (s: string, max: number) => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

/** Short shape id of the run frame: one per root turn, so a new request starts a new frame. */
export const runFrameId = (root: SessionInfo): string => `run-${root.id}-${root.startedAt ?? 0}`;

/**
 * Tree layout, positions relative to the frame. `sessions` are the root's
 * descendants; those spawned before the root's latest turn belong to older frames.
 */
export function layoutRun(root: SessionInfo, sessions: SessionInfo[], create: boolean): SwarmRun {
  const since = (root.startedAt ?? 0) - 1000;
  const mine = sessions.filter((s) => s.createdAt >= since).sort((a, b) => a.createdAt - b.createdAt);
  const kids = new Map<string, SessionInfo[]>();
  const known = new Set([root.id, ...mine.map((s) => s.id)]);
  for (const s of mine) {
    const parent = s.parentId && known.has(s.parentId) ? s.parentId : root.id;
    kids.set(parent, [...(kids.get(parent) ?? []), s]);
  }

  const width = new Map<string, number>();
  const measure = (id: string, own: number): number => {
    const children = kids.get(id) ?? [];
    const inner = children.reduce((sum, c) => sum + measure(c.id, CARD_W), 0) + Math.max(0, children.length - 1) * GAP_X;
    const w = Math.max(own, inner);
    width.set(id, w);
    return w;
  };
  measure(root.id, ROOT_W);

  const nodes: SwarmRunNode[] = [];
  let maxDepth = 0;
  const rootBox = `rt-${root.id}`;
  const place = (id: string, left: number, depth: number, parentBox: string | undefined): void => {
    const span = width.get(id)!;
    const isRoot = id === root.id;
    const w = isRoot ? ROOT_W : CARD_W;
    const h = isRoot ? ROOT_H : CARD_H;
    const box = isRoot ? rootBox : `ag-${id}`;
    maxDepth = Math.max(maxDepth, depth);
    const s = isRoot ? root : mine.find((m) => m.id === id)!;
    nodes.push({
      id: box,
      ...(isRoot ? {} : { sessionId: id }),
      name: isRoot ? clip(root.title || 'Main', 40) : clip(s.title, 40),
      // The task rides on the card's role line: arrow labels collide when siblings sit side by side.
      ...(!isRoot && (s.role || s.task) ? { role: clip([s.role, s.task].filter(Boolean).join(' — '), 100) } : {}),
      ...(parentBox ? { parent: parentBox } : {}),
      status: isRoot ? 'idle' : statusOf(s),
      x: left + (span - w) / 2,
      y: 0, // set below, once depths are known
      w,
      h,
    });
    let cursor = left;
    for (const c of kids.get(id) ?? []) {
      place(c.id, cursor, depth + 1, box);
      cursor += width.get(c.id)! + GAP_X;
    }
  };
  place(root.id, PAD, 0, undefined);

  // The root box is short: rows below it start right under it, deeper rows under a full card.
  for (const n of nodes) {
    const depth = n.id === rootBox ? 0 : depthOf(n, nodes);
    n.y = depth === 0 ? TOP : TOP + ROOT_H + GAP_Y + (depth - 1) * (CARD_H + GAP_Y);
  }

  return {
    frameId: runFrameId(root),
    title: `Run: ${clip(root.title || 'Main', 40)}`,
    create,
    w: width.get(root.id)! + PAD * 2,
    h: TOP + (maxDepth === 0 ? ROOT_H : ROOT_H + GAP_Y + (maxDepth - 1) * (CARD_H + GAP_Y) + CARD_H) + PAD,
    nodes,
  };
}

function depthOf(node: SwarmRunNode, nodes: SwarmRunNode[]): number {
  let depth = 0;
  let at: SwarmRunNode | undefined = node;
  while (at?.parent) {
    depth++;
    at = nodes.find((n) => n.id === at!.parent);
  }
  return depth;
}

export interface SwarmCanvasDeps {
  relay: Pick<Relay, 'connected' | 'request'>;
  /** The root session and everything below it. */
  snapshot(rootId: string): { root: SessionInfo; sessions: SessionInfo[] } | undefined;
  delayMs?: number;
}

/** Coalesces bursts of changes into one canvas op per root. */
export function createSwarmCanvas(deps: SwarmCanvasDeps) {
  const timers = new Map<string, NodeJS.Timeout>();
  const wantCreate = new Set<string>();
  let chain: Promise<void> = Promise.resolve();

  const flush = (rootId: string): Promise<void> => {
    chain = chain.then(async () => {
      const create = wantCreate.delete(rootId);
      const snap = deps.snapshot(rootId);
      if (!snap || !deps.relay.connected) return;
      try {
        await deps.relay.request({ op: 'swarm', run: layoutRun(snap.root, snap.sessions, create) });
      } catch (cause) {
        console.warn('[swarm] canvas update skipped:', cause instanceof Error ? cause.message : cause);
      }
    });
    return chain;
  };

  return {
    /** A child was spawned under `rootId`: place (or extend) the run frame. */
    spawned(rootId: string): void {
      wantCreate.add(rootId);
      this.changed(rootId);
    },
    /** Something about the run changed: refresh states. Existing shapes only unless a spawn is pending. */
    changed(rootId: string): void {
      if (!deps.relay.connected) return;
      clearTimeout(timers.get(rootId));
      timers.set(
        rootId,
        setTimeout(() => {
          timers.delete(rootId);
          void flush(rootId);
        }, deps.delayMs ?? 120),
      );
    },
    /** Resolves when pending updates were sent (tests). */
    idle: (): Promise<void> => chain,
  };
}
