import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';

export interface SidePanelProps {
  open: boolean;
  side?: 'left' | 'right';
  title: string;
  children?: ReactNode;
  onClose: () => void;
  /** `absolute` fills the nearest positioned ancestor (a work pane); `fixed` covers the viewport. */
  placement?: 'absolute' | 'fixed';
  width?: number;
  className?: string;
}

/** Sliding panel for a work or preview pane. Non-modal; Escape closes; focus moves in and returns. */
export function SidePanel({ open, side = 'right', title, children, onClose, placement = 'absolute', width = 360, className }: SidePanelProps) {
  const ref = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const dir = side === 'right' ? 1 : -1;

  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      requestAnimationFrame(() => ref.current?.focus());
    } else {
      returnFocus.current?.focus?.();
    }
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="panel"
          ref={ref}
          data-fx-component="side-panel"
          data-side={side}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          initial={{ x: `${100 * dir}%`, opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: `${100 * dir}%`, opacity: 0 }}
          transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.9 }}
          style={{ width }}
          className={cn(
            'z-40 flex max-w-full flex-col border-border bg-card text-card-foreground shadow-xl outline-none',
            placement,
            'inset-y-0',
            side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
            className,
          )}
        >
          <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
            <h2 id={titleId} className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              {title}
            </h2>
            <button
              type="button"
              aria-label="Close panel"
              onClick={onClose}
              className="flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X size={16} />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-auto p-4 text-sm">{children}</div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
