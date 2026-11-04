/**
 * Collapsible and Accordion.
 *
 * One panel that folds, and a list of them. The panel's height animates
 * in CSS (grid rows, from nothing to the content), and the chevron turns
 * with it. Both sample libraries animate a disclosure this way; AICL's
 * reasoning row is the chat-specific one, and these two are the general
 * shape it can sit beside.
 *
 * Closed content stays mounted. It is `visibility: hidden` while shut, so
 * it is not read and not tabbed to, and the height can still animate.
 */

import { createContext, useContext, useId, type ReactNode } from 'react';

import { Icon } from './icons.js';
import { useControllable } from './useControllable.js';

/* -------------------------------------------------------------------------- */
/* Collapsible                                                                 */
/* -------------------------------------------------------------------------- */

interface CollapsibleContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  baseId: string;
}

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

function useCollapsible(): CollapsibleContextValue {
  const context = useContext(CollapsibleContext);
  if (!context) throw new Error('Collapsible.Trigger and Collapsible.Panel must be inside Collapsible');
  return context;
}

export interface CollapsibleProps {
  /** Whether the panel is open, when the caller owns it. */
  open?: boolean;
  /** Whether the panel starts open. */
  defaultOpen?: boolean;
  /** Fires with the next open state. */
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

/** One disclosure. */
export function Collapsible({ open, defaultOpen = false, onOpenChange, children }: CollapsibleProps) {
  const [current, setCurrent] = useControllable(open, defaultOpen, onOpenChange);
  const baseId = useId();

  return (
    <CollapsibleContext.Provider value={{ open: current, setOpen: setCurrent, baseId }}>
      <div data-aicl="collapsible" data-state={current ? 'open' : 'closed'}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

function CollapsibleTrigger({ children }: { children?: ReactNode }) {
  const { open, setOpen, baseId } = useCollapsible();

  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={baseId}
      data-aicl="collapsible-trigger"
      onClick={() => setOpen(!open)}
    >
      <span data-aicl="collapsible-label">{children}</span>
      <Icon name="chevron-down" />
    </button>
  );
}

function CollapsiblePanel({ children }: { children?: ReactNode }) {
  const { baseId } = useCollapsible();

  return (
    <div id={baseId} role="region" data-aicl="collapsible-panel">
      <div data-aicl="collapsible-body">{children}</div>
    </div>
  );
}

Collapsible.Trigger = CollapsibleTrigger;
Collapsible.Panel = CollapsiblePanel;

/* -------------------------------------------------------------------------- */
/* Accordion                                                                   */
/* -------------------------------------------------------------------------- */

interface AccordionContextValue {
  type: 'single' | 'multiple';
  isOpen: (value: string) => boolean;
  toggle: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordion(): AccordionContextValue {
  const context = useContext(AccordionContext);
  if (!context) throw new Error('Accordion.Item must be inside Accordion');
  return context;
}

interface AccordionItemContextValue {
  value: string;
  open: boolean;
  baseId: string;
}

const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

function useAccordionItem(): AccordionItemContextValue {
  const context = useContext(AccordionItemContext);
  if (!context) throw new Error('Accordion.Trigger and Accordion.Panel must be inside Accordion.Item');
  return context;
}

interface AccordionSingleProps {
  /** One item open at a time. This is the default. */
  type?: 'single';
  /** The open item, when the caller owns it. */
  value?: string;
  /** The item that starts open. */
  defaultValue?: string;
  /** Fires with the next open item. An empty string means all closed. */
  onValueChange?: (value: string) => void;
  children?: ReactNode;
}

interface AccordionMultipleProps {
  /** Several items may be open. */
  type: 'multiple';
  /** The open items, when the caller owns them. */
  value?: string[];
  /** The items that start open. */
  defaultValue?: string[];
  /** Fires with the next open items. */
  onValueChange?: (value: string[]) => void;
  children?: ReactNode;
}

export type AccordionProps = AccordionSingleProps | AccordionMultipleProps;

/** A list of disclosures. */
export function Accordion(props: AccordionProps) {
  if (props.type === 'multiple') {
    return <AccordionMultiple {...props} />;
  }
  return <AccordionSingle {...props} />;
}

function AccordionSingle({ value, defaultValue = '', onValueChange, children }: AccordionSingleProps) {
  const [current, setCurrent] = useControllable(value, defaultValue, onValueChange);
  const context: AccordionContextValue = {
    type: 'single',
    isOpen: (item) => item === current && current !== '',
    toggle: (item) => setCurrent(item === current ? '' : item),
  };

  return (
    <AccordionContext.Provider value={context}>
      <div data-aicl="accordion" data-type="single">
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

function AccordionMultiple({
  value,
  defaultValue = [],
  onValueChange,
  children,
}: AccordionMultipleProps) {
  const [current, setCurrent] = useControllable(value, defaultValue, onValueChange);
  const context: AccordionContextValue = {
    type: 'multiple',
    isOpen: (item) => current.includes(item),
    toggle: (item) => {
      const next = current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item];
      setCurrent(next);
    },
  };

  return (
    <AccordionContext.Provider value={context}>
      <div data-aicl="accordion" data-type="multiple">
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export interface AccordionItemProps {
  /** The value this item toggles. */
  value: string;
  children?: ReactNode;
}

/** One row of an accordion. */
export function AccordionItem({ value, children }: AccordionItemProps) {
  const accordion = useAccordion();
  const open = accordion.isOpen(value);
  const baseId = useId();

  return (
    <AccordionItemContext.Provider value={{ value, open, baseId }}>
      <div data-aicl="accordion-item" data-state={open ? 'open' : 'closed'} data-value={value}>
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

function AccordionTrigger({ children }: { children?: ReactNode }) {
  const accordion = useAccordion();
  const item = useAccordionItem();

  return (
    <button
      type="button"
      aria-expanded={item.open}
      aria-controls={item.baseId}
      data-aicl="accordion-trigger"
      onClick={() => accordion.toggle(item.value)}
    >
      <span data-aicl="accordion-label">{children}</span>
      <Icon name="chevron-down" />
    </button>
  );
}

function AccordionPanel({ children }: { children?: ReactNode }) {
  const { baseId } = useAccordionItem();

  return (
    <div id={baseId} role="region" data-aicl="accordion-panel">
      <div data-aicl="accordion-body">{children}</div>
    </div>
  );
}

Accordion.Item = AccordionItem;
Accordion.Trigger = AccordionTrigger;
Accordion.Panel = AccordionPanel;
