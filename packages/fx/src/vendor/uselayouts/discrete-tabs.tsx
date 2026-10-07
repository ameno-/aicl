/**
 * Vendored from iurvish/uselayouts
 * Path: registry/default/example/discrete-tabs.tsx
 * Commit: 07cc4f4fb8e0
 * Licence: MIT (see packages/fx/ATTRIBUTION.md)
 * Adapted: the demo's hard-coded tab list and inline SVG icons are replaced by
 * a props-driven DiscreteTabButton (icon is a ReactNode); layout ids are scoped
 * per instance; real tab semantics (role=tab, aria-selected); cn import.
 */
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';

const spring = { type: 'spring', damping: 20, stiffness: 230, mass: 1.2 } as const;

export interface DiscreteTabButtonProps {
  id: string;
  title: string;
  icon?: ReactNode;
  isActive: boolean;
  onSelect: () => void;
  scope: string;
  panelId?: string;
}

/** The pill from uselayouts' discrete tabs: it widens to reveal its label when active. */
export function DiscreteTabButton({ id, title, icon, isActive, onSelect, scope, panelId }: DiscreteTabButtonProps) {
  return (
    <motion.button
      type="button"
      role="tab"
      id={`${scope}-tab-${id}`}
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      layout
      transition={{ layout: spring }}
      onClick={onSelect}
      className={cn(
        'flex h-fit w-fit cursor-pointer items-center gap-1.5 overflow-hidden rounded-[25px] bg-secondary p-3 font-mono text-sm font-medium uppercase outline outline-2 outline-border transition-colors duration-75 ease-out focus-visible:outline-ring',
        isActive ? 'px-4 text-primary' : 'px-3 text-muted-foreground',
      )}
    >
      {icon ? <span className="flex shrink-0 items-center [&>svg]:size-[18px]">{icon}</span> : null}
      <AnimatePresence initial={false}>
        {isActive || !icon ? (
          <motion.span
            key="label"
            initial={{ opacity: 0, filter: 'blur(4px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(4px)' }}
            transition={{ duration: 0.2, ease: [0.86, 0, 0.07, 1] }}
            className="relative inline-block whitespace-nowrap"
          >
            {title}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </motion.button>
  );
}
