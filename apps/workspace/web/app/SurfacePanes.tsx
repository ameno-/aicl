/**
 * Work-panel panes backed by live surfaces (shared/surfaces.ts): terminals,
 * the shared browser, and diffs. The same objects show as canvas cards; the
 * "Pin to canvas" button puts the one on screen there too.
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { GitCompare, Globe, Pin, Plus } from 'lucide-react';
import type { SurfaceInfo, SurfaceKind } from '../../shared/surfaces.ts';
import { SurfaceView, useSurfaces } from '../surfaces/index.tsx';
import { TerminalPane } from './WorkPanel.tsx';

const post = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json() as Promise<{ surface?: SurfaceInfo }>);

/** Puts a surface on the canvas as a card (component "surface"), beside what is there. */
function pinToCanvas(kind: SurfaceKind, id: string, title: string): void {
  const editor = (window as unknown as { __aiclEditor?: { createShape: (s: unknown) => void; getViewportPageBounds: () => { x: number; y: number; w: number } } }).__aiclEditor;
  if (!editor) return;
  const view = editor.getViewportPageBounds();
  editor.createShape({ type: 'aicl-component', x: view.x + view.w / 2 - 320, y: view.y + 80, props: { w: 640, h: 420, component: 'surface', title, props: { kind, id } } });
}

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
  return (
    <button type="button" className="wp-switch-item" title="Pin to canvas" aria-label="Pin to canvas" onClick={() => pinToCanvas(info.kind, info.id, info.title)}>
      <Pin size={13} aria-hidden="true" />
    </button>
  );
}

/** "Agent commands" (the bash stream) plus every live terminal; a + opens a new one. */
export function TerminalsPane({ sessionId }: { sessionId: string }) {
  const terminals = pick(useSurfaces('terminal'), sessionId);
  const [choice, setChoice] = useState<string | null>(null);
  const current = choice === 'bash' ? null : (terminals.find((t) => t.id === choice) ?? (choice === null ? terminals[0] : undefined));
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

/** Diffs: this session's newest (usually "Changes in this turn"), or the working tree on request. */
export function ChangesPane({ sessionId }: { sessionId: string }) {
  const diffs = pick(useSurfaces('diff'), sessionId);
  const [choice, setChoice] = useState<string | null>(null);
  const current = diffs.find((d) => d.id === choice) ?? diffs[0];
  const working = async () => {
    const { surface } = await post('/api/surfaces/diff', { target: 'working', sessionId });
    if (surface) setChoice(surface.id);
  };
  const workingButton = (
    <button type="button" className="wp-switch-item" onClick={() => void working()}>
      Working tree
    </button>
  );
  if (!current) {
    return (
      <div className="wp-empty">
        <GitCompare size={22} aria-hidden="true" />
        <p className="wp-empty-title">No changes to review yet</p>
        <p className="wp-empty-hint">Each turn’s edits show up here as a diff you can stage, comment on, or send to Hunk.</p>
        {workingButton}
      </div>
    );
  }
  return (
    <div className="wp-surface-pane">
      <Switcher
        items={diffs.slice(0, 6).map((d) => ({ id: d.id, label: d.title }))}
        value={current.id}
        onChange={setChoice}
        extra={
          <>
            {workingButton}
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
