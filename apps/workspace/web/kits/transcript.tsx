/**
 * KitTranscript: a whole conversation rendered the provider kit's way. Pure
 * view over Message[]: rows vs bubbles, tool-call style, reasoning, actions,
 * streaming. Live tools (ask_user, plan_update, bash) keep their live data.
 */
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { Message } from '@aicl/core';
import { PartRenderer } from '@aicl/react';
import { ArrowDown } from 'lucide-react';
import type { ProviderKit } from '../../shared/kits.ts';
import { workspaceRegistry } from '../agentSteps.tsx';
import { AskUserPart } from '../agentic/hitl.tsx';
import type { TerminalState } from '../agentic/liveData.ts';
import { TranscriptSession } from '../sessionsApi.ts';
import { clock, groupActive, messageText, segmentParts, turnSeconds, type Segment } from './model.ts';
import {
  AssistantHeader,
  AssistantText,
  KitActions,
  KitRenderContext,
  PartBoundary,
  PlanBlock,
  ReasoningBlock,
  UserTurn,
  Waiting,
  WorkGroup,
  useReduced,
} from './parts.tsx';

export interface KitTranscriptProps {
  kit: ProviderKit;
  sessionId: string;
  messages: Message[];
  status: 'ready' | 'submitted' | 'streaming' | 'error' | string;
  streamingId?: string;
  /** Re-send the last user message (message action "retry"). */
  onRetry?: () => void;
  /** Empty state shown when there are no messages (the app passes its hero). */
  empty?: ReactNode;
  /** Static terminal output by toolCallId, for galleries and previews (live sessions read the event store). */
  terminals?: Record<string, TerminalState>;
  className?: string;
}

const lastPlanCallId = (messages: Message[]): string | undefined => {
  for (let m = messages.length - 1; m >= 0; m--) {
    const parts = messages[m]!.parts;
    for (let p = parts.length - 1; p >= 0; p--) {
      const part = parts[p]!;
      if (part.type === 'tool-call' && part.name === 'plan_update') return part.toolCallId;
    }
  }
  return undefined;
};

function AssistantTurn({
  kit,
  message,
  index,
  messages,
  streaming,
  onRetry,
}: {
  kit: ProviderKit;
  message: Message;
  index: number;
  messages: Message[];
  streaming: boolean;
  onRetry?: (() => void) | undefined;
}) {
  const segments = useMemo(
    () => segmentParts(message.parts, { toolCalls: kit.transcript.toolCalls, reasoning: kit.transcript.reasoning }),
    [message.parts, kit.transcript.toolCalls, kit.transcript.reasoning],
  );
  const fallbackSeconds = useMemo(() => turnSeconds(messages, index), [messages, index]);
  const lastIdx = segments.length - 1;
  const last = segments[lastIdx];
  const hasText = message.parts.some((p) => p.type === 'text' && p.text.trim());
  // The turn is between steps: something finished and the next token has not arrived.
  const waitingTail =
    streaming && !!last && ((last.kind === 'work' && !groupActive(last.items)) || (last.kind === 'reasoning' && last.part.durationMs !== undefined));

  const render = (s: Segment, n: number): ReactNode => {
    const isLast = n === lastIdx;
    switch (s.kind) {
      case 'text':
        return <AssistantText text={s.part.text} streaming={streaming && isLast} />;
      case 'reasoning':
        return <ReasoningBlock part={s.part} active={streaming && isLast && s.part.durationMs === undefined} />;
      case 'work': {
        const active = groupActive(s.items) || (streaming && isLast);
        return <WorkGroup items={s.items} active={active} fallbackSeconds={fallbackSeconds} />;
      }
      case 'standalone':
        return s.part.name === 'ask_user' ? <AskUserPart part={s.part} message={message} index={s.index} streaming={streaming} /> : <PlanBlock part={s.part} />;
      case 'other':
        return <PartRenderer part={s.part} message={message} index={s.index} streaming={streaming} registry={workspaceRegistry} />;
    }
  };
  const keyOf = (s: Segment) => (s.kind === 'work' ? s.key : `${s.kind}${s.index}`);
  const stateKey = (s: Segment) => (s.kind === 'work' ? s.items.map((i) => (i.kind === 'tool' ? i.part.status : 'r')).join() : s.kind === 'standalone' ? s.part.status : 'x');

  return (
    <>
      {kit.transcript.assistantHeader ? <AssistantHeader kit={kit} /> : null}
      {message.aborted ? (
        <p data-aicl="status-line" className="m-0 text-sm text-faint">
          Stopped working
        </p>
      ) : null}
      {segments.length === 0 && streaming ? <Waiting kit={kit} /> : null}
      {segments.map((s, n) => (
        <PartBoundary key={keyOf(s)} keys={[stateKey(s)]}>
          {render(s, n)}
        </PartBoundary>
      ))}
      {waitingTail ? <Waiting kit={kit} /> : null}
      {!streaming && (hasText || segments.length > 0) ? <KitActions kit={kit} message={message} onRetry={onRetry} /> : null}
    </>
  );
}

