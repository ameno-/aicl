import { useLayoutEffect, useRef, useState, type ComponentType } from 'react';
import type { ChatStatus, Message, Part, RendererRegistry } from '@aicl/core';
import { PartRenderer, ReasoningDisclosure, type PartProps } from './parts.js';

export interface TranscriptProps {
  messages: Message[];
  status: ChatStatus;
  streamingId?: string;
  registry?: RendererRegistry<ComponentType<PartProps>>;
}

/**
 * Unstyled transcript. The `role="log"` node is unconditional so token appends
 * do not recreate the live region.
 */
export function Transcript({ messages, status, streamingId, registry }: TranscriptProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const syncPin = () => {
    const el = logRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const next = distance < 24;
    pinned.current = next;
    setAtBottom(next);
  };

  const scrollToBottom = () => {
    const el = logRef.current;
    if (!el) return;
    pinned.current = true;
    el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  };

  useLayoutEffect(() => {
    if (!pinned.current) return;
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  return (
    <div data-aicl="transcript-root">
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation"
        data-aicl="transcript"
        data-status={status}
        data-at-bottom={atBottom || undefined}
        data-empty={messages.length === 0 || undefined}
        data-count={messages.length}
        onScroll={syncPin}
      >
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            isStreaming={message.id === streamingId}
            registry={registry}
          />
        ))}
      </div>
      {atBottom ? null : (
        <button type="button" data-aicl="scroll-to-bottom" onClick={scrollToBottom}>
          Jump to latest
        </button>
      )}
    </div>
  );
}

export function MessageItem({
  message,
  isStreaming = false,
  registry,
}: {
  message: Message;
  isStreaming?: boolean;
  registry?: RendererRegistry<ComponentType<PartProps>>;
}) {
  const alignment = message.role === 'user' ? 'end' : 'full';
  const state = message.aborted ? 'aborted' : isStreaming ? 'streaming' : 'complete';
  return (
    <article
      data-aicl="message"
      data-role={message.role}
      data-alignment={alignment}
      data-state={state}
      data-message-id={message.id}
    >
      {message.aborted ? <p data-aicl="status-line">Stopped working</p> : null}
      {isStreaming && message.parts.length === 0 ? <ReasoningDisclosure streaming /> : null}
      {message.parts.map((part, index) => (
        <PartRenderer
          key={`${message.id}:${index}:${part.type}`}
          part={part}
          message={message}
          index={index}
          streaming={isStreaming}
          registry={registry}
        />
      ))}
    </article>
  );
}

export type { Part };
