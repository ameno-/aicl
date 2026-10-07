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
  if (editor) trackUserActions(editor);
}

/* ── Recent user actions ──────────────────────────────────────────── */

const MAX_ACTIONS = 20;
const actions: { key: string; text: string }[] = [];
const tracked = new WeakSet<Editor>();
let agentDepth = 0;
/** Shape ids the agent touched recently; tldraw delivers store changes a beat after the mutation. */
const agentTouched = new Map<string, number>();
const AGENT_WINDOW_MS = 3000;

/**
 * A change counts as a user action only if the user was just pressing keys or
 * the pointer. That excludes the snapshot loading at startup and anything
 * the agent does while the user is idle.
 */
let lastInput = 0;
if (typeof window !== 'undefined') {
  const mark = () => void (lastInput = Date.now());
  for (const type of ['pointerdown', 'pointerup', 'keydown', 'paste', 'drop']) window.addEventListener(type, mark, true);
  window.addEventListener('pointermove', (e) => e.buttons > 0 && mark(), true);
}

const touchedByAgent = (id: string): boolean => {
  const at = agentTouched.get(shortShape(id));
  return at !== undefined && Date.now() - at < AGENT_WINDOW_MS;
};

/** The executor wraps agent ops in this so they never appear as user actions. */
export async function asAgent<T>(run: () => Promise<T>): Promise<T> {
  agentDepth++;
  try {
    const result = await run();
    const ids = (result as { op?: string; ids?: unknown })?.op === 'focus' ? undefined : (result as { ids?: unknown })?.ids;
    if (Array.isArray(ids)) for (const id of ids) if (typeof id === 'string') agentTouched.set(id, Date.now());
    return result;
  } finally {
    agentDepth--;
  }
}

function record(key: string, text: string): void {
  const last = actions[actions.length - 1];
  if (last && last.key === key) last.text = text;
  else actions.push({ key, text });
  if (actions.length > MAX_ACTIONS) actions.shift();
}

interface AnyShape {
  id: string;
  type: string;
  x: number;
  y: number;
  props: Record<string, unknown>;
}

const shortShape = (id: string) => (id.startsWith('shape:') ? id.slice(6) : id);

function describe(shape: AnyShape): string {
  const label = shape.type === 'aicl-component' && typeof shape.props['component'] === 'string' ? (shape.props['component'] as string) : shape.type === 'geo' ? String(shape.props['geo'] ?? 'shape') : shape.type;
  return `${label === 'rectangle' ? 'rect' : label} ${shortShape(shape.id)}`;
}

function trackUserActions(editor: Editor): void {
  if (tracked.has(editor)) return;
  tracked.add(editor);
  editor.store.listen(
    ({ changes }) => {
      if (agentDepth > 0 || Date.now() - lastInput > 1500) return;
      for (const [id, at] of agentTouched) if (Date.now() - at >= AGENT_WINDOW_MS) agentTouched.delete(id);
      for (const rec of Object.values(changes.added)) {
        if (rec.typeName === 'shape' && !touchedByAgent(rec.id)) record(`add:${rec.id}`, `created ${describe(rec as unknown as AnyShape)}`);
      }
      for (const rec of Object.values(changes.removed)) {
        if (rec.typeName === 'shape' && !touchedByAgent(rec.id)) record(`del:${rec.id}`, `deleted ${describe(rec as unknown as AnyShape)}`);
      }
      for (const [from, to] of Object.values(changes.updated)) {
        if (to.typeName !== 'shape' || touchedByAgent(to.id) || to.type === 'arrow') continue;
        const a = from as unknown as AnyShape;
        const b = to as unknown as AnyShape;
        if (a.x !== b.x || a.y !== b.y) record(`move:${b.id}`, `moved ${describe(b)} to (${Math.round(b.x)}, ${Math.round(b.y)})`);
        else if (a.props['w'] !== b.props['w'] || a.props['h'] !== b.props['h']) {
          record(`size:${b.id}`, `resized ${describe(b)} to ${Math.round(Number(b.props['w']))}x${Math.round(Number(b.props['h']))}`);
        } else if (JSON.stringify(a.props['richText']) !== JSON.stringify(b.props['richText'])) record(`text:${b.id}`, `edited text of ${describe(b)}`);
      }
    },
    { source: 'user', scope: 'document' },
  );
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
  const editor = currentEditor();
  const ctx: CanvasContext = { selectedShapes: getSelectedShapeIds(), uiSelection: getUiSelection(), route: getRoute() };
  if (editor) {
    trackUserActions(editor);
    const v = editor.getViewportPageBounds();
    ctx.viewport = { x: Math.round(v.x), y: Math.round(v.y), w: Math.round(v.w), h: Math.round(v.h) };
  }
  ctx.recentActions = actions.map((a) => a.text);
  return ctx;
}
