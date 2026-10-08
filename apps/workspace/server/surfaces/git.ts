/**
 * Surface service: git (shared/git.ts, AICL-39). Diff surfaces (working,
 * staged, ranges, "Changes in this turn") and PR review surfaces, with Hunk
 * interop and the agent tools. Heavy lifting lives in ./git/*.
 */
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { DiffData, DiffSpec, ReviewDraft, ReviewEvent } from '../../shared/git.ts';
import { surfaceAddress } from '../../shared/surfaces.ts';
import type { FeatureModule } from '../feature.ts';
import { requestApproval } from '../hitl.ts';
import { json, readJson, type RouteTable } from '../http.ts';
import { sessionIdFromToolContext } from '../session-context.ts';
import type { SurfaceContext } from './context.ts';
import { importHunkComments, openInHunk, sendNotesToHunk, shellQuote } from './git/hunk.ts';
import { createReview, parsePrRef, type PrRef } from './git/review.ts';
import { createGitService, GitError, type Approve } from './git/service.ts';

const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }], details: {} });

const PROMPT = `Git and review:
- After you change files, call diff_show with target "turn" so the user can review exactly what changed this turn (it opens a diff surface; link it, do not paste the diff). Use diff_show with "working", "staged" or a ref/range (main..HEAD) for other questions.
- For a pull request use review_open, then review_comment for each inline remark (drafts the user can edit), and review_submit only when the user asks you to submit; it always waits for their approval.
- Never commit to main or master: git_commit refuses there. Make a branch with git_branch first. git_commit also waits for approval.`;

const sign = (n: number, mark: string) => `${mark}${n}`;

