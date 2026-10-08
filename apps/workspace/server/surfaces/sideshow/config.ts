/**
 * Where the Sideshow bridge talks to. Default is a LOCAL server; the remote
 * board (SIDESHOW_URL + SIDESHOW_TOKEN in the environment) is used only when
 * the workspace setting <workspace>/.aicl/sideshow.json says target "remote".
 * The token is never part of the settings file and never leaves this module
 * except as an Authorization header to the remote board.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export type SideshowTarget = 'local' | 'remote';
export interface SideshowSettings {
  target: SideshowTarget;
  localUrl: string;
}
export interface Endpoint {
  target: SideshowTarget;
  base: string;
  token?: string;
}

export const DEFAULT_LOCAL_URL = 'http://localhost:8228';

export const normalizeUrl = (url: string): string => url.trim().replace(/\/+$/, '');

export function settingsFile(workspace: string): string {
  return path.join(workspace, '.aicl', 'sideshow.json');
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function readSettings(workspace: string): SideshowSettings {
  try {
    const raw = JSON.parse(readFileSync(settingsFile(workspace), 'utf8')) as Partial<SideshowSettings>;
    return {
      target: raw.target === 'remote' ? 'remote' : 'local',
      localUrl: typeof raw.localUrl === 'string' && isHttpUrl(raw.localUrl) ? normalizeUrl(raw.localUrl) : DEFAULT_LOCAL_URL,
    };
  } catch {
    return { target: 'local', localUrl: DEFAULT_LOCAL_URL };
  }
}

export function writeSettings(workspace: string, change: { target?: unknown; localUrl?: unknown }): SideshowSettings {
  const prev = readSettings(workspace);
  if (change.target !== undefined && change.target !== 'local' && change.target !== 'remote') throw new Error('target must be "local" or "remote"');
  if (change.localUrl !== undefined && (typeof change.localUrl !== 'string' || !isHttpUrl(change.localUrl))) throw new Error('localUrl must be an http(s) URL');
  const next: SideshowSettings = {
    target: (change.target as SideshowTarget | undefined) ?? prev.target,
    localUrl: typeof change.localUrl === 'string' ? normalizeUrl(change.localUrl) : prev.localUrl,
  };
  mkdirSync(path.dirname(settingsFile(workspace)), { recursive: true });
  writeFileSync(settingsFile(workspace), JSON.stringify(next, null, 2));
  return next;
}

type Env = Record<string, string | undefined>;

/** The remote board from the environment; null when not configured. */
export function remoteFromEnv(env: Env): { base: string; token?: string } | null {
  const url = env['SIDESHOW_URL'];
  if (!url || !isHttpUrl(url)) return null;
  const token = env['SIDESHOW_TOKEN'];
  return { base: normalizeUrl(url), ...(token ? { token } : {}) };
}

/** Where a publish goes right now. Throws a readable error when remote is chosen but not configured. */
export function resolveEndpoint(settings: SideshowSettings, env: Env): Endpoint {
  if (settings.target === 'local') return { target: 'local', base: settings.localUrl };
  const remote = remoteFromEnv(env);
  if (!remote) throw new Error('The Sideshow target is "remote" but SIDESHOW_URL is not set in the server environment.');
  return { target: 'remote', ...remote };
}

/** The token for a board at `base`: only the configured remote gets it, never a local or unknown server. */
export function tokenFor(base: string, env: Env): string | undefined {
  const remote = remoteFromEnv(env);
  return remote && remote.base === normalizeUrl(base) ? remote.token : undefined;
}

/** What the settings API may show: whether a token exists, never the token. */
export function publicConfig(settings: SideshowSettings, env: Env) {
  const remote = remoteFromEnv(env);
  return {
    target: settings.target,
    localUrl: settings.localUrl,
    remote: { url: remote?.base ?? null, tokenConfigured: Boolean(remote?.token) },
  };
}
