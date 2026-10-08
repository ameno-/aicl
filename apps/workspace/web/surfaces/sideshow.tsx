/**
 * Surface view: Sideshow card (AICL-42). The last published preview in a
 * sandboxed srcdoc iframe (opaque origin: the card's markup can never touch
 * this app), the board comments, Republish and Open board.
 */
import { useState } from 'react';
import { call, useRemote } from './diff/api.ts';
import type { SurfaceViewProps } from './types.ts';
import './sideshow.css';

interface CardView {
  id: string;
  title: string;
  url: string;
  board: string;
  version: number;
  html: string;
  pending: number;
  updatedAt: number;
  comments: Array<{ id: string; seq: number; author: string; text: string; at: string }>;
}

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const doc = (html: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="color-scheme" content="light dark"><body style="margin:10px;font:13px system-ui,sans-serif">${html}`;

export default function SideshowSurface({ id, info, variant }: SurfaceViewProps) {
  const base = `/api/surfaces/sideshow/${encodeURIComponent(id)}`;
  const { data, error, set } = useRemote<CardView>(info ? base : null, info?.updatedAt);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!info) return <div className="surface-empty">This Sideshow card is closed.</div>;
  if (error) return <div className="surface-empty">{error}</div>;
  if (!data) return <div className="surface-empty">Loading card…</div>;

  const republish = async () => {
    setBusy(true);
    setNote('Waiting for your approval in chat if this session has not published yet…');
    try {
      set(await call<CardView>('POST', `${base}/republish`));
      setNote('Republished.');
    } catch (cause) {
      setNote((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const refresh = async () => {
    try {
      set(await call<CardView>('POST', `${base}/refresh`));
    } catch (cause) {
      setNote((cause as Error).message);
    }
  };

  const comments = (
    <div className="ss-comments">
      <div className="ss-subhead">
        Comments ({data.comments.length}){' '}
        <button className="ss-link" onClick={() => void refresh()}>
          refresh
        </button>
      </div>
      {data.comments.length === 0 ? <div className="ss-muted">No comments yet. Comment on the card in the board and it shows up here.</div> : null}
      {data.comments.map((c) => (
        <div key={c.id} className="ss-comment">
          <div className="ss-muted">
            <b>{c.author}</b> · {when(c.at)}
          </div>
          <div className="ss-text">{c.text}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="ss" data-variant={variant}>
      <div className="ss-head">
        <b className="ss-title" title={data.title}>
          {data.title}
        </b>
        <span className="ss-muted">
          v{data.version} · {data.board}
        </span>
        <span className="ss-spacer" />
        <button className="gd-btn" disabled={busy} onClick={() => void republish()}>
          Republish
        </button>
        <a className="gd-btn" href={data.url} target="_blank" rel="noreferrer">
          Open board
        </a>
      </div>
      {note ? <div className="ss-note" role="status">{note}</div> : null}
      <div className="ss-body">
        <iframe className="ss-preview" title={data.title} sandbox="allow-scripts" srcDoc={doc(data.html)} />
        {variant === 'card' ? (
          <div className="ss-foot ss-muted">
            {data.comments.length} comment{data.comments.length === 1 ? '' : 's'}
            {data.pending ? ` · ${data.pending} new` : ''}
            {data.comments.length ? ` · latest: ${data.comments[data.comments.length - 1]!.text.slice(0, 60)}` : ''}
          </div>
        ) : (
          comments
        )}
      </div>
    </div>
  );
}
