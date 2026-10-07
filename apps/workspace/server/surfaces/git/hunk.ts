/**
 * Hunk interop (the user's default diff reviewer). Only `hunk session *` is
 * driven, never the interactive TUI. Everything degrades to "here is the
 * command to run" when Hunk or a live session is missing.
 */
import type { HunkOpenResult, ReviewDraft } from '../../../shared/git.ts';
import { run } from './exec.ts';

export const shellQuote = (s: string) => (/^[\w@%+=:,./~^-]+$/.test(s) ? s : `'${s.replaceAll("'", `'\\''`)}'`);

export async function hunkInstalled(cwd: string): Promise<boolean> {
  return (await run('hunk', ['--version'], { cwd, timeoutMs: 5000 })).code === 0;
}

/** Is a live Hunk session attached to this repo? */
export async function liveSession(cwd: string): Promise<boolean> {
  return (await run('hunk', ['session', 'get', '--repo', cwd, '--json'], { cwd, timeoutMs: 8000 })).code === 0;
}

export interface HunkTarget {
  file?: string;
  /** Line on the new side (or old side when only deletions) to land on. */
  newLine?: number;
  oldLine?: number;
}

/** Navigate a live session, or return the exact command to run. */
export async function openInHunk(cwd: string, target: HunkTarget, command: string): Promise<HunkOpenResult> {
  if (!(await hunkInstalled(cwd))) return { navigated: false, command, message: 'Hunk is not installed (npm i -g hunkdiff). Run this to review the same diff:' };
  if (!(await liveSession(cwd))) return { navigated: false, command, message: 'No live Hunk session for this repo. Start one in your terminal:' };
  if (!target.file || (target.newLine === undefined && target.oldLine === undefined)) {
    return { navigated: true, message: 'A Hunk session is live; nothing specific to navigate to.' };
  }
  const where = target.newLine !== undefined ? ['--new-line', String(target.newLine)] : ['--old-line', String(target.oldLine)];
  const r = await run('hunk', ['session', 'navigate', '--repo', cwd, '--file', target.file, ...where, '--json'], { cwd, timeoutMs: 8000 });
  if (r.code !== 0) return { navigated: false, command, message: `Hunk could not navigate (${(r.stderr || r.stdout).trim().split('\n')[0]}). Start a review with:` };
  return { navigated: true, message: `Moved Hunk to ${target.file}.` };
}

/** Send draft comments to the live session as Hunk notes. */
export async function sendNotesToHunk(cwd: string, drafts: ReviewDraft[]): Promise<{ ok: boolean; sent: number; message: string }> {
  if (!drafts.length) return { ok: true, sent: 0, message: 'No draft comments to send.' };
  if (!(await hunkInstalled(cwd))) return { ok: false, sent: 0, message: 'Hunk is not installed.' };
  if (!(await liveSession(cwd))) return { ok: false, sent: 0, message: 'No live Hunk session for this repo. Start one with `hunk diff` first.' };
  const comments = drafts.map((d) => ({
    filePath: d.path,
    ...(d.side === 'LEFT' ? { oldLine: d.line } : { newLine: d.line }),
    summary: d.body.split('\n')[0]!.slice(0, 200),
    ...(d.body.includes('\n') ? { rationale: d.body } : {}),
    author: d.author,
  }));
  const r = await run('hunk', ['session', 'comment', 'apply', '--repo', cwd, '--stdin', '--json'], { cwd, input: JSON.stringify({ comments }), timeoutMs: 15000 });
  if (r.code !== 0) return { ok: false, sent: 0, message: (r.stderr || r.stdout).trim().split('\n')[0] ?? 'hunk failed' };
  return { ok: true, sent: comments.length, message: `Sent ${comments.length} note${comments.length === 1 ? '' : 's'} to Hunk.` };
}

type Raw = Record<string, unknown>;

/** Human notes from the live session, as draft shapes (ids are assigned by the caller). */
export async function importHunkComments(cwd: string): Promise<{ ok: boolean; comments: Array<Pick<ReviewDraft, 'path' | 'line' | 'side' | 'body' | 'author'>>; message: string }> {
  if (!(await hunkInstalled(cwd))) return { ok: false, comments: [], message: 'Hunk is not installed.' };
  if (!(await liveSession(cwd))) return { ok: false, comments: [], message: 'No live Hunk session for this repo.' };
  const r = await run('hunk', ['session', 'comment', 'list', '--repo', cwd, '--type', 'user', '--json'], { cwd, timeoutMs: 10000 });
  if (r.code !== 0) return { ok: false, comments: [], message: (r.stderr || r.stdout).trim().split('\n')[0] ?? 'hunk failed' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    return { ok: false, comments: [], message: 'Hunk returned something unreadable.' };
  }
  const list = (Array.isArray(parsed) ? parsed : ((parsed as Raw)?.['comments'] ?? (parsed as Raw)?.['notes'] ?? [])) as Raw[];
  const comments = [];
  for (const c of Array.isArray(list) ? list : []) {
    const file = c['filePath'] ?? c['file'] ?? c['path'];
    const newLine = Number(c['newLine'] ?? c['new_line']);
    const oldLine = Number(c['oldLine'] ?? c['old_line']);
    const text = c['summary'] ?? c['body'] ?? c['text'] ?? c['rationale'];
    const line = Number.isFinite(newLine) && newLine > 0 ? newLine : oldLine;
    if (typeof file !== 'string' || typeof text !== 'string' || !(line > 0)) continue;
    comments.push({ path: file, line, side: (Number.isFinite(newLine) && newLine > 0 ? 'RIGHT' : 'LEFT') as 'RIGHT' | 'LEFT', body: text, author: typeof c['author'] === 'string' ? c['author'] : 'hunk' });
  }
  return { ok: true, comments, message: `Imported ${comments.length} note${comments.length === 1 ? '' : 's'} from Hunk.` };
}
