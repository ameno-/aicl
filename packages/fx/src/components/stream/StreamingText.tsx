import { memo, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useReducedMotionConfig } from 'motion/react';
import { cn } from '../../lib/cn.ts';

export type StreamingMode = 'words' | 'blur' | 'none';

export interface StreamingTextProps {
  text: string;
  /** True while tokens are still arriving. Words created while false never animate. */
  streaming: boolean;
  mode?: StreamingMode;
  /**
   * Render prop for rich text (markdown). It receives the full text and its output is shown as-is:
   * markdown re-parses the whole string each token, so per-word identity cannot be kept there.
   */
  render?: (text: string) => ReactNode;
  /** Blinking caret after the last word while streaming. */
  caret?: boolean;
  className?: string;
}

const TOKEN = /\S+|\s+/g;

/** One word. Animates once, on mount, with WAAPI (no per-word motion component: cheap at 50 tokens/s). */
const Word = memo(function Word({
  index,
  word,
  animate,
  mode,
}: {
  index: number;
  word: string;
  animate: boolean;
  mode: 'words' | 'blur';
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!animate || !el || typeof el.animate !== 'function') return;
    const from =
      mode === 'blur'
        ? { opacity: 0, filter: 'blur(6px)' }
        : { opacity: 0, transform: 'translateY(4px)' };
    const to =
      mode === 'blur'
        ? { opacity: 1, filter: 'blur(0px)' }
        : { opacity: 1, transform: 'translateY(0)' };
    el.animate([from, to], { duration: 320, easing: 'ease-out', fill: 'backwards' });
    // Mount-only: later text growth of a partial word must not restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <span ref={ref} data-w={index} className="inline-block">
      {word}
    </span>
  );
});

/**
 * Reveals newly appended text as tokens arrive. Words are stable keyed nodes: when `text` grows only
 * the new tail mounts (and animates); existing words are never re-created or re-animated.
 */
export function StreamingText({
  text,
  streaming,
  mode = 'words',
  render,
  caret = false,
  className,
}: StreamingTextProps) {
  const reduced = useReducedMotionConfig();
  const effective: StreamingMode = reduced ? 'none' : mode;
  const root = 'whitespace-pre-wrap break-words';

  if (render) {
    return (
      <div data-fx-component="StreamingText" data-streaming={streaming} className={cn(className)}>
        {render(text)}
      </div>
    );
  }
  if (effective === 'none') {
    return (
      <div data-fx-component="StreamingText" data-streaming={streaming} className={cn(root, className)}>
        {text}
      </div>
    );
  }

  const tokens = text.match(TOKEN) ?? [];
  return (
    <div data-fx-component="StreamingText" data-streaming={streaming} className={cn(root, className)}>
      {tokens.map((t, i) =>
        /^\s/.test(t) ? (
          t
        ) : (
          <Word key={i} index={i} word={t} mode={effective} animate={streaming} />
        ),
      )}
      {caret && streaming ? (
        <span aria-hidden="true" className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-foreground" />
      ) : null}
    </div>
  );
}
