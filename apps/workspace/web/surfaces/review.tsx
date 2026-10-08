/** Surface view: PR review (AICL-39). Header, checks, files with existing + draft comments, Submit review → approval. */
import { useState } from 'react';
import type { HunkOpenResult, ReviewData, ReviewEvent } from '../../shared/git.ts';
import { DiffView, type InlineComment } from './diff/DiffView.tsx';
import { call, useRemote } from './diff/api.ts';
import type { SurfaceViewProps } from './types.ts';

export default function ReviewSurface({ id, info, variant }: SurfaceViewProps) {
  const base = `/api/surfaces/review/${encodeURIComponent(id)}`;
  const { data, error, reload } = useRemote<ReviewData>(info ? base : null, info?.updatedAt);
  const [split, setSplit] = useState(false);
  const [event, setEvent] = useState<ReviewEvent>('COMMENT');
  const [body, setBody] = useState('');
  const [note, setNote] = useState<HunkOpenResult | string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (!info) return <div className="surface-empty">This review is closed.</div>;
  if (error) return <div className="surface-empty">{error}</div>;
  if (!data) return <div className="surface-empty">Loading pull request…</div>;
  const pr = data.pr;

  const comments: InlineComment[] = [
    ...data.comments,
    ...data.drafts.map((d) => ({ ...d, draft: true })),
  ];

  const hunk = async (action: 'open' | 'send' | 'import', extra: object = {}) => {
    try {
      const r = await call<HunkOpenResult & { message?: string }>('POST', `${base}/hunk/${action}`, extra);
      setNote(r);
      if (action === 'import') void reload();
    } catch (cause) {
      setNote((cause as Error).message);
    }
  };

  const submit = async () => {
    setBusy('Waiting for your approval in chat…');
    try {
      const r = await call<{ submitted: boolean; note?: string; url?: string }>('POST', `${base}/submit`, { event, body });
      setNote(r.submitted ? `Review submitted${r.url ? `: ${r.url}` : ''}` : `Not submitted${r.note ? `: ${r.note}` : ' (declined)'}`);
      if (r.submitted) setBody('');
      void reload();
    } catch (cause) {
      setNote((cause as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="gd-pr-head">
        <h3>
          {pr ? (
            <a href={pr.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
              #{pr.number} {pr.title}
            </a>
          ) : (
            info.title
          )}
        </h3>
        {pr ? (
          <div>
            <code>{pr.headRefName}</code> → <code>{pr.baseRefName}</code> · {pr.state.toLowerCase()}
            {pr.isDraft ? ' · draft' : ''}
            {pr.author ? ` · ${pr.author}` : ''} · {data.stats.files} files <span className="gd-add">+{data.stats.additions}</span> <span className="gd-del">-{data.stats.deletions}</span>
          </div>
        ) : null}
        {data.checks.length ? (
          <div style={{ marginTop: 4 }}>
            {data.checks.map((c) => (
              <span key={c.name} className="gd-check" title={c.state}>
                <i data-b={c.bucket ?? c.state} />
                {c.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="gd-toolbar">
        <button className="gd-btn" aria-pressed={!split} onClick={() => setSplit(false)}>
          Unified
        </button>
        <button className="gd-btn" aria-pressed={split} onClick={() => setSplit(true)}>
          Side by side
        </button>
        <span className="gd-spacer" />
        <button className="gd-btn" onClick={() => void hunk('open')}>
          Open in Hunk
        </button>
        <button className="gd-btn" onClick={() => void hunk('send')} disabled={!data.drafts.length}>
          Send notes to Hunk
        </button>
        <button className="gd-btn" onClick={() => void hunk('import')}>
          Import Hunk comments
        </button>
      </div>
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
        comments={comments}
        onOpenInHunk={(f, i) => void hunk('open', { path: f.path, line: f.hunks[i]?.newStart })}
        onAddComment={async (file, line, side, text) => {
          await call('POST', `${base}/drafts`, { path: file.path, line: (side === 'LEFT' ? line.oldLine : line.newLine) ?? 0, side, body: text });
          void reload();
        }}
        onDeleteDraft={(did) => void call('DELETE', `${base}/drafts/${did}`).then(reload)}
      />
      <div className="gd-submit">
        <textarea aria-label="Review summary" placeholder="Review summary (optional)" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="gd-row">
          <select aria-label="Review type" value={event} onChange={(e) => setEvent(e.target.value as ReviewEvent)}>
            <option value="COMMENT">Comment</option>
            <option value="APPROVE">Approve</option>
            <option value="REQUEST_CHANGES">Request changes</option>
          </select>
          <button className="gd-btn" disabled={!!busy} onClick={() => void submit()}>
            Submit review ({data.drafts.length} comment{data.drafts.length === 1 ? '' : 's'})…
          </button>
          {busy ? <span>{busy}</span> : <span style={{ opacity: 0.7 }}>Asks for your approval before anything is sent.</span>}
        </div>
      </div>
    </>
  );
}
