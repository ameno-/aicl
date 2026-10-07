import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Editor } from 'tldraw';
import { ChatController, createSseTransport, createToastQueue, type ChatState, type Message, type ToastQueue } from '@aicl/core';

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

/** Adds what the user has selected to every chat request body. */
const withCanvasContext: typeof globalThis.fetch = (input, init) => {
  if (typeof init?.body === 'string') {
    try {
      const body = JSON.parse(init.body) as Record<string, unknown>;
      body['canvasContext'] = { selectedShapes: getSelectedShapeIds(), uiSelection: getUiSelection() };
      return globalThis.fetch(input, { ...init, body: JSON.stringify(body) });
    } catch {
      // Not JSON: send untouched.
    }
  }
  return globalThis.fetch(input, init);
};

/** One workspace conversation, shared by the dock and any canvas chat windows. */
export const toasts: ToastQueue = createToastQueue();

const makeController = () =>
  new ChatController({
    transport: createSseTransport({ url: '/api/chat', fetch: withCanvasContext }),
    onError: (e) => toasts.push({ title: 'The agent stopped', description: e.message, variant: 'error' }),
  });

let controller = makeController();
const listeners = new Set<() => void>();

/** Swap in a fresh conversation; every subscriber re-renders against it. */
export function newWorkspaceChat(): void {
  controller = makeController();
  for (const l of listeners) l();
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};
const getController = () => controller;

export interface WorkspaceChat {
  messages: Message[];
  status: ChatState['status'];
  streamingId?: string;
  isBusy: boolean;
  send: (text: string) => Promise<void>;
  stop: () => void;
  controller: ChatController;
}

export function useWorkspaceChat(): WorkspaceChat {
  const c = useSyncExternalStore(subscribe, getController, getController);
  const state = useSyncExternalStore(c.state.subscribe, c.state.get, c.state.get);
  const messages = useMemo(() => state.path.map((id) => state.nodes[id]!.message), [state]);
  return {
    messages,
    status: state.status,
    streamingId: state.streamingId,
    isBusy: state.status === 'submitted' || state.status === 'streaming',
    send: (text) => c.send(text),
    stop: () => c.stop(),
    controller: c,
  };
}