export function createGitSurface(context: SurfaceContext): FeatureModule {
  const { workspace, surfaces } = context;
  const approveFor =
    (sessionId?: string, signal?: AbortSignal): Approve =>
    (request) => requestApproval({ ...request, ...(sessionId ? { sessionId } : {}) }, signal);
  const service = createGitService(workspace);
  const review = createReview(workspace);

  const specs = new Map<string, DiffSpec>();
  const reviews = new Map<string, PrRef>();
  /** Per-session turn counter and the snapshot taken when the turn began. */
  const turns = new Map<string, { n: number; start: Promise<string | null> }>();

  surfaces.onClose('diff', (id) => void specs.delete(id));
  surfaces.onClose('review', (id) => void reviews.delete(id));

  const stats = (d: DiffData) => `${d.stats.files} file${d.stats.files === 1 ? '' : 's'} ${sign(d.stats.additions, '+')} ${sign(d.stats.deletions, '-')}`;

  function publishDiff(id: string, spec: DiffSpec, data: DiffData, by: 'user' | 'agent', sessionId?: string) {
    return surfaces.upsert({
      kind: 'diff',
      id,
      title: spec.label,
      summary: data.error ?? stats(data),
      status: data.error ? 'error' : 'idle',
      openedBy: by,
      ...(sessionId ? { sessionId } : {}),
      meta: { mode: spec.mode, files: data.stats.files, additions: data.stats.additions, deletions: data.stats.deletions },
    });
  }

  async function openDiff(input: { target?: string; path?: string; sessionId?: string; by: 'user' | 'agent' }) {
    if (!(await service.isRepo())) throw new GitError('not a git repository');
    const sessionId = input.sessionId;
    let id: string;
    let spec: DiffSpec;
    if (input.target === 'turn') {
      const turn = sessionId ? turns.get(sessionId) : undefined;
      const start = turn ? await turn.start : null;
      if (!turn || !start) throw new GitError('no turn snapshot for this session yet; ask in a turn first');
      id = `turn-${sessionId}-${turn.n}`;
      spec = { mode: 'turn', from: start, label: 'Changes in this turn', ...(input.path ? { path: input.path } : {}), ...(sessionId ? { sessionId } : {}) };
      if (input.path) id += `-${input.path}`;
      const existing = specs.get(id);
      if (existing?.to) spec.to = existing.to;
    } else {
      spec = service.specFor(input.target, input.path);
      id = spec.mode === 'range' ? `range-${spec.from}${input.path ? `-${input.path}` : ''}` : `${spec.mode}${input.path ? `-${input.path}` : ''}`;
    }
    specs.set(id, spec);
    const data = await service.diff(spec);
    if (data.error) throw new GitError(data.error);
    return { id, spec, data, surface: publishDiff(id, spec, data, input.by, sessionId) };
  }

  async function ensureReview(pr: string | number, repo: string | undefined, sessionId: string | undefined, by: 'user' | 'agent') {
    const ref = parsePrRef(pr, repo);
    const known = [...reviews.entries()].find(([, r]) => r.number === ref.number && (!ref.repo || r.repo === ref.repo));
    if (known) return { id: known[0], ref: known[1], opened: false };
    const v = await review.view(ref);
    const resolved: PrRef = { repo: v.repo || ref.repo, number: ref.number } as PrRef;
    const name = resolved.repo ? resolved.repo.split('/')[1] : 'pr';
    const id = ref.repo ? `pr-${name}-${ref.number}` : `pr-${ref.number}`;
    reviews.set(id, resolved);
    surfaces.upsert({
      kind: 'review',
      id,
      title: `#${ref.number} ${v.summary?.title ?? ''}`.trim(),
      summary: `${v.summary?.headRefName ?? ''} → ${v.summary?.baseRefName ?? ''} · ${v.summary?.state ?? ''}`,
      status: 'idle',
      openedBy: by,
      ...(sessionId ? { sessionId } : {}),
      meta: { pr: ref.number, ...(resolved.repo ? { repo: resolved.repo } : {}) },
    });
    return { id, ref: resolved, opened: true };
  }

  const touchReview = (id: string, drafts: number) => surfaces.patch('review', id, { summary: `${drafts} draft comment${drafts === 1 ? '' : 's'}` });

  /* ── per-turn snapshots ───────────────────────────────────────── */

  async function finishTurn(sessionId: string) {
    const turn = turns.get(sessionId);
    if (!turn) return;
    const start = await turn.start;
    if (!start) return;
    const end = await service.snapshot();
    if (!end) return;
    const id = `turn-${sessionId}-${turn.n}`;
    const shown = [...specs.entries()].filter(([k]) => k === id || k.startsWith(`${id}-`));
    for (const [k, spec] of shown) {
      const next = { ...spec, to: end };
      specs.set(k, next);
      publishDiff(k, next, await service.diff(next), 'agent', sessionId);
    }
    if (!shown.length && end !== start) {
      const spec: DiffSpec = { mode: 'turn', from: start, to: end, label: 'Changes in this turn', sessionId };
      const data = await service.diff(spec);
      if (data.stats.files > 0) {
        specs.set(id, spec);
        publishDiff(id, spec, data, 'agent', sessionId);
      }
    }
  }

  /* ── HTTP ─────────────────────────────────────────────────────── */

  const guard =
    (fn: (req: Parameters<RouteTable[string]>[0], res: Parameters<RouteTable[string]>[1], ctx: Parameters<RouteTable[string]>[2]) => Promise<unknown>): RouteTable[string] =>
    async (req, res, ctx) => {
      try {
        await fn(req, res, ctx);
      } catch (cause) {
        const status = cause instanceof GitError ? cause.status : 500;
        if (status === 500) console.error('[aicl] git surface:', cause);
        if (!res.headersSent) json(res, status, { message: cause instanceof Error ? cause.message : 'internal error' });
      }
    };

  const sessionOf = (id: string, kind: 'diff' | 'review') => surfaces.get(kind, id)?.sessionId;
  const viewParam = (url: URL) => (url.searchParams.get('view') === 'staged' ? 'staged' : url.searchParams.get('view') === 'working' ? 'working' : undefined);

  async function diffRoute(id: string, view?: 'working' | 'staged'): Promise<DiffData> {
    const spec = specs.get(id);
    if (!spec) throw new GitError('no such diff', 404);
    return service.diff(spec, view);
  }

  const reviewRef = (id: string): PrRef => {
    const ref = reviews.get(id);
    if (!ref) throw new GitError('no such review', 404);
    return ref;
  };

  const routes: RouteTable = {
    'GET /api/git/status': guard(async (_req, res) => json(res, 200, await service.status())),
    'POST /api/git/commit': guard(async (req, res) => {
      const body = await readJson<{ message?: string; all?: boolean; sessionId?: string }>(req);
      const result = await service.commit(body.message ?? '', Boolean(body.all), approveFor(body.sessionId));
      json(res, 200, result);
    }),
    'POST /api/git/branch': guard(async (req, res) => {
      const body = await readJson<{ name?: string }>(req);
      json(res, 200, { branch: await service.createBranch(body.name ?? '') });
    }),
    'GET /api/git/prs': guard(async (_req, res, { url }) => {
      const state = (url.searchParams.get('state') ?? 'open') as 'open' | 'merged' | 'closed' | 'all';
      json(res, 200, { prs: await review.listPrs(state, url.searchParams.get('repo') ?? undefined) });
    }),

    'POST /api/surfaces/diff': guard(async (req, res) => {
      const body = await readJson<{ target?: string; path?: string; sessionId?: string }>(req);
      const { surface } = await openDiff({ ...body, by: 'user' });
      json(res, 200, { surface });
    }),
    'GET /api/surfaces/diff/:id': guard(async (_req, res, { params, url }) => json(res, 200, await diffRoute(params['id']!, viewParam(url)))),
    'POST /api/surfaces/diff/:id/:action': guard(async (req, res, { params }) => {
      const id = params['id']!;
      const body = await readJson<{ path?: string; hunkHeader?: string; view?: 'working' | 'staged' }>(req);
      const file = body.path ?? '';
      if (!file) throw new GitError('path is required');
      if (!specs.has(id)) throw new GitError('no such diff', 404);
      const action = params['action'];
      let declined: string | undefined;
      const spec0 = specs.get(id)!;
      if (action === 'stage') await (spec0.mode === 'turn' || spec0.mode === 'range' ? service.stageFromSpec(spec0, file, body.hunkHeader) : service.stage(file, body.hunkHeader));
      else if (action === 'unstage') await service.unstage(file, body.hunkHeader);
      else if (action === 'discard') {
        const r = await service.discard(file, body.hunkHeader, approveFor(sessionOf(id, 'diff')));
        if (!r.done) declined = r.note?.trim() || 'declined';
      } else throw new GitError(`unknown action ${action}`, 404);
      const data = await diffRoute(id, body.view);
      const spec = specs.get(id)!;
      const info = surfaces.get('diff', id);
      publishDiff(id, spec, data, info?.openedBy ?? 'user', info?.sessionId);
      json(res, 200, { ...data, ...(declined ? { declined } : {}) });
    }),
    'POST /api/surfaces/diff/:id/hunk': guard(async (req, res, { params }) => {
      const id = params['id']!;
      const spec = specs.get(id);
      if (!spec) throw new GitError('no such diff', 404);
      const body = await readJson<{ path?: string; hunkIndex?: number }>(req);
      const data = await service.diff(spec);
      const file = data.files.find((f) => f.path === body.path) ?? data.files[0];
      const hunk = file?.hunks[body.hunkIndex ?? 0];
      const first = hunk?.lines.find((l) => l.type !== 'context');
      const where = path0(spec.path);
      const command =
        spec.mode === 'staged' ? `hunk diff --staged${where}`
        : spec.mode === 'working' ? `hunk diff${where}`
        : spec.mode === 'turn' ? `git diff ${spec.from} ${spec.to ?? '$(git stash create)'}${where} | hunk patch -`
        : spec.from?.includes('..') ? `hunk diff ${spec.from}${where}`
        : `hunk show ${spec.from}${where}`;
      json(res, 200, await openInHunk(workspace, { ...(file ? { file: file.path } : {}), ...(first?.newLine !== undefined ? { newLine: first.newLine } : first?.oldLine !== undefined ? { oldLine: first.oldLine } : {}) }, `cd ${shellQuote(workspace)} && ${command}`));
    }),

    'POST /api/surfaces/review': guard(async (req, res) => {
      const body = await readJson<{ pr?: string | number; repo?: string; sessionId?: string }>(req);
      const { id } = await ensureReview(body.pr ?? '', body.repo, body.sessionId, 'user');
      json(res, 200, { surface: surfaces.get('review', id) });
    }),
    'GET /api/surfaces/review/:id': guard(async (_req, res, { params }) => json(res, 200, await review.load(params['id']!, reviewRef(params['id']!)))),
    'POST /api/surfaces/review/:id/drafts': guard(async (req, res, { params }) => {
      const id = params['id']!;
      reviewRef(id);
      const body = await readJson<{ path?: string; line?: number; side?: 'LEFT' | 'RIGHT'; body?: string; author?: string }>(req);
      const draft = await review.addDraft(id, { path: body.path ?? '', line: Number(body.line), body: body.body ?? '', ...(body.side ? { side: body.side } : {}), ...(body.author ? { author: body.author } : {}) });
      touchReview(id, (await review.readDrafts(id)).length);
      json(res, 200, { draft });
    }),
    'DELETE /api/surfaces/review/:id/drafts/:draftId': guard(async (_req, res, { params }) => {
      const id = params['id']!;
      reviewRef(id);
      const ok = await review.removeDraft(id, params['draftId']!);
      touchReview(id, (await review.readDrafts(id)).length);
      json(res, ok ? 200 : 404, ok ? { ok: true } : { message: 'no such draft' });
    }),
    'POST /api/surfaces/review/:id/submit': guard(async (req, res, { params }) => {
      const id = params['id']!;
      const body = await readJson<{ event?: ReviewEvent; body?: string }>(req);
      if (!body.event || !['APPROVE', 'COMMENT', 'REQUEST_CHANGES'].includes(body.event)) throw new GitError('event must be APPROVE, COMMENT or REQUEST_CHANGES');
      const result = await review.submit(id, reviewRef(id), body.event!, body.body ?? '', approveFor(sessionOf(id, 'review')));
      touchReview(id, (await review.readDrafts(id)).length);
      json(res, 200, result);
    }),
    'POST /api/surfaces/review/:id/hunk/:action': guard(async (req, res, { params }) => {
      const id = params['id']!;
      const ref = reviewRef(id);
      const body = await readJson<{ path?: string; line?: number }>(req);
      if (params['action'] === 'open') {
        const target = ref.repo ? ` -R ${shellQuote(ref.repo)}` : '';
        const command = `cd ${shellQuote(workspace)} && gh pr diff ${ref.number}${target} | hunk patch -`;
        return json(res, 200, await openInHunk(workspace, { ...(body.path ? { file: body.path } : {}), ...(body.line ? { newLine: body.line } : {}) }, command));
      }
      if (params['action'] === 'send') return json(res, 200, await sendNotesToHunk(workspace, await review.readDrafts(id)));
      if (params['action'] === 'import') {
        const result = await importHunkComments(workspace);
        const have = await review.readDrafts(id);
        let added = 0;
        for (const c of result.comments) {
          if (have.some((d) => d.path === c.path && d.line === c.line && d.body === c.body)) continue;
          await review.addDraft(id, { ...c, by: 'hunk' });
          added++;
        }
        touchReview(id, (await review.readDrafts(id)).length);
        return json(res, 200, { ok: result.ok, imported: added, message: result.ok ? `Imported ${added} new note${added === 1 ? '' : 's'} from Hunk.` : result.message });
      }
      throw new GitError('unknown hunk action', 404);
    }),
  };

  /* ── agent tools ──────────────────────────────────────────────── */

  const gitStatus = defineTool({
    name: 'git_status',
    label: 'Git status',
    description: 'Branch and changed files (staged, unstaged, untracked) of the workspace repository.',
    parameters: Type.Object({}),
    async execute() {
      const s = await service.status();
      if (!s.repo) return text('Not a git repository.');
      const list = (label: string, files: typeof s.staged) => (files.length ? `${label}:\n${files.map((f) => `  ${f.index}${f.worktree} ${f.path}`).join('\n')}` : '');
      return text([`branch: ${s.branch ?? '(detached)'}${s.upstream ? ` → ${s.upstream}` : ''}`, list('staged', s.staged), list('unstaged', s.unstaged), list('untracked', s.untracked)].filter(Boolean).join('\n') || `branch: ${s.branch}\nclean`);
    },
  });

  const diffShow = defineTool({
    name: 'diff_show',
    label: 'Show a diff',
    description:
      "Open a diff surface for the user and return a compact summary. target: 'turn' (what you changed since this turn began; use it after editing files), 'working' (unstaged + untracked), 'staged', or a git ref / range like main..HEAD. Optional path narrows to one file.",
    parameters: Type.Object({
      target: Type.Optional(Type.String()),
      path: Type.Optional(Type.String()),
    }),
    async execute(_id, params, _signal, _update, ctx) {
      try {
        const opened = await openDiff({ ...(params.target ? { target: params.target } : {}), ...(params.path ? { path: params.path } : {}), sessionId: sessionIdFromToolContext(ctx), by: 'agent' });
        const lines = opened.data.files.slice(0, 30).map((f) => `  ${f.path} ${sign(f.additions, '+')} ${sign(f.deletions, '-')}${f.status === 'modified' ? '' : ` (${f.status})`}`);
        return text(`${opened.spec.label}: ${stats(opened.data)}\n${lines.join('\n') || '  (no changes)'}\nSurface: ${surfaceAddress({ kind: 'diff', id: opened.id })} (id ${opened.id}; place it on the canvas with component "surface" {kind:"diff", id})`);
      } catch (cause) {
        return text(`Could not open the diff: ${(cause as Error).message}`);
      }
    },
  });

  const reviewOpen = defineTool({
    name: 'review_open',
    label: 'Open PR review',
    description: "Open a review surface for a GitHub pull request (number, owner/repo#N or URL) and summarise it: title, branches, checks, files, existing and draft comments.",
    parameters: Type.Object({ pr: Type.String(), repo: Type.Optional(Type.String({ description: 'owner/repo when the PR is not in the workspace repository.' })) }),
    async execute(_id, params, _signal, _update, ctx) {
      try {
        const { id, ref } = await ensureReview(params.pr, params.repo, sessionIdFromToolContext(ctx), 'agent');
        const data = await review.load(id, ref);
        const checks = data.checks.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.bucket ?? c.state]: (acc[c.bucket ?? c.state] ?? 0) + 1 }), {});
        const files = data.files.slice(0, 40).map((f) => `  ${f.path} ${sign(f.additions, '+')} ${sign(f.deletions, '-')}`);
        return text(
          `#${data.pr?.number} ${data.pr?.title} (${data.pr?.state}) ${data.pr?.headRefName} → ${data.pr?.baseRefName}\nchecks: ${Object.entries(checks).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'}\n${stats({ ...({} as DiffData), stats: data.stats })}\n${files.join('\n')}\nexisting comments: ${data.comments.length}, drafts: ${data.drafts.length}\nSurface: ${surfaceAddress({ kind: 'review', id })} (id ${id})${data.error ? `\nwarning: ${data.error}` : ''}`,
        );
      } catch (cause) {
        return text(`Could not open the review: ${(cause as Error).message}`);
      }
    },
  });

  const reviewComment = defineTool({
    name: 'review_comment',
    label: 'Draft review comment',
    description: 'Add a DRAFT inline comment on a PR file line (new-file line number unless side is LEFT). Drafts are stored locally for the user to edit; nothing reaches GitHub until review_submit is approved.',
    parameters: Type.Object({
      pr: Type.String(),
      repo: Type.Optional(Type.String()),
      path: Type.String(),
      line: Type.Number(),
      body: Type.String(),
      side: Type.Optional(Type.Union([Type.Literal('LEFT'), Type.Literal('RIGHT')])),
    }),
    async execute(_id, params, _signal, _update, ctx) {
      try {
        const { id } = await ensureReview(params.pr, params.repo, sessionIdFromToolContext(ctx), 'agent');
        const draft = await review.addDraft(id, { path: params.path, line: params.line, body: params.body, ...(params.side ? { side: params.side } : {}), by: 'agent', author: 'agent' });
        touchReview(id, (await review.readDrafts(id)).length);
        return text(`Draft ${draft.id} added on ${draft.path}:${draft.line}. It is not submitted.`);
      } catch (cause) {
        return text(`Could not add the draft: ${(cause as Error).message}`);
      }
    },
  });

  const reviewSubmit = defineTool({
    name: 'review_submit',
    label: 'Submit PR review',
    description: "Submit the drafted review to GitHub. event: APPROVE | COMMENT | REQUEST_CHANGES. The user is shown the exact comments and must approve first; if declined, nothing is sent.",
    parameters: Type.Object({
      pr: Type.String(),
      repo: Type.Optional(Type.String()),
      event: Type.Union([Type.Literal('APPROVE'), Type.Literal('COMMENT'), Type.Literal('REQUEST_CHANGES')]),
      body: Type.Optional(Type.String()),
    }),
    async execute(_id, params, signal, _update, ctx) {
      try {
        const sessionId = sessionIdFromToolContext(ctx);
        const { id, ref } = await ensureReview(params.pr, params.repo, sessionId, 'agent');
        const result = await review.submit(id, ref, params.event, params.body ?? '', approveFor(sessionId, signal));
        touchReview(id, (await review.readDrafts(id)).length);
        return text(result.submitted ? `Review submitted${result.url ? `: ${result.url}` : ''}.` : `The user declined to submit: ${result.note ?? 'no reason given'}. Nothing was sent.`);
      } catch (cause) {
        return text(`Could not submit: ${(cause as Error).message}`);
      }
    },
  });

  const gitCommit = defineTool({
    name: 'git_commit',
    label: 'Git commit',
    description: "Commit the staged changes on the current branch (all: true stages everything first). Waits for the user's approval. Refuses on main/master: create a branch with git_branch first.",
    parameters: Type.Object({ message: Type.String(), all: Type.Optional(Type.Boolean()) }),
    async execute(_id, params, signal, _update, ctx) {
      try {
        const r = await service.commit(params.message, Boolean(params.all), approveFor(sessionIdFromToolContext(ctx), signal));
        return text('declined' in r ? `The user declined the commit: ${r.declined}. Nothing was committed.` : `Committed ${r.sha} on ${r.branch}.`);
      } catch (cause) {
        return text(`Not committed: ${(cause as Error).message}`);
      }
    },
  });

  const gitBranch = defineTool({
    name: 'git_branch',
    label: 'Create branch',
    description: 'Create and switch to a new branch (use before committing when on main/master).',
    parameters: Type.Object({ name: Type.String() }),
    async execute(_id, params) {
      try {
        return text(`Switched to new branch ${await service.createBranch(params.name)}.`);
      } catch (cause) {
        return text(`Could not create the branch: ${(cause as Error).message}`);
      }
    },
  });

  return {
    routes,
    tools: [gitStatus, diffShow, reviewOpen, reviewComment, reviewSubmit, gitCommit, gitBranch],
    prompt: PROMPT,
    onAgentEvent(sessionId, event) {
      const type = (event as { type?: string } | null)?.type;
      if (type === 'agent_start') {
        const prev = turns.get(sessionId);
        turns.set(sessionId, { n: (prev?.n ?? 0) + 1, start: service.snapshot().catch(() => null) });
      } else if (type === 'agent_end') void finishTurn(sessionId).catch((cause) => console.error('[aicl] git turn diff:', cause));
    },
  };
}

const path0 = (p?: string) => (p ? ` -- ${shellQuote(p)}` : '');
export type { ReviewDraft };
