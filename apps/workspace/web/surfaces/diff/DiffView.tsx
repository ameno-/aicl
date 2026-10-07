/** The shared diff renderer: file list, unified / side-by-side, collapsed context, per-hunk actions, inline comments. */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DiffFile, DiffHunk, DiffLine, ReviewComment } from '../../../shared/git.ts';
import { surfaceAddress } from '../../../shared/surfaces.ts';
import './diff.css';

export interface InlineComment extends ReviewComment {
  draft?: boolean;
  by?: string;
}

export interface HunkAction {
  label: string;
  title?: string;
  run(file: DiffFile, hunk: DiffHunk, index: number): void;
  danger?: boolean;
}

export interface DiffViewProps {
  files: DiffFile[];
  split: boolean;
  comments: InlineComment[];
  hunkActions?: HunkAction[];
  onAddComment?(file: DiffFile, line: DiffLine, side: 'LEFT' | 'RIGHT', body: string): void | Promise<void>;
  onDeleteDraft?(id: string): void;
  onOpenInHunk?(file: DiffFile, hunkIndex: number): void;
  compact?: boolean;
}

const COLLAPSE_OVER = 8;
const KEEP = 3;

type Row = { kind: 'line'; line: DiffLine } | { kind: 'fold'; key: string; lines: DiffLine[] };

/** Fold runs of more than COLLAPSE_OVER context lines, keeping KEEP at each edge. */
function rowsOf(hunk: DiffHunk, expanded: Set<string>, hunkKey: string): Row[] {
  const rows: Row[] = [];
  let run: DiffLine[] = [];
  const flush = (atStart: boolean, atEnd: boolean) => {
    if (!run.length) return;
    const head = atStart ? 0 : KEEP;
    const tail = atEnd ? 0 : KEEP;
    const key = `${hunkKey}:${rows.length}`;
    if (run.length > COLLAPSE_OVER && !expanded.has(key) && run.length > head + tail + 1) {
      run.slice(0, head).forEach((line) => rows.push({ kind: 'line', line }));
      rows.push({ kind: 'fold', key, lines: run.slice(head, run.length - tail) });
      run.slice(run.length - tail).forEach((line) => rows.push({ kind: 'line', line }));
    } else run.forEach((line) => rows.push({ kind: 'line', line }));
    run = [];
  };
  hunk.lines.forEach((line) => {
    if (line.type === 'context') run.push(line);
    else {
      flush(rows.length === 0, false);
      rows.push({ kind: 'line', line });
    }
  });
  flush(rows.length === 0, true);
  return rows;
}

const sideOf = (l: DiffLine): 'LEFT' | 'RIGHT' => (l.type === 'del' ? 'LEFT' : 'RIGHT');
const lineNo = (l: DiffLine) => (l.type === 'del' ? l.oldLine : l.newLine);
const mark = (l: DiffLine) => (l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' ');

function CommentThread({ comments, onDelete }: { comments: InlineComment[]; onDelete?: ((id: string) => void) | undefined }) {
  return (
    <div className="gd-thread">
      {comments.map((c) => (
        <div key={c.id} className="gd-comment" data-draft={c.draft ? 'true' : undefined}>
          <div className="gd-comment-head">
            <strong>{c.author}</strong>
            {c.draft ? <span className="gd-badge">draft</span> : null}
            {c.draft && onDelete ? (
              <button className="gd-link" onClick={() => onDelete(c.id)} aria-label="Delete draft">
                delete
              </button>
            ) : null}
          </div>
          <div className="gd-comment-body">{c.body}</div>
        </div>
      ))}
    </div>
  );
}

