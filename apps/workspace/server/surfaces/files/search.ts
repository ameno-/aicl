/** Quick-open: a cached list of workspace files and a fuzzy ranker over it. */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { isTreeIgnored } from '../../browse.ts';

export const MAX_INDEXED = 20_000;

/** Every file under root (relative, "/" separated), skipping ignored dirs and symlinks. */
export async function listWorkspaceFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (rel: string): Promise<void> => {
    if (out.length >= MAX_INDEXED) return;
    let entries;
    try {
      entries = await readdir(path.join(root, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (isTreeIgnored(child)) continue;
      if (e.isDirectory()) await walk(child);
      else if (e.isFile()) out.push(child);
    }
  };
  await walk('');
  return out.sort();
}

/**
 * Subsequence score of `query` in `candidate`, or -1 for no match. Rewards
 * consecutive runs, segment starts, basename matches and short paths.
 */
export function fuzzyScore(query: string, candidate: string): number {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  if (!q) return 0;
  const baseStart = c.lastIndexOf('/') + 1;
  let score = 0;
  let ci = 0;
  let run = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const found = c.indexOf(q[qi]!, ci);
    if (found < 0) return -1;
    const boundary = found === 0 || '/._-'.includes(c[found - 1]!);
    run = found === ci && qi > 0 ? run + 1 : 0;
    score += 1 + run * 3 + (boundary ? 4 : 0) + (found >= baseStart ? 2 : 0);
    ci = found + 1;
  }
  const base = c.slice(baseStart);
  if (base === q) score += 60;
  else if (base.startsWith(q)) score += 40;
  else if (base.includes(q)) score += 25;
  else if (c.includes(q)) score += 8;
  return score - candidate.length * 0.05;
}

export function searchPaths(paths: string[], query: string, limit = 50): string[] {
  const q = query.trim();
  if (!q) return paths.slice(0, limit);
  const scored: Array<{ p: string; s: number }> = [];
  for (const p of paths) {
    const s = fuzzyScore(q, p);
    if (s >= 0) scored.push({ p, s });
  }
  scored.sort((a, b) => b.s - a.s || a.p.length - b.p.length || a.p.localeCompare(b.p));
  return scored.slice(0, limit).map((x) => x.p);
}

/** Lazy cache of the file list; `invalidate()` after structural fs changes. */
export function createPathIndex(root: string) {
  let cached: Promise<string[]> | null = null;
  return {
    get: () => (cached ??= listWorkspaceFiles(root)),
    invalidate: () => {
      cached = null;
    },
  };
}
