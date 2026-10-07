/**
 * ⌘P-style quick open. `openFilePicker()` shows it; the integrator mounts
 * <FilePickerHost/> once and binds the shortcut. Search is fuzzy (type
 * "app" or "app:10-20" for a line range); with an empty query the tree is
 * shown. Click preview lines (shift-click to extend) to choose a range.
 *
 * Actions (Enter / ⌘Enter / ⇧Enter):
 *   Open              registers the file surface and tells onFileOpened() listeners
 *   Attach to message stages the file or range as context for the next message
 *   Place on canvas   adds a `surface` card {kind:'file', id:path}
 */
import { Paperclip, LayoutGrid, FileText } from 'lucide-react';
import { createShapeId, type Editor } from 'tldraw';
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { COMPONENT_SHAPE_TYPE, COMPONENTS } from '../../shared/components.ts';
import { formatRange, openFileSurface, readFileDoc, searchFiles, splitRangeSuffix, type FileDoc, type LineRange } from './api.ts';
import { attachFileContext } from './attach.ts';
import { Tree } from './Tree.tsx';
import './files.css';

/* ── open/close store ── */

let isOpen = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => {
  isOpen = v;
  for (const l of [...listeners]) l();
};
export const openFilePicker = (): void => set(true);
export const closeFilePicker = (): void => set(false);

const openedListeners = new Set<(path: string, range?: LineRange) => void>();
/** Called after the picker's "Open": the app shows the file wherever it likes (work panel, full view). */
export function onFileOpened(handler: (path: string, range?: LineRange) => void): () => void {
  openedListeners.add(handler);
  return () => openedListeners.delete(handler);
}

/* ── actions (also usable without the picker UI) ── */

export async function openFile(path: string, range?: LineRange): Promise<void> {
  await openFileSurface(path, range?.startLine);
  for (const l of [...openedListeners]) l(path, range);
}

export async function placeFileOnCanvas(path: string): Promise<boolean> {
  const editor = (window as unknown as { __aiclEditor?: Editor }).__aiclEditor;
  if (!editor) return false;
  await openFileSurface(path);
  const size = COMPONENTS.find((c) => c.name === 'surface')?.defaultSize ?? { w: 640, h: 420 };
  const center = editor.getViewportPageBounds().center;
  const id = createShapeId();
  editor.createShape({
    id,
    type: COMPONENT_SHAPE_TYPE,
    x: center.x - size.w / 2,
    y: center.y - size.h / 2,
    props: { w: size.w, h: size.h, component: 'surface', title: path.split('/').pop() ?? path, props: { kind: 'file', id: path } },
  });
  editor.select(id);
  return true;
}

export async function attachFile(path: string, range?: LineRange): Promise<void> {
  const doc = await readFileDoc(path);
  attachFileContext(path, doc.text, range);
}

/* ── UI ── */

export function FilePickerHost() {
  const open = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => isOpen,
    () => false,
  );
  return open ? <Picker onClose={closeFilePicker} /> : null;
}

function Picker({ onClose }: { onClose(): void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null); // chosen from the tree
  const [doc, setDoc] = useState<FileDoc | null>(null);
  const [range, setRange] = useState<LineRange | null>(null);
  const [status, setStatus] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const { name, range: typedRange } = splitRangeSuffix(query.trim());

  useEffect(() => input.current?.focus(), []);

  useEffect(() => {
    if (!name) return setResults([]);
    let stale = false;
    const t = setTimeout(() => void searchFiles(name).then((p) => !stale && (setResults(p), setIndex(0))).catch(() => {}), 60);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [name]);

  const current = name ? results[index] : picked;

  useEffect(() => {
    setDoc(null);
    setRange(null);
    if (!current) return;
    let stale = false;
    void readFileDoc(current)
      .then((d) => !stale && setDoc(d))
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [current]);

  const effectiveRange = range ?? typedRange;

  const run = async (action: 'open' | 'attach' | 'canvas') => {
    if (!current) return;
    try {
      if (action === 'open') await openFile(current, effectiveRange);
      else if (action === 'attach') await attachFile(current, effectiveRange);
      else if (!(await placeFileOnCanvas(current))) return setStatus('No canvas is open.');
      onClose();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'failed');
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return onClose();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!name) return;
      e.preventDefault();
      setIndex((i) => Math.max(0, Math.min(results.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      void run(e.shiftKey ? 'canvas' : e.metaKey || e.ctrlKey ? 'attach' : 'open');
    }
  };

  const pickLine = (n: number, extend: boolean) =>
    setRange((r) => (extend && r ? { startLine: Math.min(r.startLine, n), endLine: Math.max(r.endLine, n) } : { startLine: n, endLine: n }));

  return (
    <div className="fp-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fp" role="dialog" aria-label="Open file" onKeyDown={onKeyDown}>
        <input
          ref={input}
          className="fp-input"
          placeholder="Search files…  (app, app:10-20)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search files"
        />
        <div className="fp-body">
          <div className="fp-list" role="listbox">
            {name ? (
              results.length ? (
                results.map((p, i) => (
                  <div key={p} role="option" aria-selected={i === index} className="fp-item" onMouseEnter={() => setIndex(i)} onClick={() => void run('open')}>
                    <FileText size={12} aria-hidden />
                    {p.split('/').pop()}
                    <small>{p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : ''}</small>
                  </div>
                ))
              ) : (
                <div className="fp-empty">No matching files.</div>
              )
            ) : (
              <Tree onOpen={setPicked} />
            )}
          </div>
          <div className="fp-preview" aria-label="Preview">
            {doc ? (
              doc.text.split('\n').slice(0, 400).map((l, i) => {
                const n = i + 1;
                const on = effectiveRange && n >= effectiveRange.startLine && n <= effectiveRange.endLine;
                return (
                  <div key={n} className="fp-line" data-picked={on ? 'true' : undefined} onClick={(e) => pickLine(n, e.shiftKey)}>
                    <i>{n}</i>
                    {l}
                  </div>
                );
              })
            ) : (
              <div className="fp-empty">{current ? 'Loading…' : 'Pick a file to preview it.'}</div>
            )}
          </div>
        </div>
        <div className="fp-actions">
          <button type="button" className="fv-btn fv-btn--primary" disabled={!current} onClick={() => void run('open')}>
            <FileText size={12} aria-hidden /> Open
          </button>
          <button type="button" className="fv-btn" disabled={!current} onClick={() => void run('attach')}>
            <Paperclip size={12} aria-hidden /> Attach to message{current && effectiveRange ? ` (${formatRange('', effectiveRange).slice(1)})` : ''}
          </button>
          <button type="button" className="fv-btn" disabled={!current} onClick={() => void run('canvas')}>
            <LayoutGrid size={12} aria-hidden /> Place on canvas
          </button>
          <span className="fp-hint">{status || '↵ open · ⌘↵ attach · ⇧↵ canvas'}</span>
        </div>
      </div>
    </div>
  );
}
