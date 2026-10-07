import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { forwardRef, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  /** ms; 0 keeps the toast until dismissed. */
  duration: number;
}

export interface ToastOptions {
  description?: string;
  duration?: number;
  id?: string;
}

let items: ToastItem[] = [];
const listeners = new Set<() => void>();
let seq = 0;
const emit = () => listeners.forEach((l) => l());

function push(kind: ToastKind, title: string, opts: ToastOptions = {}): string {
  const id = opts.id ?? `t${++seq}`;
  const item: ToastItem = { id, kind, title, description: opts.description, duration: opts.duration ?? (kind === 'error' ? 6000 : 4000) };
  items = [...items.filter((t) => t.id !== id), item].slice(-5);
  emit();
  return id;
}

/** Imperative toasts. Mount one <Toaster /> anywhere. */
export const toast = Object.assign((title: string, opts?: ToastOptions) => push('info', title, opts), {
  success: (title: string, opts?: ToastOptions) => push('success', title, opts),
  error: (title: string, opts?: ToastOptions) => push('error', title, opts),
  info: (title: string, opts?: ToastOptions) => push('info', title, opts),
  dismiss: (id?: string) => {
    items = id ? items.filter((t) => t.id !== id) : [];
    emit();
  },
});

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const snapshot = () => items;

const icons: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 size={18} className="text-success" />,
  error: <TriangleAlert size={18} className="text-destructive" />,
  info: <Info size={18} className="text-info" />,
};

export interface ToasterProps {
  position?: 'bottom-right' | 'bottom-center' | 'top-right';
  className?: string;
}

export function Toaster({ position = 'bottom-right', className }: ToasterProps) {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  const top = position.startsWith('top');
  return (
    <div
      data-fx-component="toaster"
      aria-live="polite"
      aria-label="Notifications"
      role="region"
      className={cn(
        'pointer-events-none fixed z-[100] flex w-[min(92vw,360px)] gap-2',
        top ? 'top-4 flex-col' : 'bottom-4 flex-col-reverse',
        position === 'bottom-center' ? 'left-1/2 -translate-x-1/2' : 'right-4',
        className,
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {[...list].reverse().map((t) => (
          <ToastView key={t.id} item={t} top={top} />
        ))}
      </AnimatePresence>
    </div>
  );
}

const ToastView = forwardRef<HTMLDivElement, { item: ToastItem; top: boolean }>(function ToastView({ item, top }, ref) {
  const hovered = useRef(false);
  useEffect(() => {
    if (!item.duration) return;
    let left = item.duration;
    let last = Date.now();
    const iv = setInterval(() => {
      const now = Date.now();
      if (!hovered.current) left -= now - last;
      last = now;
      if (left <= 0) toast.dismiss(item.id);
    }, 100);
    return () => clearInterval(iv);
  }, [item.id, item.duration]);

  return (
    <motion.div
      ref={ref}
      layout
      role={item.kind === 'error' ? 'alert' : 'status'}
      data-toast={item.kind}
      initial={{ opacity: 0, y: top ? -24 : 24, scale: 0.92, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(4px)', transition: { duration: 0.15 } }}
      transition={{ type: 'spring', damping: 26, stiffness: 340 }}
      onHoverStart={() => (hovered.current = true)}
      onHoverEnd={() => (hovered.current = false)}
      className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border border-border bg-popover p-3 pr-9 text-popover-foreground shadow-lg"
    >
      <span className="mt-0.5 flex shrink-0">{icons[item.kind]}</span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{item.title}</span>
        {item.description ? <span className="text-xs text-muted-foreground">{item.description}</span> : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => toast.dismiss(item.id)}
        className="absolute right-2 top-2 flex size-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
});
