import { useLayoutEffect, useRef, useState, type ComponentType } from 'react';
import type { ChatStatus, Message, Part, RendererRegistry } from '@aicl/core';
import { ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Icon } from './icons.js';
import { MessageActions, type MessageAction } from './MessageActions.js';
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
/** "Today", "Yesterday", then a short date, the way the surveyed products label days. */
function dayLabel(ts: number): string {
  const day = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return 'Today';
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

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
        {messages.map((message, index) => {
          const day = message.createdAt ? new Date(message.createdAt).toDateString() : null;
          const prev = index > 0 ? messages[index - 1] : undefined;
          const prevDay = prev?.createdAt ? new Date(prev.createdAt).toDateString() : null;
          const showDay = Boolean(day && prevDay && day !== prevDay);
          // The last assistant message along the active branch reveals its
          // actions persistently (corpus rule, transcript §3.3).
          const lastAssistantIndex = (() => {
            for (let i = messages.length - 1; i >= 0; i--) {
              if (messages[i]!.role === 'assistant') return i;
            }
            return -1;
          })();
          return (
            <div key={message.id} data-aicl="message-row" data-role={message.role}>
              {showDay ? <div data-aicl="day-separator"><time dateTime={new Date(message.createdAt!).toISOString()}>{dayLabel(message.createdAt!)}</time></div> : null}
              <MessageItem
                message={message}
                isStreaming={message.id === streamingId}
                registry={registry}
                lastAssistant={index === lastAssistantIndex && message.role === 'assistant'}
              />
            </div>
          );
        })}
      </div>
      {atBottom ? null : (
        <button type="button" data-aicl="scroll-to-bottom" aria-label="Jump to latest" onClick={scrollToBottom}>
          <Icon as={ArrowDown} />
        </button>
      )}
    </div>
  );
}

export function MessageItem({
  message,
  isStreaming = false,
  registry,
  branch,
  onAction,
  lastAssistant = false,
}: {
  message: Message;
  isStreaming?: boolean;
  registry?: RendererRegistry<ComponentType<PartProps>>;
  branch?: { index: number; count: number; onSelect: (index: number) => void };
  onAction?: (action: MessageAction, message: Message) => void;
  lastAssistant?: boolean;
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
      data-part-count={message.parts.length}
      data-identity="none"
      data-branch-index={branch ?branch.index : undefined}
      data-branch-count={branch ?branch.count : undefined}
      data-last-assistant={lastAssistant || undefined}
    >
      {message.aborted ? <p data-aicl="status-line">Stopped working</p> : null}
      {branch && branch.count > 1 ? (
        <div data-aicl="branch-switcher">
          <button type="button" aria-label="Previous version" onClick={() => branch.onSelect(Math.max(0, branch.index - 1))}>
            <Icon as={ChevronLeft} size={14} />
          </button>
          <span>
            {branch.index + 1}/{branch.count}
          </span>
          <button type="button" aria-label="Next version" onClick={() => branch.onSelect(Math.min(branch.count - 1, branch.index + 1))}>
            <Icon as={ChevronRight} size={14} />
          </button>
        </div>
      ) : null}
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
      {isStreaming ? null : <MessageActions message={message} onAction={onAction} />}
    </article>
  );
}

export type { Part };
