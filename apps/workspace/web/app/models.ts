/**
 * The model picker's data: GET /api/models once, a session's choice from its
 * SessionInfo.model (persisted by the server), switching via
 * POST /api/sessions/:id/model.
 */
import { useEffect, useSyncExternalStore } from 'react';
import type { ModelOption, SessionInfo } from '../../shared/runtime.ts';
import { toasts } from '../chatStore.ts';
import { applySessionInfo, useSessions } from '../sessionsApi.ts';

interface ModelList {
  models: ModelOption[];
  default: string | null;
  loaded: boolean;
}

let state: ModelList = { models: [], default: null, loaded: false };
let requested = false;
const listeners = new Set<() => void>();

function load(force = false): void {
  if (requested && !force) return;
  requested = true;
  void fetch('/api/models')
    .then((r) => r.json() as Promise<{ models: ModelOption[]; default: string | null }>)
    .then((body) => {
      state = { ...body, loaded: true };
      for (const l of [...listeners]) l();
    })
    .catch(() => {
      requested = false;
    });
}

export function useModels(): ModelList {
  useEffect(() => load(), []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

/** The session's model id ("provider/id"): its own choice, else the workspace default. */
export function useSessionModel(sessionId: string): { value: string; options: ModelOption[]; set: (id: string) => Promise<void>; busy: boolean } {
  const { models, default: def } = useModels();
  const session = useSessions().find((s) => s.id === sessionId);
  const value = session?.model ?? def ?? models[0]?.id ?? '';
  // A stored choice must stay selectable even if the list was narrowed.
  const options = value && !models.some((m) => m.id === value) ? [{ id: value, label: value.split('/').slice(1).join('/') || value, provider: value.split('/')[0] ?? '' }, ...models] : models;
  return { value, options, set: (id) => setSessionModel(sessionId, id), busy: session?.status === 'running' };
}

export async function setSessionModel(sessionId: string, model: string): Promise<void> {
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/model`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model }),
    });
    const body = (await res.json()) as { session?: SessionInfo; message?: string };
    if (!res.ok || !body.session) throw new Error(body.message ?? `HTTP ${res.status}`);
    applySessionInfo(body.session);
  } catch (cause) {
    toasts.push({ title: 'Could not switch model', description: cause instanceof Error ? cause.message : String(cause), variant: 'error' });
  }
}
