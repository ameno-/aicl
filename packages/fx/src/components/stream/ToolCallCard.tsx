import { useId, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotionConfig } from 'motion/react';
import { Ban, Check, ChevronRight, Clock, Wrench, X } from 'lucide-react';
import { cn } from '../../lib/cn.ts';
import { Spinner } from '../../vendor/spell-ui/spinner.tsx';
import { BorderBeam } from './BorderBeam.tsx';
import { Collapse } from './Collapse.tsx';

export type ToolStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled';

export interface ToolCallCardProps {
  /** Machine name, e.g. "read_file". */
  name: string;
  /** Human label, e.g. "Read src/index.ts". */
  label: string;
  status: ToolStatus;
  args?: unknown;
  result?: unknown;
  durationMs?: number;
  /** Replaces the default tool icon. */
  icon?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

const show = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v, null, 2));

function StatusIcon({ status }: { status: ToolStatus }) {
  const reduced = useReducedMotionConfig() ?? false;
  const common = { size: 14, strokeWidth: 2.5, 'aria-hidden': true } as const;
  const node =
    status === 'running' ? (
      <Spinner size="sm" className="text-primary" />
    ) : status === 'success' ? (
      <Check {...common} className="text-success" />
    ) : status === 'error' ? (
      <X {...common} className="text-destructive" />
    ) : status === 'cancelled' ? (
      <Ban {...common} className="text-muted-foreground" />
    ) : (
      <Clock {...common} className="text-faint" />
    );
  return (
    <span className="relative inline-flex size-4 items-center justify-center" data-status-icon={status}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={status}
          className="inline-flex"
          initial={reduced ? false : { scale: 0.4, opacity: 0, rotate: -45 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={reduced ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
        >
          {node}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Compact tool-call row: icon morphs with status, border beam while running, expands to args/result. */
export function ToolCallCard({
  name,
  label,
  status,
  args,
  result,
  durationMs,
  icon,
  defaultOpen = false,
  className,
}: ToolCallCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const reduced = useReducedMotionConfig() ?? false;
  const bodyId = useId();
  const expandable = args !== undefined || result !== undefined;
  return (
    <div
      data-fx-component="ToolCallCard"
      data-status={status}
      className={cn(
        'relative rounded-lg border bg-card text-sm text-card-foreground',
        status === 'error' ? 'border-destructive/50' : 'border-border',
        className,
      )}
    >
      <BorderBeam active={status === 'running'} />
      <button
        type="button"
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        aria-controls={expandable ? bodyId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center gap-2 rounded-[inherit] px-3 text-left outline-none enabled:hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          {icon ?? <Wrench size={14} aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        <span className="hidden shrink-0 font-mono text-xs text-faint sm:inline">{name}</span>
        {durationMs !== undefined ? (
          <span className="shrink-0 tabular-nums text-xs text-faint">{(durationMs / 1000).toFixed(1)}s</span>
        ) : null}
        <StatusIcon status={status} />
        {expandable ? (
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: reduced ? 0 : 0.2 }} className="inline-flex text-faint">
            <ChevronRight size={14} aria-hidden="true" />
          </motion.span>
        ) : null}
      </button>
      {expandable ? (
        <Collapse open={open} id={bodyId}>
          <div className="flex flex-col gap-2 border-t border-border px-3 py-2">
            {args !== undefined ? (
              <section>
                <div className="mb-1 text-xs uppercase tracking-wide text-faint">Arguments</div>
                <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-xs">{show(args)}</pre>
              </section>
            ) : null}
            {result !== undefined ? (
              <section>
                <div className="mb-1 text-xs uppercase tracking-wide text-faint">
                  {status === 'error' ? 'Error' : 'Result'}
                </div>
                <pre
                  className={cn(
                    'max-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-xs',
                    status === 'error' && 'text-destructive',
                  )}
                >
                  {show(result)}
                </pre>
              </section>
            ) : null}
          </div>
        </Collapse>
      ) : null}
    </div>
  );
}
