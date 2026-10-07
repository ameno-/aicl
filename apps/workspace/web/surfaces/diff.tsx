/** Surface view: diff (AICL-39). Working / staged / ref / "Changes in this turn", with per-hunk staging. */
import { useState } from 'react';
import type { DiffData, HunkOpenResult } from '../../shared/git.ts';
import { DiffView, type HunkAction, type InlineComment } from './diff/DiffView.tsx';
import { call, useRemote } from './diff/api.ts';
import type { SurfaceViewProps } from './types.ts';

export default function DiffSurface({ id, info, variant }: SurfaceViewProps) {
  const [view, setView] = useState<'working' | 'staged'>('working');
  const [split, setSplit] = useState(false);
  const [drafts, setDrafts] = useState<InlineComment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<HunkOpenResult | string | null>(null);
  const base = `/api/surfaces/diff/${encodeURIComponent(id)}`;
  const { data, error, reload, set } = useRemote<DiffData>(info ? `${base}?view=${view}` : null, info?.updatedAt);

  if (!info) return <div className="surface-empty">This diff is closed.</div>;
  if (error) return <div className="surface-empty">{error}</div>;
  if (!data) return <div className="surface-empty">Loading diff…</div>;
  if (!data.repo) return <div className="surface-empty">Not a git repository.</div>;

  const staged = data.spec.mode === 'staged' || (data.spec.mode === 'working' && view === 'staged');
  const act = async (action: 'stage' | 'unstage' | 'discard', path: string, hunkHeader?: string) => {
    setBusy(action === 'discard' ? 'Waiting for your approval in chat…' : `${action}…`);
    try {
      const next = await call<DiffData & { declined?: string }>('POST', `${base}/${action}`, { path, hunkHeader, view });
      set(next);
      setNote(next.declined ? `Declined: ${next.declined}` : data.spec.mode === 'turn' && action === 'stage' ? `Staged ${path}` : null);
    } catch (cause) {
      setNote((cause as Error).message);
      void reload();
    } finally {
      setBusy(null);
    }
  };
  const hunkActions: HunkAction[] = !data.canStage
    ? []
    : data.spec.mode === 'turn'
      ? [{ label: 'Stage', title: 'Stage this change', run: (f, h) => void act('stage', f.path, h.header) }]
      : staged
      ? [{ label: 'Unstage', run: (f, h) => void act('unstage', f.path, h.header) }]
      : [
          { label: 'Stage', run: (f, h) => void act('stage', f.path, h.header) },
          { label: 'Discard', danger: true, title: 'Throw this change away (asks first)', run: (f, h) => void act('discard', f.path, h.header) },
        ];

  const openInHunk = async (file?: string, hunkIndex?: number) => {
    try {
      setNote(await call<HunkOpenResult>('POST', `${base}/hunk`, { path: file, hunkIndex }));
    } catch (cause) {
      setNote((cause as Error).message);
    }
  };

  return (
    <>
      <div className="gd-toolbar">
        <strong>{data.spec.label}</strong>
        <span>
          {data.stats.files} file{data.stats.files === 1 ? '' : 's'} <span className="gd-add">+{data.stats.additions}</span> <span className="gd-del">-{data.stats.deletions}</span>
        </span>
        <span className="gd-spacer" />
        {data.spec.mode === 'working' || data.spec.mode === 'staged' ? (
          <>
            <button className="gd-btn" aria-pressed={view === 'working'} onClick={() => setView('working')}>
              Unstaged
            </button>
            <button className="gd-btn" aria-pressed={view === 'staged'} onClick={() => setView('staged')}>
              Staged
            </button>
          </>
        ) : null}
        <button className="gd-btn" aria-pressed={!split} onClick={() => setSplit(false)}>
          Unified
        </button>
        <button className="gd-btn" aria-pressed={split} onClick={() => setSplit(true)}>
          Side by side
        </button>
        <button className="gd-btn" onClick={() => void openInHunk(data.files[0]?.path, 0)}>
          Open in Hunk
        </button>
      </div>
      {busy ? <div className="gd-note">{busy}</div> : null}
      {note ? (
        <div className="gd-note" role="status">
          {typeof note === 'string' ? (
            note
          ) : (
            <>
              <span>{note.message}</span>
              {note.command ? <code>{note.command}</code> : null}
            </>
          )}
          <span className="gd-spacer" />
          <button className="gd-link" onClick={() => setNote(null)}>
            dismiss
          </button>
        </div>
      ) : null}
      {data.error ? <div className="gd-note">{data.error}</div> : null}
      <DiffView
        files={data.files}
        split={split && variant !== 'card'}
        compact={variant === 'card'}
        comments={drafts}
        hunkActions={hunkActions}
        onOpenInHunk={(f, i) => void openInHunk(f.path, i)}
        onAddComment={(file, line, side, body) =>
          setDrafts((d) => [...d, { id: crypto.randomUUID(), path: file.path, line: (side === 'LEFT' ? line.oldLine : line.newLine) ?? 0, side, body, author: 'you', draft: true }])
        }
        onDeleteDraft={(cid) => setDrafts((d) => d.filter((c) => c.id !== cid))}
      />
    </>
  );
}
