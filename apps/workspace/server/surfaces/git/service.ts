/**
 * The git service: status, diffs, per-turn snapshots, staging, commit.
 * Pure of HTTP and Pi; consequential actions ask `approve` first.
 */
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { DiffData, DiffFile, DiffSpec, GitStatus, GitStatusFile } from '../../../shared/git.ts';
import { run, runOk } from './exec.ts';
import { diffStats, hunkPatch, parseDiff } from './parse.ts';

export type Approve = (request: { tool: string; summary: string; input: unknown }) => Promise<{ approved: boolean; note?: string }>;

export class GitError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** The user's rule: nothing is committed on these. */
export const PROTECTED_BRANCHES = ['main', 'master'];
const DIFF_ARGS = ['-c', 'core.quotepath=false', '-c', 'core.pager=cat', 'diff', '--no-color', '--no-ext-diff', '--find-renames'];

export function createGitService(workspace: string) {
  const git = (args: string[], options: { input?: string; env?: Record<string, string> } = {}) =>
    run('git', args, { cwd: workspace, ...options });

  async function isRepo(): Promise<boolean> {
    return (await git(['rev-parse', '--is-inside-work-tree'])).stdout.trim() === 'true';
  }

  async function branch(): Promise<string | undefined> {
    const r = await git(['branch', '--show-current']);
    return r.stdout.trim() || undefined;
  }

  async function status(): Promise<GitStatus> {
    if (!(await isRepo())) return { repo: false, staged: [], unstaged: [], untracked: [], error: 'not a git repository' };
    const r = await git(['status', '--porcelain=v1', '-z', '-b', '--untracked-files=all', '--', '.', ':(exclude).aicl']);
    const parts = r.stdout.split('\0');
    const out: GitStatus = { repo: true, staged: [], unstaged: [], untracked: [] };
    const head = parts.shift() ?? '';
    const hm = /^## (?:No commits yet on |Initial commit on )?(.+?)(?:\.\.\.(\S+))?(?: \[.*\])?$/.exec(head);
    if (hm) {
      out.branch = hm[1];
      if (hm[2]) out.upstream = hm[2];
    }
    for (let i = 0; i < parts.length; i++) {
      const entry = parts[i]!;
      if (entry.length < 4) continue;
      const file: GitStatusFile = { index: entry[0]!, worktree: entry[1]!, path: entry.slice(3) };
      if (file.index === 'R' || file.index === 'C') file.origPath = parts[++i];
      if (file.index === '?') out.untracked.push(file);
      else {
        if (file.index !== ' ') out.staged.push(file);
        if (file.worktree !== ' ') out.unstaged.push(file);
      }
    }
    return out;
  }

  /** A tree id for the working tree right now: tracked + untracked (minus .gitignore and .aicl/). */
  async function snapshot(): Promise<string | null> {
    if (!(await isRepo())) return null;
    const dir = await mkdtemp(path.join(os.tmpdir(), 'aicl-snap-'));
    const indexFile = path.join(dir, 'index');
    const env = { GIT_INDEX_FILE: indexFile };
    try {
      const real = (await git(['rev-parse', '--path-format=absolute', '--git-path', 'index'])).stdout.trim();
      let seeded = false;
      try {
        await copyFile(real, indexFile);
        seeded = true;
      } catch {
        /* no index yet */
      }
      if (!seeded && (await git(['rev-parse', '--verify', '-q', 'HEAD'])).code === 0) await runOk('git', ['read-tree', 'HEAD'], { cwd: workspace, env });
      await runOk('git', ['add', '-A', '--', '.', ':(exclude).aicl'], { cwd: workspace, env });
      return (await runOk('git', ['write-tree'], { cwd: workspace, env })).trim();
    } catch {
      return null;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  async function untrackedPaths(filter?: string): Promise<string[]> {
    const args = ['ls-files', '--others', '--exclude-standard', '-z', '--', ...(filter ? [filter] : ['.']), ':(exclude).aicl'];
    return (await git(args)).stdout.split('\0').filter(Boolean);
  }

  /** Raw unified diff for a spec. `view` overrides the working/staged side of a working spec. */
  async function diffText(spec: DiffSpec, view?: 'working' | 'staged'): Promise<string> {
    const mode = spec.mode === 'working' || spec.mode === 'staged' ? (view ?? spec.mode) : spec.mode;
    const pathspec = spec.path ? ['--', spec.path] : [];
    if (mode === 'working') {
      let text = (await git([...DIFF_ARGS, ...pathspec])).stdout;
      for (const file of await untrackedPaths(spec.path)) {
        // --no-index exits 1 when the files differ, which is the point.
        text += (await git([...DIFF_ARGS, '--no-index', '--', '/dev/null', file])).stdout;
      }
      return text;
    }
    if (mode === 'staged') return (await git([...DIFF_ARGS, '--cached', ...pathspec])).stdout;
    if (mode === 'turn') {
      if (!spec.from) throw new GitError('no snapshot for this turn');
      const to = spec.to ?? (await snapshot());
      if (!to) throw new GitError('could not snapshot the working tree');
      return (await git([...DIFF_ARGS, spec.from, to, ...pathspec])).stdout;
    }
    const range = spec.from ?? '';
    if (!range) throw new GitError('no revision given');
    if (range.includes('..')) {
      const r = await git([...DIFF_ARGS, range, ...pathspec]);
      if (r.code !== 0) throw new GitError(r.stderr.trim() || `bad revision range ${range}`);
      return r.stdout;
    }
    const r = await git(['-c', 'core.quotepath=false', 'show', '--format=', '--patch', '--no-color', '--find-renames', range, ...pathspec]);
    if (r.code !== 0) throw new GitError(r.stderr.trim() || `unknown revision ${range}`);
    return r.stdout;
  }

  async function diff(spec: DiffSpec, view?: 'working' | 'staged'): Promise<DiffData> {
    const canStage = spec.mode !== 'range';
    if (!(await isRepo())) {
      return { repo: false, spec, files: [], stats: { files: 0, additions: 0, deletions: 0 }, canStage: false, error: 'not a git repository' };
    }
    try {
      const files = parseDiff(await diffText(spec, view));
      return { repo: true, spec, files, stats: diffStats(files), canStage };
    } catch (cause) {
      return { repo: true, spec, files: [], stats: { files: 0, additions: 0, deletions: 0 }, canStage, error: (cause as Error).message };
    }
  }

  /** Parse a user/agent target into a spec ('working' | 'staged' | ref or a..b); 'turn' is resolved by the caller. */
  function specFor(target: string | undefined, file?: string): DiffSpec {
    const t = (target ?? 'working').trim() || 'working';
    const base = file ? { path: file } : {};
    if (t === 'working') return { mode: 'working', label: file ? `Working changes · ${file}` : 'Working changes', ...base };
    if (t === 'staged') return { mode: 'staged', label: file ? `Staged · ${file}` : 'Staged changes', ...base };
    if (!/^[\w./~^@{}-]+(\.\.\.?[\w./~^@{}-]+)?$/.test(t) || t.startsWith('-')) throw new GitError(`unsupported diff target: ${t}`);
    return { mode: 'range', from: t, label: t.includes('..') ? t : `Commit ${t}`, ...base };
  }

  /* ── staging ──────────────────────────────────────────────────── */

  async function findHunk(side: 'unstaged' | 'staged', file: string, hunkHeader: string): Promise<{ file: DiffFile; hunk: DiffFile['hunks'][number] }> {
    const args = side === 'staged' ? [...DIFF_ARGS, '--cached', '--', file] : [...DIFF_ARGS, '--', file];
    const found = parseDiff((await git(args)).stdout).find((f) => f.path === file);
    const hunk = found?.hunks.find((h) => h.header === hunkHeader);
    if (!found || !hunk) throw new GitError('that hunk no longer exists; reload the diff', 409);
    return { file: found, hunk };
  }

  async function apply(patch: string, flags: string[]): Promise<void> {
    const r = await git(['apply', '--recount', ...flags, '-'], { input: patch });
    if (r.code !== 0) throw new GitError(`git apply failed: ${r.stderr.trim()}`, 409);
  }

  async function stage(file: string, hunkHeader?: string): Promise<void> {
    if (!hunkHeader) return void (await runOk('git', ['add', '--', file], { cwd: workspace }));
    if ((await untrackedPaths(file)).includes(file)) return void (await runOk('git', ['add', '--', file], { cwd: workspace }));
    const { file: f, hunk } = await findHunk('unstaged', file, hunkHeader);
    await apply(hunkPatch(f, hunk), ['--cached']);
  }

  async function unstage(file: string, hunkHeader?: string): Promise<void> {
    if (!hunkHeader) {
      const hasHead = (await git(['rev-parse', '--verify', '-q', 'HEAD'])).code === 0;
      return void (await runOk('git', hasHead ? ['restore', '--staged', '--', file] : ['rm', '--cached', '-q', '--', file], { cwd: workspace }));
    }
    const { file: f, hunk } = await findHunk('staged', file, hunkHeader);
    await apply(hunkPatch(f, hunk), ['--cached', '-R']);
  }

  /** Destructive: asks first. Returns false when the user declined. */
  async function discard(file: string, hunkHeader: string | undefined, approve: Approve): Promise<{ done: boolean; note?: string }> {
    const untracked = (await untrackedPaths(file)).includes(file);
    const summary = hunkHeader ? `Discard one change in ${file} (${hunkHeader.split('@@')[1]?.trim() ?? 'hunk'})` : `Discard all unstaged changes in ${file}${untracked ? ' (delete untracked file)' : ''}`;
    const answer = await approve({ tool: 'git_discard', summary, input: { path: file, ...(hunkHeader ? { hunk: hunkHeader } : {}) } });
    if (!answer.approved) return { done: false, ...(answer.note ? { note: answer.note } : {}) };
    if (hunkHeader) {
      const { file: f, hunk } = await findHunk('unstaged', file, hunkHeader);
      await apply(hunkPatch(f, hunk), ['-R']);
    } else if (untracked) await runOk('git', ['clean', '-f', '--', file], { cwd: workspace });
    else await runOk('git', ['restore', '--', file], { cwd: workspace });
    return { done: true };
  }

  /* ── commit / branch ──────────────────────────────────────────── */

  async function commit(message: string, all: boolean, approve: Approve): Promise<{ sha: string; branch: string } | { declined: string }> {
    if (!(await isRepo())) throw new GitError('not a git repository');
    if (!message.trim()) throw new GitError('a commit message is required');
    const current = await branch();
    if (current && PROTECTED_BRANCHES.includes(current)) {
      throw new GitError(`Refusing to commit on ${current}. Create a branch first (git_branch or POST /api/git/branch), then commit there.`, 403);
    }
    if (!current) throw new GitError('HEAD is detached; create a branch before committing');
    if (all) await runOk('git', ['add', '-A', '--', '.', ':(exclude).aicl'], { cwd: workspace });
    const staged = (await git(['diff', '--cached', '--name-status'])).stdout.trim();
    if (!staged) throw new GitError('nothing is staged; stage a file or hunk first (or commit with all: true)');
    const answer = await approve({
      tool: 'git_commit',
      summary: `Commit on ${current}: ${message.trim().split('\n')[0]!.slice(0, 80)}`,
      input: { branch: current, message, staged: staged.split('\n') },
    });
    if (!answer.approved) return { declined: answer.note?.trim() || 'no reason given' };
    await runOk('git', ['commit', '-m', message], { cwd: workspace });
    return { sha: (await runOk('git', ['rev-parse', '--short', 'HEAD'], { cwd: workspace })).trim(), branch: current };
  }

  async function createBranch(name: string): Promise<string> {
    if (!(await isRepo())) throw new GitError('not a git repository');
    if ((await git(['check-ref-format', '--branch', name])).code !== 0) throw new GitError(`invalid branch name: ${name}`);
    await runOk('git', ['switch', '-c', name], { cwd: workspace });
    return name;
  }

  /** Stage one hunk of an arbitrary diff (e.g. a turn diff) onto the index. */
  async function stageFromSpec(spec: DiffSpec, file: string, hunkHeader?: string): Promise<void> {
    if (!hunkHeader) return void (await runOk('git', ['add', '--', file], { cwd: workspace }));
    const f = parseDiff(await diffText(spec)).find((x) => x.path === file);
    const hunk = f?.hunks.find((h) => h.header === hunkHeader);
    if (!f || !hunk) throw new GitError('that hunk no longer exists; reload the diff', 409);
    await apply(hunkPatch(f, hunk), ['--cached']);
  }

  return { stageFromSpec, isRepo, branch, status, snapshot, diff, diffText, specFor, stage, unstage, discard, commit, createBranch };
}

export type GitService = ReturnType<typeof createGitService>;
