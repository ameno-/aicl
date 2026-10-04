import { useEffect, useState } from 'react';
import { getSnapshot, loadSnapshot, Tldraw, type Editor } from 'tldraw';
import 'tldraw/tldraw.css';
import type { ScratchOp } from '../shared/scratch.ts';
import { execute } from './executor.ts';

const SAVE_DEBOUNCE_MS = 400;

/**
 * The shared canvas. Loads the workspace snapshot, saves every document
 * change back to disk, and executes the agent's ops as they arrive.
 */
export function Scratchpad() {
  const [editor, setEditor] = useState<Editor | null>(null);
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
    const events = new EventSource('/api/events');
    events.onmessage = async (message) => {
      const data = JSON.parse(message.data) as { type: string; id: string; op: ScratchOp };
      if (data.type !== 'scratch-op') return;
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
    };
    return () => events.close();
  }, [editor, loaded]);

  return (
    <div className="scratchpad" data-loaded={loaded || undefined}>
      <Tldraw onMount={setEditor} />
    </div>
  );
}
