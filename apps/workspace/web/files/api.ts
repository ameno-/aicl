/** Client for the files surface endpoints (server/surfaces/files.ts). */
import type { SurfaceInfo } from '../../shared/surfaces.ts';
import { getActiveSessionId } from '../sessionsApi.ts';

export interface FileDoc {
  path: string;
  text: string;
  hash: string;
  language: string;
  lines: number;
}

export interface LineRange {
  startLine: number;
  endLine: number;
}

export class ConflictError extends Error {
  readonly current: FileDoc;
  constructor(current: FileDoc) {
    super('The file changed on disk.');
    this.current = current;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as T & { message?: string; doc?: FileDoc };
  if (res.status === 409 && body.doc) throw new ConflictError(body.doc);
  if (!res.ok) throw new Error(body.message ?? `request failed (${res.status})`);
  return body;
}

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const searchFiles = (q: string) =>
  request<{ paths: string[] }>(`/api/surfaces/files/search?q=${encodeURIComponent(q)}`).then((r) => r.paths);

export const readFileDoc = (path: string) =>
  request<{ doc: FileDoc }>(`/api/surfaces/file/read?path=${encodeURIComponent(path)}`).then((r) => r.doc);

/** Opens (registers) the file surface; idempotent. */
export const openFileSurface = (path: string, line?: number) =>
  request<{ surface: SurfaceInfo }>('/api/surfaces/file/open', post({ path, line, sessionId: getActiveSessionId() })).then((r) => r.surface);

/** Throws ConflictError (with the disk version) when `baseHash` is stale. */
export const saveFile = (path: string, text: string, baseHash: string) =>
  request<{ doc: Omit<FileDoc, 'text'> }>('/api/surfaces/file/save', post({ path, text, baseHash })).then((r) => r.doc);

export const formatRange = (path: string, range?: LineRange): string =>
  !range ? path : range.startLine === range.endLine ? `${path}:${range.startLine}` : `${path}:${range.startLine}-${range.endLine}`;

/** "src/app.ts:10-20" → { name: "src/app.ts", range } (range optional). */
export function splitRangeSuffix(query: string): { name: string; range?: LineRange } {
  const m = /^(.*?):(\d+)(?:-(\d+))?$/.exec(query);
  if (!m) return { name: query };
  const startLine = Number(m[2]);
  const endLine = m[3] ? Number(m[3]) : startLine;
  return { name: m[1]!, range: { startLine: Math.min(startLine, endLine), endLine: Math.max(startLine, endLine) } };
}
