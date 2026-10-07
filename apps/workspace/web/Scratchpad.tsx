import { useEffect, useState } from 'react';
import {
  DefaultStylePanel,
  getSnapshot,
  loadSnapshot,
  Tldraw,
  useEditor,
  useValue,
  type Editor,
  type TLUiStylePanelProps,
} from 'tldraw';
import 'tldraw/tldraw.css';
import { execute } from './executor.ts';
import { onServerEvent } from './events.ts';
import { shapeUtils } from './ComponentShape.tsx';
import { InsertMenu } from './InsertMenu.tsx';
import { registerCanvasEditor } from './chatStore.ts';
import { startGraphTracker } from './graph.ts';

const SAVE_DEBOUNCE_MS = 400;

/**
 * The style panel appears only while something is selected (as a design
 * tool's inspector does), so it never sits on top of a screen's toolbar.
 */
function SelectionStylePanel(props: TLUiStylePanelProps) {
  const editor = useEditor();
  const hasSelection = useValue('has selection', () => editor.getSelectedShapeIds().length > 0, [editor]);
  return hasSelection ? <DefaultStylePanel {...props} /> : null;
}

const uiComponents = { StylePanel: SelectionStylePanel };

/**
 * The shared canvas. Loads the workspace snapshot, saves every document
 * change back to disk, and executes the agent's ops as they arrive.
 */
export function Scratchpad() {
  const [editor, setEditor] = useState<Editor | null>(null);
  useEffect(() => () => registerCanvasEditor(null), []);
  const [loaded, setLoaded] = useState(false);

  // Load once, then start saving. Saving before the load lands would write an
  // empty canvas over the user's work.
  useEffect(() => {
    if (!editor) return;
    let cancelled = false;
    void fetch('/api/scratch')
      .then((r) => r.json() as Promise<{ snapshot: unknown }>)
      .then(({ snapshot }) => {
        if (cancelled) return;
        if (snapshot) loadSnapshot(editor.store, snapshot as Parameters<typeof loadSnapshot>[1]);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [editor]);

  useEffect(() => {
    if (!editor || !loaded) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () =>
      void fetch('/api/scratch', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(getSnapshot(editor.store).document),
      });
    const stop = editor.store.listen(
      () => {
        clearTimeout(timer);
        timer = setTimeout(save, SAVE_DEBOUNCE_MS);
      },
      { scope: 'document', source: 'all' },
    );
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, [editor, loaded]);

  useEffect(() => {
    if (!editor || !loaded) return;
    // The page's one event stream (web/events.ts): a second EventSource would steal relay ops.
    return onServerEvent('scratch-op', async (data) => {
      let answer;
      try {
        answer = { id: data.id, ok: true, result: await execute(editor, data.op) };
      } catch (cause) {
        answer = { id: data.id, ok: false, error: cause instanceof Error ? cause.message : String(cause) };
      }
      await fetch('/api/scratch/result', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(answer),
      });
    });
  }, [editor, loaded]);

  return (
    <div className="scratchpad" data-loaded={loaded || undefined}>
      <Tldraw
        shapeUtils={shapeUtils}
        components={uiComponents}
        onMount={(mounted) => {
          setEditor(mounted);
          // The chat sends the current canvas selection with every prompt.
          registerCanvasEditor(mounted);
          startGraphTracker(mounted);
          // Dev-only handle for browser tests and console debugging.
          if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
            (window as unknown as { __aiclEditor?: Editor }).__aiclEditor = mounted;
          }
        }}
      />
      <InsertMenu editor={editor} />
    </div>
  );
}