function Composer({ onSubmit, onCancel }: { onSubmit(body: string): void; onCancel(): void }) {
  const [body, setBody] = useState('');
  return (
    <div className="gd-composer">
      <textarea autoFocus value={body} placeholder="Draft a comment (stays local until you submit a review)" onChange={(e) => setBody(e.target.value)} />
      <div className="gd-row">
        <button className="gd-btn" disabled={!body.trim()} onClick={() => onSubmit(body.trim())}>
          Add draft
        </button>
        <button className="gd-btn gd-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function HunkView({ file, hunk, index, props, fileKey }: { file: DiffFile; hunk: DiffHunk; index: number; props: DiffViewProps; fileKey: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState<string | null>(null);
  const hunkKey = `${fileKey}#${index}`;
  const rows = useMemo(() => rowsOf(hunk, expanded, hunkKey), [hunk, expanded, hunkKey]);
  const forLine = (l: DiffLine) => props.comments.filter((c) => c.path === file.path && c.side === sideOf(l) && c.line === lineNo(l));
  const lineKey = (l: DiffLine) => `${sideOf(l)}${lineNo(l)}`;

  const expand = (key: string) => setExpanded((s) => new Set(s).add(key));
  const threads = (l: DiffLine): ReactNode => {
    const list = forLine(l);
    const open = composing === lineKey(l);
    if (!list.length && !open) return null;
    return (
      <div className="gd-thread-row">
        {list.length ? <CommentThread comments={list} onDelete={props.onDeleteDraft} /> : null}
        {open ? (
          <Composer
            onCancel={() => setComposing(null)}
            onSubmit={(body) => {
              setComposing(null);
              void props.onAddComment?.(file, l, sideOf(l), body);
            }}
          />
        ) : null}
      </div>
    );
  };
  const gutter = (l: DiffLine) =>
    props.onAddComment && lineNo(l) !== undefined ? (
      <button className="gd-plus" aria-label="Add comment" title="Draft a comment on this line" onClick={() => setComposing(lineKey(l))}>
        +
      </button>
    ) : null;

  // Side-by-side: pair consecutive del/add runs.
  const pairs = useMemo(() => {
    const out: Array<{ left?: DiffLine; right?: DiffLine; fold?: Extract<Row, { kind: 'fold' }> }> = [];
    let dels: DiffLine[] = [];
    let adds: DiffLine[] = [];
    const flush = () => {
      for (let i = 0; i < Math.max(dels.length, adds.length); i++) out.push({ ...(dels[i] ? { left: dels[i]! } : {}), ...(adds[i] ? { right: adds[i]! } : {}) });
      dels = [];
      adds = [];
    };
    for (const r of rows) {
      if (r.kind === 'fold') {
        flush();
        out.push({ fold: r });
      } else if (r.line.type === 'del') dels.push(r.line);
      else if (r.line.type === 'add') adds.push(r.line);
      else {
        flush();
        out.push({ left: r.line, right: r.line });
      }
    }
    flush();
    return out;
  }, [rows]);

  return (
    <div className="gd-hunk" data-hunk data-hunk-key={hunkKey} tabIndex={-1}>
      <div className="gd-hunk-head">
        <code>{hunk.header}</code>
        <span className="gd-spacer" />
        {props.onOpenInHunk ? (
          <button className="gd-btn gd-btn-ghost" onClick={() => props.onOpenInHunk?.(file, index)} title="Open this hunk in Hunk">
            Open in Hunk
          </button>
        ) : null}
        {props.hunkActions?.map((a) => (
          <button key={a.label} className={`gd-btn${a.danger ? ' gd-btn-danger' : ''}`} title={a.title} onClick={() => a.run(file, hunk, index)}>
            {a.label}
          </button>
        ))}
      </div>
      {!props.split ? (
        <div className="gd-lines">
          {rows.map((r, i) =>
            r.kind === 'fold' ? (
              <button key={i} className="gd-fold" onClick={() => expand(r.key)}>
                ⋯ {r.lines.length} unchanged lines
              </button>
            ) : (
              <div key={i}>
                <div className="gd-line" data-type={r.line.type}>
                  <span className="gd-no">{r.line.oldLine ?? ''}</span>
                  <span className="gd-no">{r.line.newLine ?? ''}</span>
                  {gutter(r.line)}
                  <span className="gd-mark">{mark(r.line)}</span>
                  <span className="gd-code">{r.line.content || ' '}</span>
                </div>
                {threads(r.line)}
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="gd-lines gd-split">
          {pairs.map((p, i) =>
            p.fold ? (
              <button key={i} className="gd-fold" onClick={() => expand(p.fold!.key)}>
                ⋯ {p.fold.lines.length} unchanged lines
              </button>
            ) : (
              <div key={i}>
                <div className="gd-pair">
                  {(['left', 'right'] as const).map((side) => {
                    const l = p[side];
                    return (
                      <div key={side} className="gd-line" data-type={l ? (l.type === 'context' ? 'context' : l.type) : 'empty'}>
                        <span className="gd-no">{l ? (side === 'left' ? l.oldLine : l.newLine) : ''}</span>
                        {l && !(side === 'left' && l.type === 'context') ? gutter(l) : null}
                        <span className="gd-code">{l ? l.content || ' ' : ''}</span>
                      </div>
                    );
                  })}
                </div>
                {[p.left, p.right].map((l, k) => (l && !(k === 0 && l === p.right) ? <div key={k}>{threads(l)}</div> : null))}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function DiffView(props: DiffViewProps) {
  const { files } = props;
  const root = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState(0);

  const hunks = useCallback(() => [...(root.current?.querySelectorAll<HTMLElement>('[data-hunk]') ?? [])], []);
  const go = useCallback(
    (delta: number) => {
      const list = hunks();
      if (!list.length) return;
      const next = Math.max(0, Math.min(list.length - 1, current + delta));
      setCurrent(next);
      list.forEach((h, i) => h.toggleAttribute('data-current', i === next));
      list[next]?.scrollIntoView({ block: 'nearest' });
    },
    [current, hunks],
  );
  useEffect(() => {
    hunks().forEach((h, i) => h.toggleAttribute('data-current', i === current));
  });

  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || e.metaKey || e.ctrlKey) return;
    if (e.key === 'j') go(1);
    else if (e.key === 'k') go(-1);
  };

  if (!files.length) return <div className="surface-empty">No changes.</div>;
  return (
    <div className="gd" ref={root} tabIndex={0} onKeyDown={onKeyDown} data-compact={props.compact ? 'true' : undefined} aria-label="Diff (j/k to move between hunks)">
      <div className="gd-files">
        {files.map((f) => (
          <a key={f.path} href={`#gd-${encodeURIComponent(f.path)}`} className="gd-chip" onClick={() => setCollapsed((s) => { const n = new Set(s); n.delete(f.path); return n; })}>
            <span>{f.path.split('/').pop()}</span>
            <span className="gd-add">+{f.additions}</span>
            <span className="gd-del">-{f.deletions}</span>
          </a>
        ))}
      </div>
      {files.map((f) => {
        const fileKey = f.path;
        const folded = collapsed.has(f.path);
        return (
          <section key={f.path} id={`gd-${encodeURIComponent(f.path)}`} className="gd-file">
            <header className="gd-file-head">
              <button className="gd-link" aria-label={folded ? 'Expand file' : 'Collapse file'} onClick={() => setCollapsed((s) => { const n = new Set(s); n.has(f.path) ? n.delete(f.path) : n.add(f.path); return n; })}>
                {folded ? '▸' : '▾'}
              </button>
              <a className="gd-path" href={surfaceAddress({ kind: 'file', id: f.path })} title="Open file">
                {f.oldPath && f.oldPath !== f.path ? `${f.oldPath} → ${f.path}` : f.path}
              </a>
              {f.status !== 'modified' ? <span className="gd-badge">{f.status}</span> : null}
              <span className="gd-add">+{f.additions}</span>
              <span className="gd-del">-{f.deletions}</span>
            </header>
            {folded ? null : f.binary ? (
              <div className="surface-empty">Binary file</div>
            ) : f.hunks.length === 0 ? (
              <div className="surface-empty">{f.status === 'renamed' ? 'Renamed without changes' : 'No textual changes'}</div>
            ) : (
              f.hunks.map((h, i) => <HunkView key={h.header + i} file={f} hunk={h} index={i} props={props} fileKey={fileKey} />)
            )}
          </section>
        );
      })}
    </div>
  );
}
