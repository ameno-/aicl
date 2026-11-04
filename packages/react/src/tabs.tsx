/**
 * Tabs.
 *
 * A tablist and its panels. Arrow keys move, and the selection is a pill
 * that travels between the tabs — the same motion Fluid puts on its tabs
 * and the same one the segmented control uses. The columns are equal, so
 * the pill can travel without measuring the DOM.
 *
 * Controlled with `value`, or uncontrolled from `defaultValue`.
 */

import {
  createContext,
  useContext,
  useId,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { useControllable } from './useControllable.js';

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tabs.List, Tabs.Tab and Tabs.Panel must be inside Tabs');
  return context;
}

export interface TabsProps {
  /** The selected value, when the caller owns it. */
  value?: string;
  /** The selected value when the caller does not. */
  defaultValue?: string;
  /** Fires with the next value. */
  onValueChange?: (value: string) => void;
  children?: ReactNode;
}

/** A set of tabs. */
export function Tabs({ value, defaultValue = '', onValueChange, children }: TabsProps) {
  const [current, setCurrent] = useControllable(value, defaultValue, onValueChange);
  const baseId = useId();

  return (
    <TabsContext.Provider value={{ value: current, setValue: setCurrent, baseId }}>
      <div data-aicl="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps {
  /** The accessible name of the tablist. */
  'aria-label': string;
  children?: ReactNode;
}

/**
 * The values of the enabled tabs, in source order.
 *
 * Read from the element tree so the pill and the keyboard handler agree
 * before the tabs have committed a DOM node. Disabled tabs stay rendered
 * and are skipped.
 */
function enabledValues(node: ReactNode): string[] {
  const values: string[] = [];
  const visit = (child: ReactNode) => {
    if (child == null || typeof child === 'boolean') return;
    if (Array.isArray(child)) {
      for (const entry of child) visit(entry);
      return;
    }
    if (typeof child === 'object' && child !== null && 'props' in child) {
      const props = child.props as { value?: unknown; disabled?: boolean; children?: ReactNode };
      if (typeof props.value === 'string') {
        if (!props.disabled) values.push(props.value);
        return;
      }
      visit(props.children);
    }
  };
  visit(node);
  return values;
}

/** The row of tabs, with the travelling pill. */
export function TabsList({ 'aria-label': ariaLabel, children }: TabsListProps) {
  const { value, setValue } = useTabs();
  const enabled = enabledValues(children);
  const index = enabled.indexOf(value);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (enabled.length === 0) return;
    const from = Math.max(0, enabled.indexOf(value));
    const step = (delta: number) => enabled[(from + delta + enabled.length) % enabled.length]!;
    const target: Record<string, string> = {
      ArrowRight: step(1),
      ArrowDown: step(1),
      ArrowLeft: step(-1),
      ArrowUp: step(-1),
      Home: enabled[0]!,
      End: enabled[enabled.length - 1]!,
    };
    const next = target[event.key];
    if (next == null || next === value) return;
    event.preventDefault();
    setValue(next);
    const list = event.currentTarget as { querySelector?: (selector: string) => { focus?: () => void } | null };
    list.querySelector?.(`[data-value="${next}"]`)?.focus?.();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      data-aicl="tabs-list"
      onKeyDown={onKeyDown}
      style={{
        ['--aicl-index' as string]: String(Math.max(0, index)),
        ['--aicl-count' as string]: String(enabled.length || 1),
      }}
    >
      {index >= 0 ? <span data-aicl="tabs-indicator" data-index={index} aria-hidden="true" /> : null}
      {children}
    </div>
  );
}

export interface TabsTabProps {
  /** The value this tab selects. */
  value: string;
  /** The tab cannot be selected. */
  disabled?: boolean;
  children?: ReactNode;
}

/** One tab. */
export function TabsTab({ value, disabled, children }: TabsTabProps) {
  const { value: selected, setValue, baseId } = useTabs();
  const active = value === selected;

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={active}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={active ? 0 : -1}
      disabled={disabled}
      data-aicl="tabs-tab"
      data-value={value}
      data-state={active ? 'active' : 'inactive'}
      onClick={() => {
        if (!disabled) setValue(value);
      }}
    >
      {children}
    </button>
  );
}

export interface TabsPanelProps {
  /** The value this panel belongs to. */
  value: string;
  children?: ReactNode;
}

/** The panel for one value. Inactive panels stay mounted and are hidden. */
export function TabsPanel({ value, children }: TabsPanelProps) {
  const { value: selected, baseId } = useTabs();
  const active = value === selected;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
      hidden={!active}
      data-aicl="tabs-panel"
      data-state={active ? 'active' : 'inactive'}
    >
      {children}
    </div>
  );
}

Tabs.List = TabsList;
Tabs.Tab = TabsTab;
Tabs.Panel = TabsPanel;
