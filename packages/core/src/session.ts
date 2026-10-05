/**
 * Session metadata (D11): a separate model and store from the transcript.
 * The session list has its own lifecycle — pinning, grouping, unread — that
 * has nothing to do with an open conversation's streaming state.
 */

import { createStore } from './store.js';
import type { ReadableStore } from './types.js';

export interface SessionMeta {
  id: string;
  /** Consumer-supplied, never derived. */
  title: string;
  updatedAt?: number;
  createdAt?: number;
  status?: 'idle' | 'running' | 'awaiting-input' | 'error' | `data-${string}`;
  /** A product-authored composite, e.g. "PR is ready · ⎇1". */
  statusLine?: string;
  /** Snippet of the agent's last message. */
  preview?: string;
  unread?: boolean;
  starred?: boolean;
  /** Project/workspace parent: a filter, never a group. */
  parentId?: string;
  archivedAt?: number;
  metadata?: Record<string, unknown>;
}

/** Input shape. */
export interface SessionGroup {
  id: string;
  label?: string;
  sessions: SessionMeta[];
}

/** Store shape: normalised so a status change touches one row. */
export interface SessionState {
  byId: Record<string, SessionMeta>;
  groups: { id: string; label?: string; ids: string[] }[];
  activeId?: string;
}

export interface SessionStore extends ReadableStore<SessionState> {
  /** The meta for one session; `get()` with no id returns the whole state. */
  meta(id: string): SessionMeta | undefined;
  /** Inserts into the first group, or replaces in place, keeping group order. */
  upsert(meta: SessionMeta): void;
  patch(id: string, patch: Partial<SessionMeta>): void;
  remove(id: string): void;
  /** Normalises; never sorts. Ordering is the consumer's. */
  setGroups(groups: SessionGroup[]): void;
  setActive(id: string | undefined): void;
}

const normalise = (groups: SessionGroup[]): Pick<SessionState, 'byId' | 'groups'> => {
  const byId: Record<string, SessionMeta> = {};
  const out = groups.map((g) => {
    for (const s of g.sessions) byId[s.id] = s;
    return { id: g.id, ...(g.label !== undefined ? { label: g.label } : {}), ids: g.sessions.map((s) => s.id) };
  });
  return { byId, groups: out };
};

export function createSessionStore(initial: SessionGroup[] = []): SessionStore {
  const store = createStore<SessionState>(normalise(initial));

  return {
    get: store.get,
    subscribe: store.subscribe,
    meta: (id) => store.get().byId[id],
    upsert(meta) {
      store.update((s) => {
        if (s.byId[meta.id]) return { ...s, byId: { ...s.byId, [meta.id]: meta } };
        const [first, ...rest] = s.groups;
        const groups = first ? [{ ...first, ids: [meta.id, ...first.ids] }, ...rest] : [{ id: 'default', ids: [meta.id] }];
        return { ...s, byId: { ...s.byId, [meta.id]: meta }, groups };
      });
    },
    patch(id, patch) {
      store.update((s) => {
        const current = s.byId[id];
        if (!current) return s;
        return { ...s, byId: { ...s.byId, [id]: { ...current, ...patch, id } } };
      });
    },
    remove(id) {
      store.update((s) => {
        if (!s.byId[id]) return s;
        const { [id]: _removed, ...byId } = s.byId;
        return {
          byId,
          groups: s.groups.map((g) => (g.ids.includes(id) ? { ...g, ids: g.ids.filter((x) => x !== id) } : g)),
          ...(s.activeId && s.activeId !== id ? { activeId: s.activeId } : {}),
        };
      });
    },
    setGroups(groups) {
      store.update((s) => ({ ...normalise(groups), ...(s.activeId ? { activeId: s.activeId } : {}) }));
    },
    setActive(id) {
      store.update((s) => {
        if (s.activeId === id) return s;
        const { activeId: _old, ...rest } = s;
        return id === undefined ? rest : { ...rest, activeId: id };
      });
    },
  };
}

const DAY = 86_400_000;

/**
 * Today / Yesterday / Previous 7 days / Previous 30 days / Older, by
 * `updatedAt ?? createdAt`. Exported, never applied: grouping is the
 * consumer's choice.
 */
export function bucketByRecency(sessions: SessionMeta[], now: number): SessionGroup[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const t0 = startOfToday.getTime();
  const buckets: Array<{ id: string; label: string; min: number }> = [
    { id: 'today', label: 'Today', min: t0 },
    { id: 'yesterday', label: 'Yesterday', min: t0 - DAY },
    { id: 'week', label: 'Previous 7 days', min: t0 - 7 * DAY },
    { id: 'month', label: 'Previous 30 days', min: t0 - 30 * DAY },
    { id: 'older', label: 'Older', min: -Infinity },
  ];
  const groups = buckets.map((b) => ({ id: b.id, label: b.label, sessions: [] as SessionMeta[] }));
  for (const s of sessions) {
    const t = s.updatedAt ?? s.createdAt ?? 0;
    const index = buckets.findIndex((b) => t >= b.min);
    groups[index]!.sessions.push(s);
  }
  return groups.filter((g) => g.sessions.length);
}
