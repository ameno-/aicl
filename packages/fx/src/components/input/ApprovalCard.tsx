import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, ShieldAlert, X } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';

export type ApprovalState = 'pending' | 'approved' | 'denied';

export interface ApprovalCardProps {
  tool: string;
  summary: string;
  details?: ReactNode;
  state?: ApprovalState;
  onApprove: () => void;
  onDeny: (note?: string) => void;
  className?: string;
}

const spring = { type: 'spring', damping: 22, stiffness: 320 } as const;

/** Tool-approval request. Resolves with a state morph: icon swap, tint, buttons fold away. */
export function ApprovalCard({ tool, summary, details, state = 'pending', onApprove, onDeny, className }: ApprovalCardProps) {
  const [open, setOpen] = useState(false);
  const [denying, setDenying] = useState(false);
  const [note, setNote] = useState('');
  const detailsId = useId();
  const noteId = useId();
  const pending = state === 'pending';
  useEffect(() => {
    if (state === 'pending') {
      setDenying(false);
      setNote('');
    }
  }, [state]);

  return (
    <motion.section
      data-fx-component="approval-card"
      data-state={state}
      role="group"
      aria-label={`Approval needed: ${tool}`}
      layout
      transition={spring}
      className={cn(
        'w-full max-w-md overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm transition-colors duration-300',
        state === 'approved' && 'border-success',
        state === 'denied' && 'border-destructive',
        pending && 'border-border',
        className,
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <motion.span
          layout
          className={cn(
            'relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full transition-colors duration-300',
            state === 'approved' && 'bg-success text-background',
            state === 'denied' && 'bg-destructive text-background',
            pending && 'bg-muted text-muted-foreground',
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={state}
              initial={{ scale: 0.3, rotate: -60, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.3, opacity: 0 }}
              transition={spring}
              className="flex"
            >
              {state === 'approved' ? <Check size={18} /> : state === 'denied' ? <X size={18} /> : <ShieldAlert size={18} />}
            </motion.span>
          </AnimatePresence>
        </motion.span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{tool}</code>
            <span
              role="status"
              className={cn(
                'text-xs font-medium',
                state === 'approved' && 'text-success',
                state === 'denied' && 'text-destructive',
                pending && 'text-muted-foreground',
              )}
            >
              {pending ? 'Needs approval' : state === 'approved' ? 'Approved' : 'Denied'}
            </span>
          </div>
          <p className="m-0 text-sm text-foreground">{summary}</p>
          {details ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={detailsId}
              onClick={() => setOpen((o) => !o)}
              className="mt-1 inline-flex w-fit cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Details
              <motion.span animate={{ rotate: open ? 180 : 0 }} className="flex">
                <ChevronDown size={12} />
              </motion.span>
            </button>
          ) : null}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && details ? (
          <motion.div
            key="details"
            id={detailsId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
            className="overflow-hidden"
          >
            <div className="mx-4 mb-3 max-h-48 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs text-foreground">{details}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {pending ? (
          <motion.div
            key="actions"
            initial={false}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 px-4 pb-4">
              <AnimatePresence initial={false}>
                {denying ? (
                  <motion.div
                    key="note"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <label htmlFor={noteId} className="sr-only">
                      Reason for denying (optional)
                    </label>
                    <input
                      id={noteId}
                      autoFocus
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onDeny(note.trim() || undefined);
                        if (e.key === 'Escape') setDenying(false);
                      }}
                      placeholder="Tell the agent why (optional)"
                      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
              <div className="flex gap-2">
                {denying ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onDeny(note.trim() || undefined)}
                      className="h-9 flex-1 cursor-pointer rounded-lg bg-destructive px-3 text-sm font-medium text-background hover:opacity-90"
                    >
                      Confirm deny
                    </button>
                    <button
                      type="button"
                      onClick={() => setDenying(false)}
                      className="h-9 cursor-pointer rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={onApprove}
                      className="h-9 flex-1 cursor-pointer rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setDenying(true)}
                      className="h-9 flex-1 cursor-pointer rounded-lg border border-border px-3 text-sm text-foreground hover:bg-muted"
                    >
                      Deny
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
