import { useEffect, useRef } from 'react';
import { motion, useReducedMotionConfig } from 'motion/react';
import { cn } from '../../lib/cn.ts';

export interface LiveTerminalProps {
  lines: string[];
  running: boolean;
  /** Set when finished; 0 is success. */
  exitCode?: number;
  command?: string;
  className?: string;
}

/** Terminal surface: new lines slide in, a cursor blinks while running, an exit badge shows the result. */
export function LiveTerminal({ lines, running, exitCode, command, className }: LiveTerminalProps) {
  const reduced = useReducedMotionConfig() ?? false;
  const scroller = useRef<HTMLDivElement>(null);
  /** Lines present at mount appear instantly; only later lines slide in. */
  const baseline = useRef(lines.length);
  if (lines.length < baseline.current) baseline.current = 0;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  const finished = !running && exitCode !== undefined;
  return (
    <div
      data-fx-component="LiveTerminal"
      data-running={running}
      className={cn('overflow-hidden rounded-lg border border-border bg-terminal text-terminal-foreground', className)}
    >
      <div className="flex h-8 items-center gap-2 border-b border-white/10 px-3 font-mono text-xs">
        <span className="min-w-0 flex-1 truncate opacity-80">{command ? `$ ${command}` : 'terminal'}</span>
        {running ? <span className="opacity-60">running</span> : null}
        {finished ? (
          <span
            data-exit={exitCode}
            className={cn(
              'rounded px-1.5 py-0.5 font-medium',
              exitCode === 0 ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive',
            )}
          >
            exit {exitCode}
          </span>
        ) : null}
      </div>
      <div
        ref={scroller}
        role="log"
        aria-live="off"
        tabIndex={0}
        className="h-40 overflow-auto px-3 py-2 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {lines.map((line, i) => (
          <motion.div
            key={i}
            className="whitespace-pre-wrap break-all"
            initial={i >= baseline.current && !reduced ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {line || ' '}
          </motion.div>
        ))}
        {running ? (
          <motion.span
            aria-hidden="true"
            data-cursor=""
            className="inline-block h-[1.1em] w-[0.55em] translate-y-[2px] bg-terminal-foreground"
            animate={reduced ? { opacity: 1 } : { opacity: [1, 1, 0, 0] }}
            transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1], ease: 'linear' }}
          />
        ) : null}
      </div>
    </div>
  );
}
