/**
 * Surface view: file (wave 4, shared/surfaces.ts). One open file in
 * CodeMirror 6: read-only by default, an Edit toggle (⌘S saves with a
 * baseHash conflict check), live reload when the file changes on disk
 * (meta.hash on the surface), a revealed line range (meta.reveal), and
 * "Attach" to stage the selection as context for the next message.
 */
import { closeBrackets } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { Paperclip, Pencil, Save, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConflictError, openFileSurface, readFileDoc, saveFile, type FileDoc, type LineRange } from '../files/api.ts';
import { attachFileContext } from '../files/attach.ts';
import { editable, editableSlot, highlighting, languageSlot, loadLanguage, replaceDoc, revealField, setReveal, theme } from '../files/editor.ts';
import '../files/files.css';
import type { SurfaceViewProps } from './types.ts';

interface Marker {
  nonce: number;
}
interface Reveal extends Marker {
  startLine: number;
  endLine: number;
}
interface Focus extends Marker {
  line: number;
}

export default function FileSurface({ id, info, variant }: SurfaceViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const docRef = useRef<FileDoc | null>(null);
  const saveRef = useRef<() => void>(() => {});
  const [doc, setDocState] = useState<FileDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState<FileDoc | null>(null);
  const [incoming, setIncoming] = useState<FileDoc | null>(null);
  const [selection, setSelection] = useState<LineRange | null>(null);
  const [shownReveal, setShownReveal] = useState<Reveal | null>(null);
  const applied = useRef({ reveal: 0, focus: 0 });

  /** Make the editor show `next` (keeping cursor and scroll) and treat it as the disk version. */
  const adopt = useCallback((next: FileDoc) => {
    docRef.current = next;
    const view = viewRef.current;
    if (view) replaceDoc(view, next.text);
    setDocState(next);
    setDirty(false);
    setConflict(null);
    setIncoming(null);
  }, []);

  /* ── the editor, created once ── */
  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: '',
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          highlightSelectionMatches(),
          theme,
          highlighting,
          revealField,
          languageSlot.of([]),
          editableSlot.of(editable(false)),
          keymap.of([
            { key: 'Mod-s', preventDefault: true, run: () => (saveRef.current(), true) },
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) setDirty(docRef.current ? u.state.doc.toString() !== docRef.current.text : false);
            if (u.selectionSet || u.docChanged) {
              const sel = u.state.selection.main;
              const next = sel.empty
                ? null
                : { startLine: u.state.doc.lineAt(sel.from).number, endLine: u.state.doc.lineAt(Math.max(sel.from, sel.to - (u.state.doc.lineAt(sel.to).from === sel.to ? 1 : 0))).number };
              setSelection((prev) => (prev?.startLine === next?.startLine && prev?.endLine === next?.endLine ? prev : next));
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  /* ── load; make sure the surface is registered (cards outlive server restarts) ── */
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setDocState(null);
    docRef.current = null;
    applied.current = { reveal: 0, focus: 0 };
    readFileDoc(id)
      .then((d) => !cancelled && adopt(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'could not open file'));
    if (!info) void openFileSurface(id).catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the file changes
  }, [id, adopt]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !doc) return;
    let cancelled = false;
    void loadLanguage(doc.language).then((ext) => !cancelled && view.dispatch({ effects: languageSlot.reconfigure(ext) }));
    return () => {
      cancelled = true;
    };
  }, [doc?.language]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: editableSlot.reconfigure(editable(editing)) });
  }, [editing]);

  /* ── the file changed on disk (watcher → surface meta.hash) ── */
  const diskHash = info?.meta?.['hash'] as string | undefined;
  useEffect(() => {
    const cur = docRef.current;
    if (!diskHash || !cur || diskHash === cur.hash) return;
    let cancelled = false;
    void readFileDoc(id)
      .then((fresh) => {
        if (cancelled || fresh.hash === docRef.current?.hash) return;
        const mine = viewRef.current?.state.doc.toString();
        if (mine === fresh.text || !(docRef.current && mine !== docRef.current.text)) adopt(fresh);
        else setIncoming(fresh);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [diskHash, id, adopt]);

  /* ── reveal / focus requested by the agent or another view ── */
  const reveal = info?.meta?.['reveal'] as Reveal | undefined;
  const focus = info?.meta?.['focus'] as Focus | undefined;
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !doc) return;
    const lineAt = (n: number) => view.state.doc.line(Math.min(Math.max(1, n), view.state.doc.lines));
    if (reveal && reveal.nonce !== applied.current.reveal) {
      applied.current.reveal = reveal.nonce;
      const from = lineAt(reveal.startLine).from;
      const to = lineAt(reveal.endLine).to;
      view.dispatch({ effects: [setReveal.of({ from, to }), EditorView.scrollIntoView(from, { y: 'start', yMargin: 48 })] });
      setShownReveal(reveal);
    } else if (focus && focus.nonce !== applied.current.focus) {
      applied.current.focus = focus.nonce;
      const at = lineAt(focus.line).from;
      view.dispatch({ selection: { anchor: at }, effects: EditorView.scrollIntoView(at, { y: 'center' }) });
    }
  }, [doc, reveal?.nonce, focus?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── save ── */
  const save = useCallback(
    async (baseHash?: string) => {
      const view = viewRef.current;
      const cur = docRef.current;
      if (!view || !cur) return;
      const text = view.state.doc.toString();
      if (text === cur.text && !baseHash) return;
      try {
        const saved = await saveFile(id, text, baseHash ?? cur.hash);
        docRef.current = { ...cur, ...saved, text };
        setDocState(docRef.current);
        setDirty(false);
        setConflict(null);
        setIncoming(null);
      } catch (e) {
        if (e instanceof ConflictError) setConflict(e.current);
        else setError(e instanceof Error ? e.message : 'save failed');
      }
    },
    [id],
  );
  saveRef.current = () => {
    if (editing) void save();
  };

  const clearReveal = () => {
    viewRef.current?.dispatch({ effects: setReveal.of(null) });
    setShownReveal(null);
  };

  const segments = id.split('/');
  const attach = (range?: LineRange) => {
    const text = viewRef.current?.state.doc.toString() ?? doc?.text ?? '';
    attachFileContext(id, text, range);
  };

  return (
    <div className="fv" data-variant={variant} data-file-view={id}>
      <div className="fv-head">
        <nav className="fv-crumbs" aria-label="File path" title={id}>
          {segments.map((s, i) => (
            <span key={i} className={i === segments.length - 1 ? 'fv-crumb fv-crumb--leaf' : 'fv-crumb'}>
              {s}
            </span>
          ))}
          {dirty && <span className="fv-dirty" title="Unsaved changes" aria-label="Unsaved changes" />}
        </nav>
        {shownReveal && (
          <button type="button" className="fv-chip" onClick={clearReveal} title="Clear highlight">
            lines {shownReveal.startLine}–{shownReveal.endLine} <X size={11} aria-hidden />
          </button>
        )}
        {selection && (
          <button type="button" className="fv-btn" onClick={() => attach(selection)} title="Attach selected lines to the next message">
            <Paperclip size={12} aria-hidden /> Attach {selection.startLine === selection.endLine ? `L${selection.startLine}` : `L${selection.startLine}–${selection.endLine}`}
          </button>
        )}
        {!selection && doc && (
          <button type="button" className="fv-btn" onClick={() => attach()} title="Attach the whole file to the next message">
            <Paperclip size={12} aria-hidden /> Attach
          </button>
        )}
        {dirty && (
          <button type="button" className="fv-btn" onClick={() => doc && adopt(doc)} title="Discard unsaved changes">
            Revert
          </button>
        )}
        {editing && (
          <button type="button" className="fv-btn fv-btn--primary" disabled={!dirty} onClick={() => void save()} title="Save (⌘S)">
            <Save size={12} aria-hidden /> Save
          </button>
        )}
        <button
          type="button"
          className="fv-btn"
          aria-pressed={editing}
          disabled={!doc || (editing && dirty)}
          onClick={() => setEditing((v) => !v)}
          title={editing && dirty ? 'Save or revert first' : editing ? 'Back to read-only' : 'Edit this file'}
        >
          <Pencil size={12} aria-hidden /> {editing ? 'Editing' : 'Edit'}
        </button>
      </div>
      {doc && (
        <div className="fv-meta">
          {doc.language} · {doc.lines} lines{info?.status === 'error' ? ' · missing on disk' : ''}
        </div>
      )}
      {conflict && (
        <div className="fv-banner fv-banner--warn" role="alert">
          <span>This file changed on disk since you opened it.</span>
          <button type="button" className="fv-btn" onClick={() => void save(conflict.hash)}>
            Overwrite with mine
          </button>
          <button type="button" className="fv-btn" onClick={() => adopt(conflict)}>
            Load theirs
          </button>
        </div>
      )}
      {incoming && !conflict && (
        <div className="fv-banner" role="status">
          <span>Changed on disk while you were editing.</span>
          <button type="button" className="fv-btn" onClick={() => adopt(incoming)}>
            Reload (discard mine)
          </button>
        </div>
      )}
      {error && <div className="fv-banner fv-banner--warn">{error}</div>}
      <div ref={host} className="fv-editor" />
    </div>
  );
}
