/**
 * `GET /api/file?path=…` — serves images from the workspace and the research
 * references directory only. Cropping (`crop=mobbin`) is NOT done here (no
 * image library is installed); the browser applies a tldraw image crop instead.
 */

import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export const defaultReferencesRoot = (): string =>
  path.resolve(process.env['AICL_REFERENCES'] ?? path.join(os.homedir(), 'dev', 'ai-chat'));

export type FileResolution = { ok: true; file: string; mime: string } | { ok: false; status: 400 | 403 | 404 | 415 };

const inside = (root: string, file: string) => file === root || file.startsWith(root + path.sep);

/** Resolves `requested` (absolute, or relative to any root) to a real image file inside a root. */
export async function resolveAllowedFile(roots: string[], requested: string): Promise<FileResolution> {
  if (!requested || requested.includes('\0')) return { ok: false, status: 400 };
  const realRoots: string[] = [];
  for (const r of roots) {
    try {
      realRoots.push(await realpath(r));
    } catch {
      /* missing root: skip */
    }
  }
  const candidates = path.isAbsolute(requested) ? [requested] : roots.map((r) => path.resolve(r, requested));
  let sawOutside = false;
  for (const candidate of candidates) {
    let real: string;
    try {
      real = await realpath(candidate); // follows symlinks, so escapes are caught below
    } catch {
      continue;
    }
    if (!realRoots.some((r) => inside(r, real))) {
      sawOutside = true;
      continue;
    }
    const mime = MIME[path.extname(real).toLowerCase()];
    if (!mime) return { ok: false, status: 415 };
    if (!(await stat(real)).isFile()) return { ok: false, status: 404 };
    return { ok: true, file: real, mime };
  }
  return { ok: false, status: sawOutside ? 403 : 404 };
}

const MESSAGES = { 400: 'bad path', 403: 'outside allowed roots', 404: 'not found', 415: 'not an image' } as const;

export async function serveFile(res: ServerResponse, roots: string[], requested: string): Promise<void> {
  const result = await resolveAllowedFile(roots, requested);
  if (!result.ok) {
    res.writeHead(result.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: MESSAGES[result.status] }));
    return;
  }
  res.writeHead(200, { 'content-type': result.mime, 'cache-control': 'private, max-age=3600' });
  createReadStream(result.file).pipe(res);
}
