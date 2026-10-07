import { useMemo, useSyncExternalStore } from 'react';
import { createToastQueue, type ChatController, type ChatState, type Message, type ToastQueue } from '@aicl/core';

import { getCanvasContext } from './canvasContext.ts';
import { createSession, useSessionChat } from './sessionsApi.ts';

export {
  registerCanvasEditor,
  getSelectedShapeIds,
  screenName,
  useSelectedShapeIds,
  clearCanvasSelection,
} from './canvasContext.ts';

/** Adds what the user has selected (and any `extra` body fields) to every chat request body. */
export function withCanvasContext(extra?: () => Record<string, unknown>): typeof globalThis.fetch {
  return (input, init) => {
    if (typeof init?.body === 'string') {
      try {
        const body = JSON.parse(init.body) as Record<string, unknown>;
        body['canvasContext'] = getCanvasContext();
        Object.assign(body, extra?.());
        return globalThis.fetch(input, { ...init, body: JSON.stringify(body) });
      } catch {
        // Not JSON: send untouched.
      }
    }
    return globalThis.fetch(input, init);
  };
}

/** Shared by the dock and any canvas chat windows. */
export const toasts: ToastQueue = createToastQueue();

export interface WorkspaceChat {
  messages: Message[];
  status: ChatState['status'];
  streamingId?: string;
  isBusy: boolean;
  send: (text: string) => Promise<void>;
  stop: () => void;
  controller: ChatController;
}

/** Subscribes to one controller and exposes it as a WorkspaceChat. */
export function useControllerChat(c: ChatController, send: (text: string) => Promise<void> = (text) => c.send(text)): WorkspaceChat {
  const state = useSyncExternalStore(c.state.subscribe, c.state.get, c.state.get);
  const messages = useMemo(() => state.path.map((id) => state.nodes[id]!.message), [state]);
  return {
    messages,
    status: state.status,
    streamingId: state.streamingId,
    isBusy: state.status === 'submitted' || state.status === 'streaming',
    send,
    stop: () => c.stop(),
    controller: c,
  };
}

/** The active session's conversation (the dock, canvas chat windows). */
export function useWorkspaceChat(): WorkspaceChat {
  return useSessionChat();
}

/** Starts a fresh conversation and makes it active. */
export function newWorkspaceChat(): void {
  void createSession();
}
