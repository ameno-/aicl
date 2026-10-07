import { motion, useReducedMotionConfig } from 'motion/react';
import { cn } from '../../lib/cn.ts';
import { ShimmerText } from '../../vendor/spell-ui/shimmer-text.tsx';
import { BarsSpinner } from '../../vendor/spell-ui/bars-spinner.tsx';
import { formatSeconds } from './format.ts';

export interface ThinkingIndicatorProps {
  label?: string;
  /** Elapsed time while thinking, or the final duration when `done`. */
  elapsedMs?: number;
  variant?: 'shimmer' | 'dots' | 'bars';
  /** Finished: shows "Thought for 24s" with no animation. */
  done?: boolean;
  className?: string;
}

function Dots({ still }: { still: boolean }) {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground"
          animate={still ? { opacity: 0.6 } : { opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}

/** "Thinking… 3s" with shimmer / dots / bars; collapses to "Thought for 24s" when done. */
export function ThinkingIndicator({
  label = 'Thinking',
  elapsedMs,
  variant = 'shimmer',
  done = false,
  className,
}: ThinkingIndicatorProps) {
  const reduced = useReducedMotionConfig() ?? false;
  const secs = elapsedMs === undefined ? '' : formatSeconds(elapsedMs);
  const text = done ? `Thought${secs ? ` for ${secs}` : ''}` : `${label}…`;
  return (
    <div
      data-fx-component="ThinkingIndicator"
      data-state={done ? 'done' : 'thinking'}
      data-variant={variant}
      role="status"
      className={cn('inline-flex h-6 items-center gap-2 text-sm text-muted-foreground', className)}
    >
      {!done && variant === 'bars' ? <BarsSpinner size={14} /> : null}
      {!done && variant === 'dots' ? <Dots still={reduced} /> : null}
      <div className="font-medium">
        {done || reduced || variant !== 'shimmer' ? text : <ShimmerText delay={0}>{text}</ShimmerText>}
      </div>
      {!done && secs ? <span className="tabular-nums text-faint">{secs}</span> : null}
    </div>
  );
}
