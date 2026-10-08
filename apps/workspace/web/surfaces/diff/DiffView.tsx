/**
 * The shared diff renderer: file chips, per-file headers and hunk actions
 * (stage / discard / open in Hunk), with the lines themselves drawn by
 * @pierre/diffs (https://diffs.com — Shiki highlighting, split or stacked,
 * annotations). Review comments are Pierre line annotations; selecting a line
 * opens a draft composer there.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PatchDiff, type DiffLineAnnotation, type SelectedLineRange } from '@pierre/diffs/react';
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

/** What a Pierre annotation carries here: a thread of comments, or the composer for a new one. */
type Note = { kind: 'thread'; comments: InlineComment[] } | { kind: 'compose' };

const THEMES = { dark: 'pierre-dark', light: 'pierre-light' } as const;

/** One file's unified patch text, rebuilt from the parsed header and hunks. */
export function patchOf(file: DiffFile): string {
  const out = [file.header.replace(/\n+$/, '')];
  for (const h of file.hunks) {
    out.push(h.header);
    for (const l of h.lines) {
      out.push(`${l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' '}${l.content}`);
      if (l.noNewline) out.push('\\ No newline at end of file');
    }
  }
  return `${out.join('\n')}\n`;
}

const sideName = (side: 'LEFT' | 'RIGHT') => (side === 'LEFT' ? 'deletions' : 'additions');

/** The parsed line a comment on (side, number) refers to. */
function findLine(file: DiffFile, side: 'LEFT' | 'RIGHT', n: number): DiffLine | undefined {
  for (const h of file.hunks) {
    for (const l of h.lines) {
      if (side === 'LEFT' ? l.type !== 'add' && l.oldLine === n : l.type !== 'del' && l.newLine === n) return l;
    }
  }
  return undefined;
}

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

function FileBody({ file, props, themeType }: { file: DiffFile; props: DiffViewProps; themeType: 'light' | 'dark' }) {
  const [composing, setComposing] = useState<{ side: 'LEFT' | 'RIGHT'; line: number } | null>(null);
  const patch = useMemo(() => patchOf(file), [file]);

  const annotations = useMemo(() => {
    const threads = new Map<string, InlineComment[]>();
    for (const c of props.comments) {
      if (c.path !== file.path || c.line == null) continue;
      const key = `${c.side}:${c.line}`;
      threads.set(key, [...(threads.get(key) ?? []), c]);
    }
    const list: DiffLineAnnotation<Note>[] = [...threads].map(([key, comments]) => {
      const [side, line] = key.split(':') as ['LEFT' | 'RIGHT', string];
      return { side: sideName(side), lineNumber: Number(line), metadata: { kind: 'thread', comments } };
    });
    if (composing) list.push({ side: sideName(composing.side), lineNumber: composing.line, metadata: { kind: 'compose' } });
    return list;
  }, [props.comments, file.path, composing]);

  const options = useMemo(
    () => ({
      theme: THEMES,
      themeType,
      diffStyle: props.split ? ('split' as const) : ('unified' as const),
      disableFileHeader: true,
      overflow: 'scroll' as const,
      enableLineSelection: Boolean(props.onAddComment),
      onLineSelectionEnd: (range: SelectedLineRange | null) => {
        if (!range) return;
        const side = range.endSide ?? range.side;
        setComposing({ side: side === 'deletions' ? 'LEFT' : 'RIGHT', line: range.end });
      },
    }),
    [themeType, props.split, props.onAddComment],
  );

  return (
    <div className="gd-pierre">
      <PatchDiff<Note>
        patch={patch}
        options={options}
        lineAnnotations={annotations}
        renderAnnotation={(a) =>
          a.metadata.kind === 'thread' ? (
            <CommentThread comments={a.metadata.comments} onDelete={props.onDeleteDraft} />
          ) : (
            <Composer
              onCancel={() => setComposing(null)}
              onSubmit={(body) => {
                const at = composing;
                setComposing(null);
                const line = at && findLine(file, at.side, at.line);
                if (at && line) void props.onAddComment?.(file, line, at.side, body);
              }}
            />
          )
        }
      />
    </div>
  );
}

function HunkBar({ file, props }: { file: DiffFile; props: DiffViewProps }) {
  if (!props.hunkActions?.length && !props.onOpenInHunk) return null;
  return (
    <div className="gd-hunks">
      {file.hunks.map((h, i) => (
        <div key={h.header + i} className="gd-hunk-head" data-hunk>
          <code className="gd-hunk-title">{h.header}</code>
          <span className="gd-hunk-actions">
            {props.onOpenInHunk ? (
              <button className="gd-btn gd-btn-ghost" onClick={() => props.onOpenInHunk?.(file, i)} title="Open this hunk in Hunk">
                Hunk
              </button>
            ) : null}
            {props.hunkActions?.map((a) => (
              <button key={a.label} className={`gd-btn${a.danger ? ' gd-btn-danger' : ''}`} title={a.title} onClick={() => a.run(file, h, i)}>
                {a.label}
              </button>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DiffView(props: DiffViewProps) {
  const { files } = props;
  const root = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState(0);
  const [themeType, setThemeType] = useState<'light' | 'dark'>('light');

  // Follow the kit / app theme the diff sits in (data-theme on an ancestor).
  useLayoutEffect(() => {
    const host = root.current?.closest('[data-theme]');
    const read = () => setThemeType(host?.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    read();
    if (!host) return;
    const watch = new MutationObserver(read);
    watch.observe(host, { attributes: true, attributeFilter: ['data-theme'] });
    return () => watch.disconnect();
  }, []);

  // j / k move between files (Pierre draws lines inside a shadow root).
  const go = useCallback(
    (delta: number) => {
      const list = [...(root.current?.querySelectorAll<HTMLElement>('.gd-file') ?? [])];
      if (!list.length) return;
      const next = Math.max(0, Math.min(list.length - 1, current + delta));
      setCurrent(next);
      list[next]?.scrollIntoView({ block: 'nearest' });
    },
    [current],
  );
  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || e.metaKey || e.ctrlKey) return;
    if (e.key === 'j') go(1);
    else if (e.key === 'k') go(-1);
  };
  const toggle = (path: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(path)) n.delete(path);
      else n.add(path);
      return n;
    });

  if (!files.length) return <div className="surface-empty">No changes.</div>;
  return (
    <div className="gd" ref={root} tabIndex={0} onKeyDown={onKeyDown} data-compact={props.compact ? 'true' : undefined} aria-label="Diff (j/k to move between files)">
      <div className="gd-files">
        {files.map((f) => (
          <a key={f.path} href={`#gd-${encodeURIComponent(f.path)}`} className="gd-chip" onClick={() => setCollapsed((s) => { const n = new Set(s); n.delete(f.path); return n; })}>
            <span>{f.path.split('/').pop()}</span>
            <span className="gd-add">+{f.additions}</span>
            <span className="gd-del">-{f.deletions}</span>
          </a>
        ))}
      </div>
      {files.map((f, i) => {
        const folded = collapsed.has(f.path);
        return (
          <section key={f.path} id={`gd-${encodeURIComponent(f.path)}`} className="gd-file" data-current={i === current || undefined}>
            <header className="gd-file-head">
              <button className="gd-link" aria-label={folded ? 'Expand file' : 'Collapse file'} onClick={() => toggle(f.path)}>
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
              <>
                <HunkBar file={f} props={props} />
                <FileBody file={f} props={props} themeType={themeType} />
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
