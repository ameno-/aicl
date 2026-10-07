/**
 * Read-only workspace browsing for the app's Files tab:
 *   GET /api/files?dir=<relative>      directory listing
 *   GET /api/file/text?path=<relative> a text file's content (capped)
 * Both are confined to the workspace root (symlink escapes included).
 */
import { open, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

export interface FileEntry {
  name: string;
  /** Relative to the workspace root, "/" separated. */
  path: string;
  dir: boolean;
  size?: number;
}

const HIDDEN = new Set(['node_modules', '.git', '.DS_Store']);
export const MAX_TEXT_BYTES = 200_000;

export class BrowseError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Resolves a workspace-relative path to a real path inside the root, or throws a 400/403/404. */
export async function resolveInside(root: string, requested: string): Promise<{ real: string; rel: string }> {
  if (requested.includes('\0')) throw new BrowseError(400, 'bad path');
  const realRoot = await realpath(root);
  const target = path.isAbsolute(requested) ? requested : path.resolve(realRoot, requested);
  let real: string;
  try {
    real = await realpath(target);
  } catch {
    throw new BrowseError(404, 'not found');
  }
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) throw new BrowseError(403, 'outside the workspace');
  return { real, rel: path.relative(realRoot, real).split(path.sep).join('/') };
}

export async function listDir(root: string, dir: string): Promise<{ dir: string; entries: FileEntry[] }> {
  const { real, rel } = await resolveInside(root, dir);
  if (!(await stat(real)).isDirectory()) throw new BrowseError(400, 'not a directory');
  const names = (await readdir(real, { withFileTypes: true })).filter((d) => !HIDDEN.has(d.name));
  const entries: FileEntry[] = [];
  for (const d of names) {
    const full = path.join(real, d.name);
    let isDir = d.isDirectory();
    let size: number | undefined;
    try {
      const s = await stat(full); // follows symlinks; broken links are skipped
      isDir = s.isDirectory();
      if (!isDir) size = s.size;
    } catch {
      continue;
    }
    entries.push({ name: d.name, path: rel ? `${rel}/${d.name}` : d.name, dir: isDir, ...(size !== undefined ? { size } : {}) });
  }
  entries.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
  return { dir: rel, entries };
}

export async function readText(root: string, file: string): Promise<{ path: string; text: string; truncated: boolean }> {
  const { real, rel } = await resolveInside(root, file);
  const s = await stat(real);
  if (!s.isFile()) throw new BrowseError(400, 'not a file');
  const handle = await open(real, 'r');
  try {
    const buffer = Buffer.alloc(Math.min(s.size, MAX_TEXT_BYTES));
    await handle.read(buffer, 0, buffer.length, 0);
    if (buffer.includes(0)) throw new BrowseError(415, 'binary file');
    return { path: rel, text: buffer.toString('utf8'), truncated: s.size > MAX_TEXT_BYTES };
  } finally {
    await handle.close();
  }
}
