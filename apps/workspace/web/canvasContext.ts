/**
 * What the agent knows about the canvas when the user sends a message
 * (shared/runtime.ts CanvasContext). Work package D extends this with the
 * viewport and recent user actions; chatStore attaches it to every request.
 */
import { useEffect, useState } from 'react';
import type { Editor } from 'tldraw';
import type { CanvasContext } from '../shared/runtime.ts';
import { getRoute } from './router.ts';
import { getUiSelection } from './ui/selection.ts';

let canvasEditor: Editor | null = null;

/** The Scratchpad registers its tldraw editor so the chat can see and clear the selection. */
export function registerCanvasEditor(editor: Editor | null): void {
  canvasEditor = editor;
}

const currentEditor = (): Editor | null => canvasEditor ?? (window as unknown as { __aiclEditor?: Editor }).__aiclEditor ?? null;

/** Short ids of the shapes selected on the canvas. */
export function getSelectedShapeIds(): string[] {
  const editor = currentEditor();
  if (!editor) return [];
  return editor.getSelectedShapeIds().map((id) => (id.startsWith('shape:') ? id.slice(6) : id));
}

/** Name of the screen shape `shapeId`, if the editor can see it. */
export function screenName(shapeId: string): string | undefined {
  const shape = currentEditor()?.getShape((shapeId.startsWith('shape:') ? shapeId : `shape:${shapeId}`) as never) as
    | { props?: { props?: { name?: unknown } } }
    | undefined;
  const name = shape?.props?.props?.name;
  return typeof name === 'string' ? name : undefined;
}

/** Selected shape ids, kept current (the editor is not reactive from here, so poll cheaply). */
export function useSelectedShapeIds(): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const tick = () => {
      const next = getSelectedShapeIds();
      setIds((prev) => (prev.join('|') === next.join('|') ? prev : next));
    };
    tick();
    const timer = setInterval(tick, 300);
    return () => clearInterval(timer);
  }, []);
  return ids;
}

export function clearCanvasSelection(): void {
  currentEditor()?.selectNone();
}


/** The editor the canvas registered (or the dev handle), for D's context and tools. */
export function getCanvasEditor(): Editor | null {
  return currentEditor();
}

/** Everything sent as `canvasContext` with a prompt. */
export function getCanvasContext(): CanvasContext {
  return { selectedShapes: getSelectedShapeIds(), uiSelection: getUiSelection(), route: getRoute() };
}
