import { useMemo, useSyncExternalStore } from 'react';
import { ChatController, createSseTransport, createToastQueue, type ChatState, type Message, type ToastQueue } from '@aicl/core';

import { getCanvasContext } from './canvasContext.ts';

export {
  registerCanvasEditor,
  getSelectedShapeIds,
  screenName,
  useSelectedShapeIds,
  clearCanvasSelection,
} from './canvasContext.ts';

/** Adds what the user has selected to every chat request body. */
const withCanvasContext: typeof globalThis.fetch = (input, init) => {
  if (typeof init?.body === 'string') {
    try {
      const body = JSON.parse(init.body) as Record<string, unknown>;
      body['canvasContext'] = getCanvasContext();
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
