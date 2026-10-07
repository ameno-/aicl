import { motion } from 'motion/react';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';
import { DiscreteTabButton } from '../../vendor/uselayouts/discrete-tabs.tsx';

export interface SegmentedTab {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedTabsProps {
  tabs: SegmentedTab[];
  value: string;
  onChange: (id: string) => void;
  /** `segmented`: sliding indicator. `discrete`: uselayouts pills that widen to show the label. */
  variant?: 'segmented' | 'discrete';
  label?: string;
  className?: string;
}

export function SegmentedTabs({ tabs, value, onChange, variant = 'segmented', label = 'Tabs', className }: SegmentedTabsProps) {
  const scope = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const t = tabs[next];
    if (!t) return;
    onChange(t.id);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[id="${scope}-tab-${t.id}"]`)?.focus());
  };

  return (
    <div
      ref={listRef}
      data-fx-component="segmented-tabs"
      data-variant={variant}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        variant === 'segmented'
          ? 'relative inline-flex gap-0.5 rounded-full bg-muted p-1'
          : 'inline-flex items-center gap-3',
        className,
      )}
    >
      {tabs.map((t) =>
        variant === 'discrete' ? (
          <DiscreteTabButton
            key={t.id}
            id={t.id}
            scope={scope}
            title={t.label}
            icon={t.icon}
            isActive={t.id === value}
            onSelect={() => onChange(t.id)}
          />
        ) : (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${scope}-tab-${t.id}`}
            aria-selected={t.id === value}
            tabIndex={t.id === value ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
              t.id === value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.id === value ? (
              <motion.span
                layoutId={`${scope}-indicator`}
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-background shadow-sm"
                transition={{ type: 'spring', damping: 30, stiffness: 420, mass: 0.8 }}
              />
            ) : null}
            {t.icon ? <span className="relative z-10 flex">{t.icon}</span> : null}
            <span className="relative z-10">{t.label}</span>
          </button>
        ),
      )}
    </div>
  );
}
