import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';
import type { ChatStatus, Message, Part, RendererRegistry } from '@aicl/core';
import { Icon } from './icons.js';
import { MessageActions, type MessageAction } from './MessageActions.js';
import { PartRenderer, ReasoningDisclosure, type PartProps } from './parts.js';

export interface TranscriptProps {
  messages: Message[];
  status: ChatStatus;
  streamingId?: string;
  registry?: RendererRegistry<ComponentType<PartProps>>;
  /**
   * Replaces the default arrangement (`Scroller`, `Content`, `JumpToLatest`).
   * The root and the provider stay. Omit it and the transcript renders the
   * same tree it always has.
   */
  children?: ReactNode;
}

/** What a row or a scroller can read, including from outside the default list. */
export interface TranscriptApi {
  messages: Message[];
  status: ChatStatus;
  streamingId?: string;
  registry?: RendererRegistry<ComponentType<PartProps>>;
  /** True when the scroller is within 24px of the bottom. */
  atBottom: boolean;
  scrollerRef: RefObject<HTMLDivElement>;
  /** Pins the scroller and jumps it to the latest row. */
  scrollToLatest: () => void;
  /** Records the pin from the scroller's current scroll position. */
  noteScroll: () => void;
  /**
   * A row calls this on mount and when its message changes, and the
   * returned function on unmount. The scroller then sticks to the bottom
   * for rows it did not render itself.
   */
  registerContent: () => () => void;
}

const TranscriptContext = createContext<TranscriptApi | null>(null);

/**
 * The live state of the transcript a subpart belongs to.
 *
 * Throws outside a `Transcript` or `TranscriptProvider`, because a row
 * without a scroller has nothing to register with.
 */
export function useTranscript(): TranscriptApi {
  const api = useContext(TranscriptContext);
  if (!api) throw new Error('useTranscript must be used within a Transcript or TranscriptProvider');
  return api;
}

/**
 * The transcript state, without the root element. A row rendered outside
 * `Transcript`'s own tree uses this so it can still register with the scroller.
 */
export function TranscriptProvider({ messages, status, streamingId, registry, children }: TranscriptProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const [contentTick, setContentTick] = useState(0);
  const scheduled = useRef(false);
  const mounted = useRef(true);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const noteScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const next = distance < 24;
    pinned.current = next;
    setAtBottom(next);
  }, []);

  const scrollToLatest = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    pinned.current = true;
    el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  }, []);

  // Many rows mount in one commit. One tick covers the whole commit.
  const registerContent = useCallback(() => {
    const bump = () => {
      if (scheduled.current) return;
      scheduled.current = true;
      queueMicrotask(() => {
        scheduled.current = false;
        if (mounted.current) setContentTick((tick) => tick + 1);
      });
    };
    bump();
    return bump;
  }, []);

  useLayoutEffect(() => {
    if (!pinned.current) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status, contentTick]);

  const api = useMemo<TranscriptApi>(
    () => ({
      messages,
      status,
      streamingId,
      registry,
      atBottom,
      scrollerRef,
      scrollToLatest,
      noteScroll,
      registerContent,
    }),
    [messages, status, streamingId, registry, atBottom, scrollToLatest, noteScroll, registerContent],
  );

  return <TranscriptContext.Provider value={api}>{children}</TranscriptContext.Provider>;
}

/**
 * Unstyled transcript. The `role="log"` node is unconditional so token
 * appends do not recreate the live region.
 *
 * It is a **compound** component: `Transcript.Scroller`, `Transcript.Content`,
 * `Transcript.Item` and `Transcript.JumpToLatest` can be arranged by the
 * consumer. With no children it renders that default arrangement, which is
 * the tree it rendered before the parts existed.
 */
function TranscriptRoot({ children, ...rest }: TranscriptProps) {
  return (
    <TranscriptProvider {...rest}>
      <div data-aicl="transcript-root">
        {children ?? (
          <>
            <TranscriptScroller>
              <TranscriptContent />
            </TranscriptScroller>
            <TranscriptJumpToLatest />
          </>
        )}
      </div>
    </TranscriptProvider>
  );
}

