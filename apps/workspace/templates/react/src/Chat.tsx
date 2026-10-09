import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { createChat, reasoningLabel, renderMarkdown, toolLabel, type Chat, type ChatOptions, type ChatState, type Message, type Part } from './aicl-chat.js';
import { C } from './classes';

/** One chat store for the component's lifetime. */
export function useChatStore(options: ChatOptions): Chat {
  const ref = useRef<Chat | null>(null);
  if (!ref.current) ref.current = createChat(options);
  return ref.current;
}

export function useChatState(chat: Chat): ChatState {
  return useSyncExternalStore(chat.subscribe, chat.getState, chat.getState);
}

function PartView({ part, streaming }: { part: Part; streaming: boolean }) {
  switch (part.type) {
    case 'text':
      return <div className={C.markdown} dangerouslySetInnerHTML={{ __html: renderMarkdown(part.text) }} />;
    case 'reasoning':
      return (
        <details className={C.reasoning} data-streaming={streaming && !part.durationMs ? '' : undefined}>
          <summary className={C.summary}>
            <span className={C.dot} />
            {reasoningLabel(part, streaming)}
          </summary>
          {part.text ? <div className={C.detailBody}>{part.text}</div> : null}
        </details>
      );
    case 'tool-call':
      return (
        <details className={C.tool} data-status={part.status} open={part.status === 'error' || undefined}>
          <summary className={C.summary}>
            <span className={C.dot} data-status={part.status} />
            {toolLabel(part)}
          </summary>
          <pre className={C.detailCode}>{part.argsText ?? JSON.stringify(part.args, null, 2)}</pre>
        </details>
      );
    case 'artifact':
      return (
        <div className={C.artifact}>
          <span className={C.artifactKind}>{part.kind}</span>
          <span className={C.artifactTitle}>{part.title ?? part.artifactId}</span>
          {part.version != null ? <span className={C.artifactVersion}>v{part.version}</span> : null}
        </div>
      );
    case 'error':
      return (
        <div className={C.error} role="alert">
          {part.message}
        </div>
      );
    case 'html':
      return <div dangerouslySetInnerHTML={{ __html: part.html }} />;
    default:
      return null;
  }
}

function MessageView({ message, streaming }: { message: Message; streaming: boolean }) {
  if (message.role === 'user') {
    const text = message.parts.map((p) => (p?.type === 'text' ? p.text : '')).join('\n');
    return (
      <div className={C.message} data-role="user">
        <div className={C.bubble}>{text}</div>
      </div>
    );
  }
  return (
    <div className={C.message} data-role="assistant">
      {message.parts.map((part, i) => (part ? <PartView key={i} part={part} streaming={streaming} /> : null))}
      {message.aborted ? <div className={C.status}>Stopped</div> : null}
    </div>
  );
}

/** The live transcript: the designed sample conversation, then everything you send. */
export function Thread({ chat }: { chat: Chat }) {
  const { messages, status, error } = useChatState(chat);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status !== 'idle' || messages.some((m) => !m.seed)) end.current?.scrollIntoView({ block: 'end' });
  }, [messages, status]);
  const last = messages[messages.length - 1];
  return (
    <div className={C.thread} role="log" aria-live="polite" aria-label="Conversation">
      {messages.map((m) => (
        <MessageView key={m.id} message={m} streaming={status === 'streaming' && m === last} />
      ))}
      {status === 'submitted' ? (
        <div className={C.message} data-role="assistant">
          <span className={C.pending}>
            <span className={C.dot} data-status="running" />
            Thinking…
          </span>
        </div>
      ) : null}
      {status === 'error' && error ? (
        <div className={C.error} role="alert">
          <span>{error.message}</span>
          {error.retryable !== false ? (
            <button type="button" className={C.chip} onClick={() => void chat.retry()}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      <div ref={end} />
    </div>
  );
}

export interface ComposerProps {
  chat: Chat;
  placeholder?: string;
  suggestions?: string[];
  variant?: 'docked' | 'hero';
}

/** Enter sends (never mid-IME-composition), Shift+Enter adds a line, the button stops a reply in flight. */
export function Composer({ chat, placeholder = 'Message', suggestions = [], variant = 'docked' }: ComposerProps) {
  const { status } = useChatState(chat);
  const [value, setValue] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const busy = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const submit = () => {
    if (busy || !value.trim()) return;
    void chat.send(value);
    setValue('');
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form
      className={C.composer}
      data-variant={variant}
      onSubmit={(e) => {
        e.preventDefault();
        if (status === 'streaming') chat.stop();
        else submit();
      }}
    >
      {suggestions.length ? (
        <div className={C.chips}>
          {suggestions.map((s) => (
            <button key={s} type="button" className={C.chip} onClick={() => (setValue(s), input.current?.focus())}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <div className={C.input}>
        <textarea
          ref={input}
          rows={1}
          className={C.textarea}
          value={value}
          placeholder={placeholder}
          aria-label="Message"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="submit"
          className={C.send}
          aria-label={status === 'streaming' ? 'Stop' : 'Send'}
          disabled={status === 'submitted' || (status !== 'streaming' && !value.trim())}
        >
          {status === 'streaming' ? '■' : '↑'}
        </button>
      </div>
    </form>
  );
}
