import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';

export interface Suggestion {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
}

export interface SuggestionStackProps {
  suggestions: Suggestion[];
  onPick: (suggestion: Suggestion) => void;
  className?: string;
}

const VISIBLE = 3;

/**
 * Stacked suggestion cards for empty states (agent-suggest card-stack idea).
 * Click the front card to pick it; swipe it, or use the arrows, to send it to the back.
 */
export function SuggestionStack({ suggestions, onPick, className }: SuggestionStackProps) {
  const [order, setOrder] = useState(0);
  const n = suggestions.length;
  if (n === 0) return null;
  const at = (i: number) => suggestions[(order + i) % n]!;
  const step = (dir: 1 | -1) => setOrder((o) => (o + dir + n) % n);
  const shown = Math.min(VISIBLE, n);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 70 || Math.abs(info.velocity.x) > 500) step(info.offset.x < 0 ? 1 : -1);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    }
  };

  return (
    <div
      data-fx-component="suggestion-stack"
      role="group"
      aria-roledescription="carousel"
      aria-label="Suggestions"
      onKeyDown={onKeyDown}
      className={cn('flex w-full max-w-sm flex-col gap-3', className)}
    >
      <div className="relative h-32" style={{ marginBottom: (shown - 1) * 10 }}>
        <AnimatePresence initial={false}>
          {Array.from({ length: shown }, (_, depth) => shown - 1 - depth).map((depth) => {
            const s = at(depth);
            const front = depth === 0;
            return (
              <motion.div
                key={s.id}
                data-depth={depth}
                drag={front ? 'x' : false}
                dragSnapToOrigin
                dragElastic={0.6}
                onDragEnd={front ? onDragEnd : undefined}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1 - depth * 0.15, scale: 1 - depth * 0.05, y: depth * 10 }}
                exit={{ opacity: 0, scale: 0.9, pointerEvents: 'none' }}
                transition={{ type: 'spring', damping: 26, stiffness: 300 }}
                style={{ zIndex: shown - depth, transformOrigin: 'bottom center' }}
                className="absolute inset-x-0 top-0 h-32"
              >
                <button
                  type="button"
                  tabIndex={front ? 0 : -1}
                  aria-hidden={front ? undefined : true}
                  onClick={() => front && onPick(s)}
                  className={cn(
                    'flex size-full flex-col items-start gap-1.5 rounded-2xl border border-border bg-card p-4 text-left shadow-md focus-visible:outline-2 focus-visible:outline-ring',
                    front ? 'cursor-pointer hover:border-ring' : 'pointer-events-none',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {s.icon}
                    {s.title}
                  </span>
                  {s.description ? <span className="line-clamp-3 text-sm text-muted-foreground">{s.description}</span> : null}
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {n > 1 ? (
        <div className="flex items-center justify-center gap-3 text-muted-foreground">
          <button
            type="button"
            aria-label="Previous suggestion"
            onClick={() => step(-1)}
            className="flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs tabular-nums" aria-live="polite">
            {order + 1} / {n}
          </span>
          <button
            type="button"
            aria-label="Next suggestion"
            onClick={() => step(1)}
            className="flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-muted hover:text-foreground"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
