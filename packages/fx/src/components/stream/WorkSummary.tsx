import { useId, useState, type ReactNode } from 'react';
import { motion, useReducedMotionConfig } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn.ts';
import { ShimmerText } from '../../vendor/spell-ui/shimmer-text.tsx';
import { Collapse } from './Collapse.tsx';

export interface WorkSummaryProps {
  seconds: number;
  /** Finished work; the running form reads "Working… 7s" with a shimmer. */
  running?: boolean;
  /** The steps that were taken, shown when expanded. */
  steps?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

/** Devin-style "Worked for 11s" disclosure; animates open/close. */
export function WorkSummary({ seconds, running = false, steps, defaultOpen = false, className }: WorkSummaryProps) {
  const [open, setOpen] = useState(defaultOpen);
  const reduced = useReducedMotionConfig() ?? false;
  const bodyId = useId();
  const s = Math.max(0, Math.floor(seconds));
  const label = running ? `Working… ${s}s` : `Worked for ${s}s`;
  const expandable = steps !== undefined && steps !== null;
  return (
    <div
      data-fx-component="WorkSummary"
      data-state={running ? 'running' : 'done'}
      className={cn('flex flex-col text-sm', className)}
    >
      <button
        type="button"
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        aria-controls={expandable ? bodyId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="group inline-flex h-7 w-fit items-center gap-1 rounded-md pr-1 text-muted-foreground outline-none enabled:hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="font-medium tabular-nums">
          {running && !reduced ? <ShimmerText delay={0}>{label}</ShimmerText> : label}
        </div>
        {expandable ? (
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: reduced ? 0 : 0.2 }} className="inline-flex">
            <ChevronRight size={14} aria-hidden="true" />
          </motion.span>
        ) : null}
      </button>
      {expandable ? (
        <Collapse open={open} id={bodyId}>
          <div className="mt-1 ml-1 border-l border-border pl-3 text-muted-foreground">{steps}</div>
        </Collapse>
      ) : null}
    </div>
  );
}
