/**
 * Tabs.
 *
 * One tab stop, arrows move, a travelling pill follows the selected tab.
 * The pill moves with `transform` (never `width`), on the motion system's
 * `moderate` spring, so it is the showcase Fluid's tabs are in theirs.
 *
 * Compound: `Tabs.List`, `Tabs.Tab`, `Tabs.Panel`. Controlled and
 * uncontrolled (`value` / `defaultValue` / `onValueChange`).
 */

import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { useControllableState } from './controllable.js';

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Accessible name for the tab list. */
  label?: string;
  children?: ReactNode;
}

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
  listRef: { current: HTMLDivElement | null };
  register: (value: string, el: HTMLButtonElement | null) => void;
  values: () => string[];
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs parts must be rendered inside <Tabs>.');
  return ctx;
}

function TabsRoot({
  value: valueProp,
  defaultValue = '',
  onValueChange,
  label,
  children,
}: TabsProps) {
  const [value, setValue] = useControllableState(valueProp, defaultValue, onValueChange);
  const baseId = useId();
  const listRef = useRef<HTMLDivElement | null>(null);
  const tabs = useRef(new Map<string, HTMLButtonElement>());

  const ctx: TabsContextValue = {
    value,
    setValue,
    baseId,
    listRef,
    register: (name, el) => {
      if (el) tabs.current.set(name, el);
      else tabs.current.delete(name);
    },
    values: () => [...tabs.current.keys()],
  };

  return (
    <TabsContext.Provider value={ctx}>
      <div data-aicl="tabs" data-state={value || undefined} aria-label={label}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export function TabsList({ children, ...rest }: TabsListProps) {
  const { listRef, value, setValue, values } = useTabs();
  const [indicator, setIndicator] = useState({ x: 0, w: 0 });

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.querySelector<HTMLElement>('[data-aicl="tabs-tab"][data-state="active"]');
    if (!selected) return;
    const listBox = list.getBoundingClientRect();
    const tabBox = selected.getBoundingClientRect();
    setIndicator({ x: tabBox.left - listBox.left, w: tabBox.width });
  }, [listRef, value]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = values();
    const index = keys.indexOf(value);
    if (keys.length === 0) return;
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % keys.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + keys.length) % keys.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = keys.length - 1;
    else return;
    const name = keys[next];
    if (name === undefined) return;
    event.preventDefault();
    setValue(name);
    listRef.current
      ?.querySelector<HTMLElement>(`[data-aicl="tabs-tab"][data-value="${CSS.escape(name)}"]`)
      ?.focus();
  };

  return (
    <div
      {...rest}
      ref={(node) => {
        listRef.current = node;
      }}
      role="tablist"
      data-aicl="tabs-list"
      onKeyDown={(event) => {
        rest.onKeyDown?.(event);
        if (!event.defaultPrevented) onKeyDown(event);
      }}
    >
      <span
        data-aicl="tabs-indicator"
        aria-hidden="true"
        style={{
          transform: `translateX(${indicator.x}px) scaleX(${indicator.w || 1})`,
        }}
      />
      {children}
    </div>
  );
}

export interface TabsTabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children?: ReactNode;
}

export function TabsTab({ value, children, ...rest }: TabsTabProps) {
  const tabs = useTabs();
  const selected = tabs.value === value;
  const tabId = `${tabs.baseId}-tab-${value}`;
  const panelId = `${tabs.baseId}-panel-${value}`;

  return (
    <button
      {...rest}
      ref={(node) => {
        tabs.register(value, node);
      }}
      type={rest.type ?? 'button'}
      role="tab"
      id={tabId}
      aria-selected={selected}
      aria-controls={panelId}
      tabIndex={selected ? 0 : -1}
      data-aicl="tabs-tab"
      data-state={selected ? 'active' : 'inactive'}
      data-value={value}
      onClick={(event) => {
        rest.onClick?.(event);
        if (!event.defaultPrevented) tabs.setValue(value);
      }}
    >
      {children}
    </button>
  );
}

export interface TabsPanelProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  children?: ReactNode;
}

export function TabsPanel({ value, children, ...rest }: TabsPanelProps) {
  const tabs = useTabs();
  const selected = tabs.value === value;
  const tabId = `${tabs.baseId}-tab-${value}`;
  const panelId = `${tabs.baseId}-panel-${value}`;

  return (
    <div
      {...rest}
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      hidden={!selected}
      data-aicl="tabs-panel"
      data-state={selected ? 'active' : 'inactive'}
      data-value={value}
    >
      {selected ? children : null}
    </div>
  );
}

export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Tab: TabsTab,
  Panel: TabsPanel,
});
