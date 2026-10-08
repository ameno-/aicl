/** PR review sidecar: gh reads, local draft comments, and (approved) review submission. */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PrCheck, PrSummary, ReviewComment, ReviewData, ReviewDraft, ReviewEvent } from '../../../shared/git.ts';
import { run, runOk } from './exec.ts';
import type { Approve } from './service.ts';
import { GitError } from './service.ts';
import { diffStats, parseDiff } from './parse.ts';

export interface PrRef {
  /** owner/repo; absent means "the repository in the workspace". */
  repo?: string;
  number: number;
}

/** 123 | "123" | "owner/repo#123" | https://github.com/owner/repo/pull/123 */
export function parsePrRef(input: string | number, repo?: string): PrRef {
  const s = String(input).trim();
  const url = /github\.com\/([^/\s]+\/[^/\s]+)\/pull\/(\d+)/.exec(s);
  if (url) return { repo: url[1]!, number: Number(url[2]) };
  const short = /^([^/\s#]+\/[^/\s#]+)#(\d+)$/.exec(s);
  if (short) return { repo: short[1]!, number: Number(short[2]) };
  const n = /^#?(\d+)$/.exec(s);
  if (n) return { ...(repo ? { repo } : {}), number: Number(n[1]) };
  throw new GitError(`cannot read PR reference "${s}" (use 123, owner/repo#123 or a PR URL)`);
}

const PR_FIELDS = 'number,title,author,state,headRefName,baseRefName,updatedAt,url,body,additions,deletions,changedFiles,reviewDecision,isDraft';
const repoFlag = (repo?: string) => (repo ? ['--repo', repo] : []);

const toSummary = (pr: Record<string, unknown>): PrSummary => ({
  number: Number(pr['number']),
  title: String(pr['title'] ?? ''),
  author: ((pr['author'] as { login?: string } | null)?.login) ?? undefined,
  state: String(pr['state'] ?? ''),
  headRefName: String(pr['headRefName'] ?? ''),
  baseRefName: String(pr['baseRefName'] ?? ''),
  ...(pr['updatedAt'] ? { updatedAt: String(pr['updatedAt']) } : {}),
  url: String(pr['url'] ?? ''),
});

export function createReview(workspace: string) {
  const gh = (args: string[], input?: string) => run('gh', args, { cwd: workspace, ...(input !== undefined ? { input } : {}), timeoutMs: 90_000 });
  const draftsFile = (id: string) => path.join(workspace, '.aicl', 'reviews', `${id.replace(/[^\w.-]/g, '_')}.json`);

  async function listPrs(state: 'open' | 'merged' | 'closed' | 'all' = 'open', repo?: string): Promise<PrSummary[]> {
    const out = await runOk('gh', ['pr', 'list', ...repoFlag(repo), '--state', state, '--limit', '30', '--json', 'number,title,author,state,headRefName,baseRefName,updatedAt,url'], { cwd: workspace, timeoutMs: 60_000 });
    return (JSON.parse(out) as Array<Record<string, unknown>>).map(toSummary);
  }

  async function view(ref: PrRef): Promise<{ summary: ReviewData['pr']; repo: string }> {
    const r = await gh(['pr', 'view', String(ref.number), ...repoFlag(ref.repo), '--json', PR_FIELDS]);
    if (r.code !== 0) throw new GitError(`gh pr view failed: ${(r.stderr || r.stdout).trim()}`, 502);
    const raw = JSON.parse(r.stdout) as Record<string, unknown>;
    const url = String(raw['url'] ?? '');
    const repo = ref.repo ?? /github\.com\/([^/]+\/[^/]+)\/pull/.exec(url)?.[1] ?? '';
    return {
      repo,
      summary: {
        ...toSummary(raw),
        body: String(raw['body'] ?? ''),
        additions: Number(raw['additions'] ?? 0),
        deletions: Number(raw['deletions'] ?? 0),
        changedFiles: Number(raw['changedFiles'] ?? 0),
        reviewDecision: String(raw['reviewDecision'] ?? ''),
        isDraft: Boolean(raw['isDraft']),
      },
    };
  }

  async function readDrafts(id: string): Promise<ReviewDraft[]> {
    try {
      const list = JSON.parse(await readFile(draftsFile(id), 'utf8')) as unknown;
      return Array.isArray(list) ? (list as ReviewDraft[]) : [];
    } catch {
      return [];
    }
  }

  async function writeDrafts(id: string, drafts: ReviewDraft[]): Promise<void> {
    await mkdir(path.dirname(draftsFile(id)), { recursive: true });
    await writeFile(draftsFile(id), JSON.stringify(drafts, null, 2));
  }

  async function load(id: string, ref: PrRef): Promise<ReviewData> {
    const v = await view(ref);
    const repo = v.repo;
    const [diff, checks, existing, drafts] = await Promise.all([
      gh(['pr', 'diff', String(ref.number), ...repoFlag(ref.repo), '--color', 'never']),
      gh(['pr', 'checks', String(ref.number), ...repoFlag(ref.repo), '--json', 'name,state,bucket,link']),
      repo ? existingComments(repo, ref.number) : Promise.resolve([] as ReviewComment[]),
      readDrafts(id),
    ]);
    const files = parseDiff(diff.stdout);
    let checkList: PrCheck[] = [];
    try {
      checkList = JSON.parse(checks.stdout || '[]') as PrCheck[]; // exits non-zero while checks are pending or failing
    } catch {
      /* "no checks reported" */
    }
    return { repo, pr: v.summary, files, stats: diffStats(files), checks: checkList, comments: existing, drafts, ...(diff.code !== 0 ? { error: `gh pr diff failed: ${diff.stderr.trim()}` } : {}) };
  }

  async function existingComments(repo: string, number: number): Promise<ReviewComment[]> {
    const r = await gh(['api', `repos/${repo}/pulls/${number}/comments`, '--paginate']);
    if (r.code !== 0) return [];
    try {
      // --paginate concatenates arrays as `][`; tolerate it.
      const pages = JSON.parse(`[${r.stdout.trim().replace(/\]\s*\[/g, '],[')}]`) as unknown[];
      const flat = pages.flat(2) as Array<Record<string, unknown>>;
      return flat
        .filter((c) => typeof c['path'] === 'string')
        .map((c) => ({
          id: String(c['id']),
          path: String(c['path']),
          line: Number(c['line'] ?? c['original_line'] ?? 0),
          side: (c['side'] === 'LEFT' ? 'LEFT' : 'RIGHT') as 'LEFT' | 'RIGHT',
          body: String(c['body'] ?? ''),
          author: ((c['user'] as { login?: string } | null)?.login) ?? 'unknown',
          ...(c['created_at'] ? { createdAt: String(c['created_at']) } : {}),
        }));
    } catch {
      return [];
    }
  }

  async function addDraft(id: string, input: { path: string; line: number; side?: 'LEFT' | 'RIGHT'; body: string; by?: ReviewDraft['by']; author?: string }): Promise<ReviewDraft> {
    if (!input.path || !(input.line > 0) || !input.body?.trim()) throw new GitError('a draft needs path, line and body');
    const by = input.by ?? 'user';
    const draft: ReviewDraft = {
      id: randomUUID(),
      path: input.path,
      line: Math.floor(input.line),
      side: input.side === 'LEFT' ? 'LEFT' : 'RIGHT',
      body: input.body.trim(),
      author: input.author ?? by,
      by,
      createdAt: new Date().toISOString(),
    };
    await writeDrafts(id, [...(await readDrafts(id)), draft]);
    return draft;
  }

  async function removeDraft(id: string, draftId: string): Promise<boolean> {
    const all = await readDrafts(id);
    const next = all.filter((d) => d.id !== draftId);
    if (next.length === all.length) return false;
    await writeDrafts(id, next);
    return true;
  }

  /** Asks for approval showing the exact comments; only then posts the review. Never called without a human OK. */
  async function submit(id: string, ref: PrRef, event: ReviewEvent, body: string, approve: Approve): Promise<{ submitted: boolean; note?: string; url?: string }> {
    const drafts = await readDrafts(id);
    const repo = ref.repo ?? (await view(ref)).repo;
    if (!repo) throw new GitError('cannot tell which repository this PR belongs to');
    if (event === 'COMMENT' && !body.trim() && !drafts.length) throw new GitError('nothing to submit: add a comment or a summary');
    const comments = drafts.map((d) => ({ path: d.path, line: d.line, side: d.side, body: d.body }));
    const label = { APPROVE: 'Approve', COMMENT: 'Comment on', REQUEST_CHANGES: 'Request changes on' }[event];
    const answer = await approve({
      tool: 'review_submit',
      summary: `${label} ${repo}#${ref.number} with ${comments.length} inline comment${comments.length === 1 ? '' : 's'}`,
      input: { repo, pr: ref.number, event, body, comments },
    });
    if (!answer.approved) return { submitted: false, ...(answer.note ? { note: answer.note } : {}) };
    const r = await gh(['api', '-X', 'POST', `repos/${repo}/pulls/${ref.number}/reviews`, '--input', '-'], JSON.stringify({ event, ...(body ? { body } : {}), comments }));
    if (r.code !== 0) throw new GitError(`GitHub rejected the review: ${(r.stderr || r.stdout).trim()}`, 502);
    await writeDrafts(id, []);
    const url = (JSON.parse(r.stdout) as { html_url?: string }).html_url;
    return { submitted: true, ...(url ? { url } : {}) };
  }

  return { listPrs, view, load, readDrafts, addDraft, removeDraft, submit };
}

export type Review = ReturnType<typeof createReview>;