/** A whole conversation, rendered the kit's way (rows vs bubbles, tool-call style, reasoning, actions, streaming). */
export function KitTranscript({ kit, sessionId, messages, status, streamingId, onRetry, empty, terminals, className }: KitTranscriptProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const reduced = useReduced();
  // Messages present on first paint do not animate in (history); later ones do.
  const initial = useRef<Set<string> | null>(null);
  if (initial.current === null) initial.current = new Set(messages.map((m) => m.id));

  const sync = () => {
    const el = logRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    pinned.current = near;
    setAtBottom(near);
  };
  const toBottom = () => {
    const el = logRef.current;
    if (!el) return;
    pinned.current = true;
    el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  };
  useLayoutEffect(() => {
    const el = logRef.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  });
  // Disclosures and streaming text grow after render: stay pinned to the latest while the user is at the bottom.
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const body = inner.current;
    if (!body || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const el = logRef.current;
      if (el && pinned.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(body);
    return () => ro.disconnect();
  }, [messages.length === 0]);

  const render = useMemo(() => ({ kit, sessionId, ...(terminals ? { terminals } : {}), lastPlanId: lastPlanCallId(messages) }), [kit, sessionId, terminals, messages]);

  if (!messages.length && empty) return <>{empty}</>;

  const busy = status === 'submitted' || status === 'streaming';
  const lastMessage = messages[messages.length - 1];
  const awaiting = status === 'submitted' && lastMessage?.role === 'user';
  const spring = { type: 'spring' as const, ...kit.motion.spring };

  return (
    <TranscriptSession.Provider value={sessionId}>
      <KitRenderContext.Provider value={render}>
        <div data-aicl="transcript-root" data-kit-transcript={kit.id} className={className}>
          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Conversation"
            data-aicl="transcript"
            data-kit={kit.id}
            data-status={status}
            data-at-bottom={atBottom || undefined}
            data-empty={messages.length === 0 || undefined}
            data-count={messages.length}
            onScroll={sync}
          >
            <div ref={inner} className="flex min-w-0 flex-col" style={{ gap: kit.transcript.user === 'row' ? 'var(--aicl-space-3)' : 'var(--aicl-space-5)' }}>
            {messages.map((m, i) => {
              const streaming = busy && m.id === streamingId;
              const fresh = !initial.current!.has(m.id) && !reduced;
              const stamp = m.role === 'user' && kit.transcript.timestamps === 'header' && m.createdAt ? clock(m.createdAt) : undefined;
              return (
                <motion.article
                  key={m.id}
                  data-aicl="message"
                  data-role={m.role}
                  data-state={m.aborted ? 'aborted' : streaming ? 'streaming' : 'complete'}
                  data-message-id={m.id}
                  data-part-count={m.parts.length}
                  data-last-assistant={m.role === 'assistant' && i === messages.length - 1 ? true : undefined}
                  initial={fresh ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={spring}
                  className={m.role === 'user' ? 'flex flex-col gap-1' : 'flex min-w-0 flex-col gap-3'}
                >
                  {m.role === 'user' ? (
                    <PartBoundary>
                      <UserTurn kit={kit} time={stamp}>
                        <div data-aicl="part" data-part="text">
                          {messageText(m)}
                        </div>
                        {m.parts.map((p, pi) =>
                          p.type === 'text' ? null : <PartRenderer key={pi} part={p} message={m} index={pi} streaming={false} registry={workspaceRegistry} />,
                        )}
                      </UserTurn>
                    </PartBoundary>
                  ) : (
                    <AssistantTurn kit={kit} message={m} index={i} messages={messages} streaming={streaming} onRetry={onRetry} />
                  )}
                </motion.article>
              );
            })}
            {awaiting ? (
              <div data-aicl="message" data-role="assistant" data-state="pending" className="flex flex-col gap-3">
                {kit.transcript.assistantHeader ? <AssistantHeader kit={kit} /> : null}
                <Waiting kit={kit} />
              </div>
            ) : null}
            </div>
          </div>
          {atBottom ? null : (
            <button type="button" data-aicl="scroll-to-bottom" aria-label="Jump to latest" onClick={toBottom}>
              <ArrowDown size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </KitRenderContext.Provider>
    </TranscriptSession.Provider>
  );
}
