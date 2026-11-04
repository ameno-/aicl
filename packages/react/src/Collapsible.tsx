/**
 * Collapsible.
 *
 * A disclosure. `ReasoningDisclosure` is the chat-shaped one; this is the
 * general primitive Fluid and LooseLeaf both ship. Height is not animated
 * — AICL animates opacity, so reduced motion can drop the travel.
 *
 * Compound: `Collapsible.Trigger`, `Collapsible.Content`.
 */

import {
  createContext,
  useContext,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { useControllableState } from './controllable.js';
import { Icon } from './icons.js';

export interface CollapsibleProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

interface CollapsibleContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerId: string;
  contentId: string;
}

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

function useCollapsible(): CollapsibleContextValue {
  const ctx = useContext(CollapsibleContext);
  if (!ctx) throw new Error('Collapsible parts must be rendered inside <Collapsible>.');
  return ctx;
}

function CollapsibleRoot({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: CollapsibleProps) {
  const [open, setOpen] = useControllableState(openProp, defaultOpen, onOpenChange);
  const triggerId = useId();
  const contentId = useId();

  return (
    <CollapsibleContext.Provider value={{ open, setOpen, triggerId, contentId }}>
      <div data-aicl="collapsible" data-state={open ? 'open' : 'closed'}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

export interface CollapsibleTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
}

export function CollapsibleTrigger({ children, ...rest }: CollapsibleTriggerProps) {
  const { open, setOpen, triggerId, contentId } = useCollapsible();
  return (
    <button
      {...rest}
      type={rest.type ?? 'button'}
      id={triggerId}
      aria-expanded={open}
      aria-controls={contentId}
      data-aicl="collapsible-trigger"
      data-state={open ? 'open' : 'closed'}
      onClick={(event) => {
        rest.onClick?.(event);
        if (!event.defaultPrevented) setOpen(!open);
      }}
    >
      <span data-aicl="collapsible-icon" data-state={open ? 'open' : 'closed'}>
        <Icon name="chevron-down" />
      </span>
      {children}
    </button>
  );
}

export interface CollapsibleContentProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export function CollapsibleContent({ children, ...rest }: CollapsibleContentProps) {
  const { open, contentId } = useCollapsible();
  return (
    <div
      {...rest}
      id={contentId}
      role="region"
      hidden={!open}
      data-aicl="collapsible-content"
      data-state={open ? 'open' : 'closed'}
    >
      {children}
    </div>
  );
}

export const Collapsible = Object.assign(CollapsibleRoot, {
  Trigger: CollapsibleTrigger,
  Content: CollapsibleContent,
});