/** The scroll container and the one live region for the thread. */
export function TranscriptScroller({ children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const api = useTranscript();
  return (
    <div
      {...rest}
      ref={api.scrollerRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label={rest['aria-label'] ?? 'Conversation'}
      data-aicl="transcript"
      data-status={api.status}
      data-at-bottom={api.atBottom || undefined}
      data-empty={api.messages.length === 0 || undefined}
      data-count={api.messages.length}
      onScroll={(event) => {
        api.noteScroll();
        rest.onScroll?.(event);
      }}
    >
      {children}
    </div>
  );
}

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

function dayKey(ts: number | undefined): string | null {
  return ts ? new Date(ts).toDateString() : null;
}

function lastAssistantIndex(messages: Message[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'assistant') return i;
  }
  return -1;
}

/** The default rows: a day separator where the day changes, then one item. */
export function TranscriptContent({ children }: { children?: ReactNode }) {
  const api = useTranscript();
  if (children != null) return <>{children}</>;

  const latest = lastAssistantIndex(api.messages);
  return (
    <>
      {api.messages.map((message, index) => {
        const day = dayKey(message.createdAt);
        const prev = index > 0 ? api.messages[index - 1] : undefined;
        const showDay = Boolean(day && dayKey(prev?.createdAt) && day !== dayKey(prev?.createdAt));
        return (
          <TranscriptItem
            key={message.id}
            message={message}
            showDay={showDay}
            lastAssistant={index === latest && message.role === 'assistant'}
          />
        );
      })}
    </>
  );
}

export function TranscriptItem({
  message,
  showDay,
  lastAssistant,
  isStreaming,
  branch,
  onAction,
  children,
}: {
  message: Message;
  /** When omitted, the row looks at the previous message in the provider. */
  showDay?: boolean;
  lastAssistant?: boolean;
  isStreaming?: boolean;
  branch?: { index: number; count: number; onSelect: (index: number) => void };
  onAction?: (action: MessageAction, message: Message) => void;
  /** Replaces the default day separator and `MessageItem`. The row stays. */
  children?: ReactNode;
}) {
  const api = useTranscript();
  useLayoutEffect(() => api.registerContent(), [api.registerContent, message]);

  const index = api.messages.findIndex((item) => item.id === message.id);
  const resolvedShowDay =
    showDay ??
    (index > 0 &&
      Boolean(
        dayKey(message.createdAt) &&
          dayKey(api.messages[index - 1]?.createdAt) &&
          dayKey(message.createdAt) !== dayKey(api.messages[index - 1]?.createdAt),
      ));
  const resolvedLast = lastAssistant ?? (message.role === 'assistant' && lastAssistantIndex(api.messages) === index);
  const streaming = isStreaming ?? message.id === api.streamingId;

  return (
    <div data-aicl="message-row" data-role={message.role}>
      {children ?? (
        <>
          {resolvedShowDay ? (
            <div data-aicl="day-separator">
              <time dateTime={new Date(message.createdAt!).toISOString()}>{dayLabel(message.createdAt!)}</time>
            </div>
          ) : null}
          <MessageItem
            message={message}
            isStreaming={streaming}
            registry={api.registry}
            branch={branch}
            onAction={onAction}
            lastAssistant={resolvedLast}
          />
        </>
      )}
    </div>
  );
}

/** The control that appears once the reader has left the bottom. */
export function TranscriptJumpToLatest({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const api = useTranscript();
  if (api.atBottom) return null;
  return (
    <button
      {...rest}
      type="button"
      data-aicl="scroll-to-bottom"
      aria-label={rest['aria-label'] ?? 'Jump to latest'}
      onClick={(event) => {
        api.scrollToLatest();
        rest.onClick?.(event);
      }}
    >
      {children ?? <Icon name="arrow-down" />}
    </button>
  );
}

export const Transcript = Object.assign(TranscriptRoot, {
  Scroller: TranscriptScroller,
  Content: TranscriptContent,
  Item: TranscriptItem,
  JumpToLatest: TranscriptJumpToLatest,
});

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
      data-branch-index={branch ? branch.index : undefined}
      data-branch-count={branch ? branch.count : undefined}
      data-last-assistant={lastAssistant || undefined}
    >
      {message.aborted ? <p data-aicl="status-line">Stopped working</p> : null}
      {branch && branch.count > 1 ? (
        <div data-aicl="branch-switcher">
          <button type="button" aria-label="Previous version" onClick={() => branch.onSelect(Math.max(0, branch.index - 1))}>
            <Icon name="chevron-left" size={14} />
          </button>
          <span>
            {branch.index + 1}/{branch.count}
          </span>
          <button type="button" aria-label="Next version" onClick={() => branch.onSelect(Math.min(branch.count - 1, branch.index + 1))}>
            <Icon name="chevron-right" size={14} />
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
