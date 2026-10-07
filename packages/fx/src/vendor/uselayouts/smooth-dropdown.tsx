/**
 * Vendored from iurvish/uselayouts
 * Path: registry/default/example/smooth-dropdown.tsx
 * Commit: 07cc4f4fb8e0
 * Licence: MIT (see packages/fx/ATTRIBUTION.md)
 * Adapted: the demo's fixed menu becomes a props-driven option list (id, label,
 * description, icon); hugeicons/react-use-measure dropped (motion animates
 * height:auto); the spring-eased panel, staggered rows and shared-layout
 * active indicator are kept. Added: separate trigger, listbox semantics,
 * arrow/Home/End/Enter/Escape keys, click-outside, focus return, open direction.
 */
import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';

export interface DropdownOption {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

export interface SmoothDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name of the list and trigger. */
  label?: string;
  /** Which way the list opens. Composers dock to the bottom, so default is up. */
  direction?: 'up' | 'down';
  align?: 'start' | 'end';
  /** Custom trigger content; defaults to the selected option's label. */
  trigger?: ReactNode;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  width?: number;
  'data-fx-component'?: string;
}

const easeOutQuint: [number, number, number, number] = [0.23, 1, 0.32, 1];
const indicatorSpring = { type: 'spring', damping: 30, stiffness: 520, mass: 0.8 } as const;

export function SmoothDropdown({
  options,
  value,
  onChange,
  label = 'Options',
  direction = 'up',
  align = 'start',
  trigger,
  className,
  triggerClassName,
  disabled,
  width = 260,
  'data-fx-component': fx = 'smooth-dropdown',
}: SmoothDropdownProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const uid = useId();
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setActive(Math.max(0, options.findIndex((o) => o.id === value)));
      listRef.current?.focus({ preventScroll: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const pick = (id: string) => {
    onChange(id);
    close(true);
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const n = options.length;
    if (!n) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % n);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + n) % n);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(n - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const o = options[active];
      if (o) pick(o.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  const up = direction === 'up';
  return (
    <div ref={rootRef} data-fx-component={fx} className={cn('relative inline-block', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        aria-controls={open ? `${uid}-list` : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50',
          triggerClassName,
        )}
      >
        {trigger ?? (
          <>
            {selected?.icon}
            <span className="truncate">{selected?.label ?? 'Select'}</span>
          </>
        )}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, height: 0, scale: 0.96 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.96, transition: { duration: 0.14, ease: easeOutQuint } }}
            transition={{ type: 'spring', damping: 34, stiffness: 380, mass: 0.8 }}
            style={{ width, transformOrigin: `${up ? 'bottom' : 'top'} ${align === 'end' ? 'right' : 'left'}` }}
            className={cn(
              'absolute z-50 max-w-[85vw] overflow-hidden rounded-[14px] border border-border bg-popover text-popover-foreground shadow-lg',
              up ? 'bottom-full mb-2' : 'top-full mt-2',
              align === 'end' ? 'right-0' : 'left-0',
            )}
          >
            <ul
              ref={listRef}
              id={`${uid}-list`}
              role="listbox"
              aria-label={label}
              aria-activedescendant={`${uid}-opt-${active}`}
              tabIndex={-1}
              onKeyDown={onListKey}
              className="m-0 flex list-none flex-col gap-0.5 p-2 outline-none"
            >
              {options.map((o, i) => {
                const isActive = i === active;
                const isSelected = o.id === value;
                return (
                  <motion.li
                    key={o.id}
                    id={`${uid}-opt-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    data-active={isActive ? '' : undefined}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 + i * 0.02, duration: 0.15, ease: easeOutQuint }}
                    onClick={() => pick(o.id)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      'relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200',
                      isActive ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {isActive ? (
                      <>
                        <motion.div
                          layoutId={`${uid}-bg`}
                          className="absolute inset-0 rounded-lg bg-muted"
                          transition={indicatorSpring}
                        />
                        <motion.div
                          layoutId={`${uid}-bar`}
                          className="absolute bottom-0 left-0 top-0 my-auto h-5 w-[3px] rounded-full bg-foreground"
                          transition={indicatorSpring}
                        />
                      </>
                    ) : null}
                    {o.icon ? <span className="relative z-10 flex shrink-0 items-center">{o.icon}</span> : null}
                    <span className="relative z-10 flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{o.label}</span>
                      {o.description ? <span className="truncate text-xs text-muted-foreground">{o.description}</span> : null}
                    </span>
                    {isSelected ? <Check size={14} className="relative z-10 shrink-0 text-primary" aria-hidden="true" /> : null}
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
