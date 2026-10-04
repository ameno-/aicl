import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { ChatController, type ChatOptions, type ChatState, type Message, type Part } from '@aicl/core';

export interface UseChatResult {
  messages: Message[];
  status: ChatState['status'];
  error: ChatState['error'];
  streamingId?: string;
  isBusy: boolean;
  send: (text: string, attachments?: Part[]) => Promise<void>;
  regenerate: () => Promise<void>;
  edit: (messageId: string, text: string) => Promise<void>;
  selectBranch: (messageId: string) => void;
  stop: () => void;
  controller: ChatController;
}

/**
 * Binds a `ChatController` to React.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: it is tear-free
 * under concurrent rendering, which matters here because a streaming transcript
 * updates many times per frame and React may render at a different cadence.
 */
export function useChat(options: ChatOptions): UseChatResult {
  // The controller owns a live connection and must survive re-renders. A ref
  // with lazy init avoids constructing a throwaway on every render, which
  // `useMemo` does not strictly guarantee.
  const ref = useRef<ChatController | null>(null);
  if (ref.current === null) ref.current = new ChatController(options);
  const controller = ref.current;

  const subscribe = useCallback(
    (onChange: () => void) => controller.state.subscribe(onChange),
    [controller],
  );
  const getSnapshot = useCallback(() => controller.state.get(), [controller]);

  // Same snapshot on the server: core holds no browser-only state, so the
  // initial server render matches the client's first paint.
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // `state` is replaced wholesale on every change, so this recomputes exactly
  // when the transcript actually changed.
  const messages = useMemo(
    () => state.path.map((id) => state.nodes[id]!.message),
    [state],
  );

  return {
    messages,
    status: state.status,
    error: state.error,
    streamingId: state.streamingId,
    isBusy: state.status === 'submitted' || state.status === 'streaming',
    send: useCallback((t, a) => controller.send(t, a), [controller]),
    regenerate: useCallback(() => controller.regenerate(), [controller]),
    edit: useCallback((id, t) => controller.edit(id, t), [controller]),
    selectBranch: useCallback((id) => controller.selectBranch(id), [controller]),
    stop: useCallback(() => controller.stop(), [controller]),
    controller,
  };
}
