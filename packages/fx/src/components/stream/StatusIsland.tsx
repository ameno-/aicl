import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotionConfig } from 'motion/react';
import { AlertTriangle, Check, Hand, Moon, Sparkles } from 'lucide-react';
import { cn } from '../../lib/cn.ts';
import { BarsSpinner } from '../../vendor/spell-ui/bars-spinner.tsx';

export type IslandStatus = 'idle' | 'thinking' | 'working' | 'waiting' | 'error' | 'done';

export interface StatusIslandProps {
  status: IslandStatus;
  label?: string;
  detail?: string;
  className?: string;
}

const DEFAULT_LABEL: Record<IslandStatus, string> = {
  idle: 'Idle',
  thinking: 'Thinking',
  working: 'Working',
  waiting: 'Needs you',
  error: 'Something went wrong',
  done: 'Done',
};

const TONE: Record<IslandStatus, string> = {
  idle: 'text-muted-foreground',
  thinking: 'text-primary',
  working: 'text-primary',
  waiting: 'text-warning',
  error: 'text-destructive',
  done: 'text-success',
};

function icon(status: IslandStatus): ReactNode {
  const p = { size: 14, strokeWidth: 2.25, 'aria-hidden': true } as const;
  switch (status) {
    case 'thinking':
      return <Sparkles {...p} />;
    case 'working':
      return <BarsSpinner size={14} />;
    case 'waiting':
      return <Hand {...p} />;
    case 'error':
      return <AlertTriangle {...p} />;
    case 'done':
      return <Check {...p} />;
    default:
      return <Moon {...p} />;
  }
}

/** Dynamic-island pill: width, icon and text morph between states with layout animation. */
export function StatusIsland({ status, label, detail, className }: StatusIslandProps) {
  const reduced = useReducedMotionConfig() ?? false;
  const spring = reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 34 };
  return (
    <div data-fx-component="StatusIsland" data-status={status} className={cn('flex h-10 items-center justify-center', className)}>
      <motion.div
        layout
        transition={spring}
        role="status"
        style={{ borderRadius: 999 }}
        className="inline-flex h-9 items-center gap-2 overflow-hidden border border-border bg-card px-3 text-sm shadow-sm"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={status}
            layout="position"
            className={cn('inline-flex shrink-0', TONE[status])}
            initial={reduced ? false : { scale: 0.5, opacity: 0, filter: 'blur(3px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={spring}
          >
            {icon(status)}
          </motion.span>
        </AnimatePresence>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={`${status}:${label ?? ''}`}
            layout="position"
            className="whitespace-nowrap font-medium"
            initial={reduced ? false : { opacity: 0, y: 6, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
          >
            {label ?? DEFAULT_LABEL[status]}
          </motion.span>
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {detail ? (
            <motion.span
              key={detail}
              layout="position"
              className="whitespace-nowrap text-xs text-muted-foreground"
              initial={reduced ? false : { opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
            >
              {detail}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
