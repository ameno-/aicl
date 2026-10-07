/**
 * The model picker's data (GET /api/models): the models Pi's ModelRuntime
 * knows and has credentials for. Pi can know a thousand across providers, so
 * the list is narrowed to the default model's provider, anything named in
 * AICL_MODELS ("provider/id,provider/id"), and the models sessions already use.
 * `?all=1` returns the whole catalog.
 */
import type { ModelRuntime } from '@earendil-works/pi-coding-agent';
import type { ModelOption } from '../shared/runtime.ts';

/** The slice of Pi's Model the picker uses. */
interface PiModel {
  provider: string;
  id: string;
  name?: string;
}

export const modelKey = (m: PiModel): string => `${m.provider}/${m.id}`;

const optionOf = (m: PiModel): ModelOption => ({
  id: modelKey(m),
  label: m.name && m.name !== m.id ? m.name : m.id,
  provider: m.provider,
});

/** Splits "provider/id" (ids may contain slashes and colons) and finds it in the runtime, or undefined. */
export function findModel(runtime: Pick<ModelRuntime, 'getModel'>, key: string): PiModel | undefined {
  const slash = key.indexOf('/');
  if (slash <= 0) return undefined;
  return runtime.getModel(key.slice(0, slash), key.slice(slash + 1)) as PiModel | undefined;
}

export interface ListModelsInput {
  runtime: Pick<ModelRuntime, 'getAvailable'>;
  /** "provider/id" of the workspace default. */
  current: string | null;
  /** Models sessions already use, so a stored choice never vanishes from the list. */
  inUse?: string[];
  all?: boolean;
  extra?: string[];
  limit?: number;
}

export async function listModels({ runtime, current, inUse = [], all = false, extra = [], limit = 80 }: ListModelsInput): Promise<ModelOption[]> {
  const available = [...((await runtime.getAvailable()) as readonly PiModel[])];
  const byKey = new Map(available.map((m) => [modelKey(m), m]));
  const currentProvider = current?.split('/')[0];
  const wanted = new Set<string>([...(current ? [current] : []), ...extra, ...inUse]);
  const picked = all
    ? available
    : available.filter((m) => wanted.has(modelKey(m)) || (currentProvider !== undefined && m.provider === currentProvider));
  const out = new Map<string, ModelOption>();
  // Wanted models first (the default leads), then the provider's catalog alphabetically.
  for (const key of wanted) {
    const m = byKey.get(key);
    if (m) out.set(key, optionOf(m));
  }
  for (const m of [...picked].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!all && out.size >= limit) break;
    if (!out.has(modelKey(m))) out.set(modelKey(m), optionOf(m));
  }
  return [...out.values()];
}
