/** Canvas-workspace actions shared by the toolbar, ⌘K and the keyboard (AICL-41). */
import { getCanvasEditor } from '../canvasContext.ts';
import { getFocusMode, getRoute, navigate, setFocusMode } from '../router.ts';
import { tidyCanvas } from './frames.ts';

/** ⌘⇧F: canvas-first mode on/off (from any tab, it opens the canvas in focus mode). */
export function toggleFocus(): void {
  if (getRoute().tab !== 'canvas') navigate('aicl:/canvas?mode=focus');
  else setFocusMode(!getFocusMode());
}

/** Tidy canvas: work frames in lanes, one row per session, most recent first. */
export async function tidy(): Promise<number> {
  if (getRoute().tab !== 'canvas') navigate({ tab: 'canvas' });
  const editor = getCanvasEditor();
  return editor ? tidyCanvas(editor) : 0;
}
