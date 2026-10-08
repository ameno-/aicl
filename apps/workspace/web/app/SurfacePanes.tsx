/**
 * Work-panel panes backed by live surfaces (shared/surfaces.ts): terminals,
 * the shared browser, and diffs. The same objects show as canvas cards; the
 * "Pin to canvas" button puts the one on screen there too.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { GitCompare, Globe, Pin, Plus } from 'lucide-react';
import { MAIN_SESSION_ID } from '../../shared/runtime.ts';
import type { SurfaceInfo } from '../../shared/surfaces.ts';
import { SurfaceView, useSurfaces } from '../surfaces/index.tsx';
import { useTerminal } from '../agentic/liveData.ts';
import { getCanvasEditor } from '../canvasContext.ts';
import { useSessions } from '../sessionsApi.ts';
import { pinSurface } from '../workspace/frames.ts';
import { TerminalPane } from './WorkPanel.tsx';

const post = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json() as Promise<{ surface?: SurfaceInfo }>);

/** Newest first, this session's (or the user's) surfaces before others. */
function pick(list: SurfaceInfo[], sessionId: string): SurfaceInfo[] {
  return [...list].sort((a, b) => Number(b.sessionId === sessionId) - Number(a.sessionId === sessionId) || b.updatedAt - a.updatedAt);
}

function Switcher({ items, value, onChange, extra }: { items: Array<{ id: string; label: string }>; value: string; onChange: (id: string) => void; extra?: ReactNode }) {
  return (
    <div className="wp-switch" role="tablist" aria-label="Choose">
      {items.map((it) => (
        <button key={it.id} type="button" role="tab" aria-selected={it.id === value} className="wp-switch-item" data-active={it.id === value || undefined} onClick={() => onChange(it.id)}>
          {it.label}
        </button>
      ))}
      {extra}
    </div>
  );
}

function PinButton({ info }: { info: SurfaceInfo }) {
  const sessions = useSessions();
  // The card joins the work frame of the session that owns this work (its root, for sub-agents).
  const pin = () => {
    const editor = getCanvasEditor();
    if (!editor) return;
    const own = sessions.find((s) => s.id === info.sessionId);
    const owner = sessions.find((s) => s.id === (own?.rootId ?? own?.id)) ?? own;
    pinSurface(editor, { id: owner?.id ?? info.sessionId ?? MAIN_SESSION_ID, title: owner?.title ?? 'Session' }, { kind: info.kind, id: info.id, title: info.title });
  };
  return (
    <button type="button" className="wp-switch-item" title="Pin to canvas" aria-label="Pin to canvas" onClick={pin}>
      <Pin size={13} aria-hidden="true" />
    </button>
  );
}

/** "Agent commands" (the bash stream) plus every live terminal; a + opens a new one. */
export function TerminalsPane({ sessionId }: { sessionId: string }) {
  const terminals = pick(useSurfaces('terminal'), sessionId);
  const bash = useTerminal(sessionId);
  const [choice, setChoice] = useState<string | null>(null);
  // Default to this session's own activity: its bash commands if it ran any, else its terminal. Never another session's.
  const fallback = bash ? undefined : terminals.find((t) => t.sessionId === sessionId);
  const current = choice === 'bash' ? null : (terminals.find((t) => t.id === choice) ?? (choice === null ? fallback : undefined));
  const open = async () => {
    const { surface } = await post('/api/surfaces/terminal', {});
    if (surface) setChoice(surface.id);
  };
  return (
    <div className="wp-surface-pane">
      <Switcher
        items={[{ id: 'bash', label: 'Agent commands' }, ...terminals.map((t) => ({ id: t.id, label: t.title }))]}
        value={current?.id ?? 'bash'}
        onChange={setChoice}
        extra={
          <>
            <button type="button" className="wp-switch-item" aria-label="New terminal" title="New terminal" onClick={() => void open()}>
              <Plus size={13} aria-hidden="true" />
            </button>
            {current ? <PinButton info={current} /> : null}
          </>
        }
      />
      <div className="wp-surface-body">{current ? <SurfaceView kind="terminal" id={current.id} variant="panel" /> : <TerminalPane sessionId={sessionId} />}</div>
    </div>
  );
}

/** The shared browser: the newest page, or a URL field to open one. */
export function BrowserPane({ sessionId }: { sessionId: string }) {
  const pages = pick(useSurfaces('browser'), sessionId);
  const [choice, setChoice] = useState<string | null>(null);
  const [url, setUrl] = useState('http://localhost:');
  const current = pages.find((p) => p.id === choice) ?? pages[0];
  const open = async (e: FormEvent) => {
    e.preventDefault();
    const { surface } = await post('/api/surfaces/browser', { url });
    if (surface) setChoice(surface.id);
  };
  if (!current) {
    return (
      <div className="wp-empty">
        <Globe size={22} aria-hidden="true" />
        <p className="wp-empty-title">No page open</p>
        <p className="wp-empty-hint">The agent opens pages it is checking here. You can open one too.</p>
        <form onSubmit={(e) => void open(e)} className="wp-url-form">
          <input aria-label="URL" value={url} onChange={(e) => setUrl(e.target.value)} className="wp-url" />
          <button type="submit" className="wp-switch-item">Open</button>
        </form>
      </div>
    );
  }
  return (
    <div className="wp-surface-pane">
      {pages.length > 1 ? (
        <Switcher items={pages.map((p) => ({ id: p.id, label: p.summary ?? p.title }))} value={current.id} onChange={setChoice} extra={<PinButton info={current} />} />
      ) : (
        <Switcher items={[]} value="" onChange={() => undefined} extra={<PinButton info={current} />} />
      )}
      <div className="wp-surface-body">
        <SurfaceView kind="browser" id={current.id} variant="panel" />
      </div>
    </div>
  );
}

