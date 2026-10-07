/**
 * Git surfaces (AICL-39): diff and review. Types shared by the server
 * (server/surfaces/git.ts) and the views (web/surfaces/diff.tsx, review.tsx).
 *
 * HTTP:
 *   GET  /api/git/status                         → GitStatus
 *   POST /api/git/commit {message,all?}          → approval, then { sha, branch } (refused on main/master)
 *   POST /api/git/branch {name}                  → { branch }
 *   GET  /api/git/prs?state=open|merged|all      → { prs: PrSummary[] }
 *   POST /api/surfaces/diff {target?,path?,sessionId?}  → { surface }   target: working|staged|turn|<ref or a..b>
 *   GET  /api/surfaces/diff/:id                  → DiffData
 *   POST /api/surfaces/diff/:id/{stage|unstage|discard} {path,hunkHeader?} → DiffData (discard asks approval)
 *   POST /api/surfaces/diff/:id/hunk {path,hunkIndex?} → HunkOpenResult
 *   POST /api/surfaces/review {pr,repo?}         → { surface }
 *   GET  /api/surfaces/review/:id                → ReviewData
 *   POST /api/surfaces/review/:id/drafts {path,line,side?,body,author?}   DELETE …/drafts/:draftId
 *   POST /api/surfaces/review/:id/submit {event,body?} → approval showing the exact comments, then gh
 *   POST /api/surfaces/review/:id/hunk/{open|send|import}
 */

export interface DiffLine {
  type: 'context' | 'add' | 'del';
  content: string;
  /** Line numbers on the old / new side; absent where the side has no such line. */
  oldLine?: number;
  newLine?: number;
  /** "\ No newline at end of file" follows this line. */
  noNewline?: boolean;
}

export interface DiffHunk {
  /** The full "@@ -a,b +c,d @@ section" header line. */
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  section: string;
  lines: DiffLine[];
}

export interface DiffFile {
  /** New path (old path for deletions). */
  path: string;
  oldPath?: string;
  status: 'added' | 'deleted' | 'modified' | 'renamed' | 'copied';
  binary: boolean;
  additions: number;
  deletions: number;
  /** Raw header lines up to the first hunk; with a hunk's text they make an applicable patch. */
  header: string;
  hunks: DiffHunk[];
}

export interface DiffStats {
  files: number;
  additions: number;
  deletions: number;
}

export interface DiffSpec {
  /** Human label: "Working changes", "Staged", "Changes in this turn", "main..work". */
  label: string;
  mode: 'working' | 'staged' | 'range' | 'turn';
  /** range/turn: git revisions or tree ids. `to` absent on a turn means "the working tree now". */
  from?: string;
  to?: string;
  path?: string;
  sessionId?: string;
}

export interface DiffData {
  repo: boolean;
  spec: DiffSpec;
  files: DiffFile[];
  stats: DiffStats;
  /** Stage buttons: working/staged diffs (full set) and turn diffs (stage only). */
  canStage: boolean;
  error?: string;
}

export interface GitStatusFile {
  path: string;
  origPath?: string;
  /** Porcelain XY: index / worktree state letters ('?' for untracked, ' ' for none). */
  index: string;
  worktree: string;
}

export interface GitStatus {
  repo: boolean;
  branch?: string;
  upstream?: string;
  staged: GitStatusFile[];
  unstaged: GitStatusFile[];
  untracked: GitStatusFile[];
  error?: string;
}

export interface PrSummary {
  number: number;
  title: string;
  author?: string;
  state: string;
  headRefName: string;
  baseRefName: string;
  updatedAt?: string;
  url: string;
}

export interface ReviewComment {
  id: string;
  path: string;
  line: number;
  side: 'LEFT' | 'RIGHT';
  body: string;
  author: string;
  createdAt?: string;
}

export interface ReviewDraft extends ReviewComment {
  by: 'user' | 'agent' | 'hunk';
}

export interface PrCheck {
  name: string;
  state: string;
  bucket?: string;
  link?: string;
}

export interface ReviewData {
  repo?: string;
  pr?: PrSummary & { body?: string; additions?: number; deletions?: number; changedFiles?: number; reviewDecision?: string; isDraft?: boolean };
  files: DiffFile[];
  stats: DiffStats;
  checks: PrCheck[];
  comments: ReviewComment[];
  drafts: ReviewDraft[];
  error?: string;
}

export type ReviewEvent = 'APPROVE' | 'COMMENT' | 'REQUEST_CHANGES';

export interface HunkOpenResult {
  /** True when a live Hunk session was navigated. */
  navigated: boolean;
  /** Otherwise the exact command for the user to run. */
  command?: string;
  message?: string;
}