/**
 * Changes, never empty: this session's diffs when it has some; otherwise the
 * workspace's working changes, or (clean tree) the latest commit; outside a
 * git repo, GitHub: review any pull request by URL or owner/repo#n — which
 * also works when the assistant has no local checkout (MCP, remote).
 */
export function ChangesPane({ sessionId }: { sessionId: string }) {
  const diffs = pick(useSurfaces('diff'), sessionId);
  const reviews = pick(useSurfaces('review'), sessionId);
  const [choice, setChoice] = useState<string | null>(null);
  const [repo, setRepo] = useState<{ repo: boolean; dirty: boolean; branch?: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const tried = useRef(false);

  // Learn the repo state once, then open a sensible default if nothing is open.
  useEffect(() => {
    let live = true;
    void fetch('/api/git/status')
      .then((r) => r.json() as Promise<{ repo: boolean; branch?: string; staged?: unknown[]; unstaged?: unknown[]; untracked?: unknown[] }>)
      .then((st) => live && setRepo({ repo: st.repo, dirty: Boolean(st.staged?.length || st.unstaged?.length || st.untracked?.length), ...(st.branch ? { branch: st.branch } : {}) }))
      .catch(() => live && setRepo({ repo: false, dirty: false }));
    return () => {
      live = false;
    };
  }, []);
  const open = async (target: string, label: string) => {
    setOpening(label);
    setFailed(null);
    try {
      const res = await fetch('/api/surfaces/diff', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target, sessionId }) });
      const body = (await res.json()) as { surface?: SurfaceInfo; message?: string; error?: string };
      if (!res.ok || !body.surface) throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
      setChoice(body.surface.id);
    } catch (cause) {
      setFailed(`${label}: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setOpening(null);
    }
  };
  useEffect(() => {
    if (!repo?.repo || diffs.length || tried.current) return;
    tried.current = true;
    void (repo.dirty ? open('working', 'Working changes') : open('HEAD~1..HEAD', 'Latest commit'));
  }, [repo, diffs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = diffs.find((d) => d.id === choice) ?? diffs[0];
  const review = reviews.find((r) => r.id === choice);

  if (review) {
    return (
      <div className="wp-surface-pane">
        <Switcher items={[...diffs.slice(0, 4), ...reviews.slice(0, 3)].map((d) => ({ id: d.id, label: d.title }))} value={review.id} onChange={setChoice} extra={<PinButton info={review} />} />
        <div className="wp-surface-body">
          <SurfaceView kind="review" id={review.id} variant="panel" />
        </div>
      </div>
    );
  }
  if (repo && !repo.repo && !current) return <GitHubStart sessionId={sessionId} onOpened={setChoice} />;
  if (!current) {
    return (
      <div className="wp-empty">
        <GitCompare size={22} aria-hidden="true" />
        <p className="wp-empty-title">{opening ? `Loading ${opening.toLowerCase()}…` : failed ? 'Nothing to show yet' : 'Reading the repository…'}</p>
        {failed ? <p className="wp-empty-hint">{failed}</p> : null}
      </div>
    );
  }
  return (
    <div className="wp-surface-pane">
      <Switcher
        items={[...diffs.slice(0, 6), ...reviews.slice(0, 3)].map((d) => ({ id: d.id, label: d.title }))}
        value={current.id}
        onChange={setChoice}
        extra={
          <>
            {repo?.repo && !diffs.some((d) => d.id === 'working') ? (
              <button type="button" className="wp-switch-item" onClick={() => void open('working', 'Working changes')}>
                + Working tree
              </button>
            ) : null}
            {repo?.repo && !diffs.some((d) => d.title === 'Latest commit' || d.id.includes('HEAD~1')) ? (
              <button type="button" className="wp-switch-item" onClick={() => void open('HEAD~1..HEAD', 'Latest commit')}>
                + Last commit
              </button>
            ) : null}
            <PinButton info={current} />
          </>
        }
      />
      <div className="wp-surface-body">
        <SurfaceView kind="diff" id={current.id} variant="panel" />
      </div>
    </div>
  );
}

/** Outside a git repo: GitHub is the source — review a pull request by URL or owner/repo#n. */
function GitHubStart({ sessionId, onOpened }: { sessionId: string; onOpened: (id: string) => void }) {
  const [pr, setPr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pr.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/surfaces/review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pr: pr.trim(), sessionId }) });
      const body = (await res.json()) as { surface?: SurfaceInfo; message?: string; error?: string };
      if (!res.ok || !body.surface) throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
      onOpened(body.surface.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="wp-empty wp-github">
      <GitCompare size={22} aria-hidden="true" />
      <p className="wp-empty-title">This workspace isn’t a git repository</p>
      <p className="wp-empty-hint">Review changes from GitHub instead: paste a pull request URL or owner/repo#number.</p>
      <form onSubmit={(e) => void submit(e)} className="wp-url-form">
        <input aria-label="Pull request" placeholder="github.com/owner/repo/pull/12" value={pr} onChange={(e) => setPr(e.target.value)} className="wp-url" />
        <button type="submit" className="wp-switch-item" disabled={busy}>
          {busy ? 'Opening…' : 'Review'}
        </button>
      </form>
      {error ? <p className="wp-empty-hint wp-error">{error}</p> : null}
    </div>
  );
}
