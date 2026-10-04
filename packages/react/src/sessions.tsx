/**
 * Session and navigation primitives (blueprint §4.14–§4.17). Host-agnostic:
 * no width, placement, or chrome. The data comes from `createSessionStore`
 * (D11) or any `{ groups, byId }` the consumer builds.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createComboboxModel, type SessionMeta } from '@aicl/core';
import { useReadable } from './useReadable.js';

export type SessionGroups = { id: string; label?: string; ids: string[] }[];
export type FormatTime = (ts: number, ctx: { inDateGroup: boolean }) => string;

/** Compact relative time: "now", "5m", "3h", "2d", then a short date. */
export const relativeTime: FormatTime = (ts) => {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

type Secondary = { kind: 'status' | 'preview' | 'time' | 'none'; text?: string };

/** statusLine while not idle → preview → relative time → nothing. */
export function resolveSecondary(meta: SessionMeta, formatTime: FormatTime, inDateGroup = false): Secondary {
  if (meta.status && meta.status !== 'idle' && meta.statusLine) return { kind: 'status', text: meta.statusLine };
  if (meta.preview) return { kind: 'preview', text: meta.preview };
  if (meta.updatedAt !== undefined) return { kind: 'time', text: formatTime(meta.updatedAt, { inDateGroup }) };
  return { kind: 'none' };
}

/* -------------------------------------------------------------------------- */
/* SessionListItem                                                             */
/* -------------------------------------------------------------------------- */

export interface SessionListItemProps {
  meta: SessionMeta;
  active?: boolean;
  /** DOM id; the list uses it for `aria-activedescendant`. */
  id?: string;
  /** Overrides the resolved secondary line. */
  secondary?: ReactNode;
  actions?: string[];
  onAction?: (action: string, meta: SessionMeta) => void;
  onSelect?: (id: string) => void;
  formatTime?: FormatTime;
}

export function SessionListItem({
  meta,
  active = false,
  id,
  secondary,
  actions = [],
  onAction,
  onSelect,
  formatTime = relativeTime,
}: SessionListItemProps) {
  const fallbackId = useId();
  const rowId = id ?? fallbackId;
  const resolved = resolveSecondary(meta, formatTime);
  const descId = `${rowId}-desc`;
  return (
    <div
      id={rowId}
      role="option"
      aria-selected={active}
      aria-describedby={resolved.kind !== 'none' || secondary ? descId : undefined}
      data-aicl="session-item"
      data-kind="session"
      data-session-id={meta.id}
      data-status={meta.status ?? 'idle'}
      data-secondary={secondary ? 'custom' : resolved.kind}
      data-unread={meta.unread || undefined}
      data-starred={meta.starred || undefined}
      data-archived={meta.archivedAt !== undefined || undefined}
      data-active={active || undefined}
      onClick={() => onSelect?.(meta.id)}
    >
      <span data-aicl="session-title" title={meta.title}>
        {meta.title}
      </span>
      {secondary || resolved.kind !== 'none' ? (
        <span id={descId} data-aicl="session-secondary">
          {secondary ?? resolved.text}
        </span>
      ) : null}
      {actions.length ? (
        // Always in the DOM; paint-only reveal on hover or focus-within.
        <span data-aicl="session-actions">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              tabIndex={-1}
              aria-label={`${action} ${meta.title}`}
              onClick={(e) => {
                e.stopPropagation();
                onAction?.(action, meta);
              }}
            >
              {action}
            </button>
          ))}
        </span>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared listbox keyboard over grouped ids                                    */
/* -------------------------------------------------------------------------- */

const flatten = (groups: SessionGroups, byId: Record<string, SessionMeta>) =>
  groups.flatMap((g) => g.ids.filter((id) => byId[id]));

function useLoadMoreSentinel(hasMore: boolean, loadingMore: boolean, onLoadMore?: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore || loadingMore || !onLoadMore || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onLoadMore());
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);
  return ref;
}

/* -------------------------------------------------------------------------- */
/* SessionList                                                                 */
/* -------------------------------------------------------------------------- */

export interface SessionListProps {
  groups: SessionGroups;
  byId: Record<string, SessionMeta>;
  activeId?: string;
  onActiveChange?: (id: string) => void;
  onSelect?: (id: string) => void;
  renderItem?: (meta: SessionMeta, a: { active: boolean; index: number; id: string }) => ReactNode;
  /** Pinned outside the scroll container. Creation controls go here, never inside the listbox. */
  header?: ReactNode;
  empty?: ReactNode;
  /** Skeleton rows, never a spinner. */
  loading?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  actions?: string[];
  onAction?: (action: string, meta: SessionMeta) => void;
  formatTime?: FormatTime;
  ariaLabel?: string;
}

export function SessionList({
  groups,
  byId,
  activeId: activeProp,
  onActiveChange,
  onSelect,
  renderItem,
  header,
  empty,
  loading = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  actions,
  onAction,
  formatTime,
  ariaLabel = 'Sessions',
}: SessionListProps) {
  const base = useId();
  const optionId = useCallback((id: string) => `${base}-${id}`, [base]);
  const order = useMemo(() => flatten(groups, byId), [groups, byId]);
  const [innerActive, setInnerActive] = useState<string | undefined>(undefined);
  const activeId = activeProp ?? innerActive;
  const sentinel = useLoadMoreSentinel(hasMore, loadingMore, onLoadMore);

  const setActive = useCallback(
    (id: string) => {
      if (activeProp === undefined) setInnerActive(id);
      onActiveChange?.(id);
      if (typeof document !== 'undefined') document.getElementById(optionId(id))?.scrollIntoView?.({ block: 'nearest' });
    },
    [activeProp, onActiveChange, optionId],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!order.length) return;
    const at = activeId ? order.indexOf(activeId) : -1;
    const go: Record<string, number> = {
      ArrowDown: Math.min(order.length - 1, at + 1),
      ArrowUp: Math.max(0, at - 1),
      Home: 0,
      End: order.length - 1,
    };
    if (event.key in go) {
      event.preventDefault();
      setActive(order[go[event.key]!]!);
    } else if (event.key === 'Enter' && activeId) {
      event.preventDefault();
      onSelect?.(activeId);
    }
  };

  const isEmpty = !loading && order.length === 0;
  let index = 0;

  return (
    <div
      data-aicl="session-list"
      data-empty={isEmpty || undefined}
      data-loading={loading || undefined}
      data-loading-more={loadingMore || undefined}
      data-count={order.length}
    >
      {header ? <div data-aicl="session-list-header" data-pinned="">{header}</div> : null}
      {loading ? (
        <div data-aicl="session-list-skeleton" aria-busy="true" aria-label="Loading sessions">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} data-aicl="session-skeleton" />
          ))}
        </div>
      ) : isEmpty ? (
        <div data-aicl="session-list-empty">{empty ?? 'No sessions yet'}</div>
      ) : (
        <div
          role="listbox"
          tabIndex={0}
          aria-label={ariaLabel}
          aria-activedescendant={activeId && byId[activeId] ? optionId(activeId) : undefined}
          data-aicl="session-listbox"
          onKeyDown={onKeyDown}
        >
          {groups.map((group) => {
            const ids = group.ids.filter((id) => byId[id]);
            if (!ids.length) return null;
            return (
              <div key={group.id} role="group" aria-label={group.label} data-aicl="session-group">
                {group.label ? (
                  <div role="presentation" data-aicl="session-group-label">
                    {group.label}
                  </div>
                ) : null}
                {ids.map((id) => {
                  const meta = byId[id]!;
                  const active = id === activeId;
                  const i = index++;
                  return renderItem ? (
                    <div key={id}>{renderItem(meta, { active, index: i, id: optionId(id) })}</div>
                  ) : (
                    <SessionListItem
                      key={id}
                      id={optionId(id)}
                      meta={meta}
                      active={active}
                      actions={actions}
                      onAction={onAction}
                      formatTime={formatTime}
                      onSelect={(sid) => {
                        setActive(sid);
                        onSelect?.(sid);
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
          {hasMore ? <div ref={sentinel} data-aicl="session-list-sentinel" aria-hidden="true" /> : null}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SessionSearch                                                               */
/* -------------------------------------------------------------------------- */

export interface SessionSearchProps {
  value: string;
  onChange: (query: string) => void;
  /** Consumer-filtered results. An empty query shows whatever this holds — that is how recents render. */
  groups: SessionGroups;
  byId: Record<string, SessionMeta>;
  /** `modal` is for use inside a `Dialog` (the Cmd-K recipe); behaviour is identical. */
  variant?: 'inline' | 'modal';
  loading?: boolean;
  empty?: ReactNode;
  onActiveChange?: (id: string) => void;
  onSelect?: (id: string) => void;
  onClose?: () => void;
  placeholder?: string;
  formatTime?: FormatTime;
  ariaLabel?: string;
}

export function SessionSearch({
  value,
  onChange,
  groups,
  byId,
  variant = 'inline',
  loading = false,
  empty,
  onActiveChange,
  onSelect,
  onClose,
  placeholder = 'Search',
  formatTime = relativeTime,
  ariaLabel = 'Search sessions',
}: SessionSearchProps) {
  const base = useId();
  const listId = `${base}-list`;
  const optionId = (id: string) => `${base}-${id}`;
  const order = useMemo(() => flatten(groups, byId), [groups, byId]);
  const model = useMemo(() => createComboboxModel<string>(), []);
  const state = useReadable(model.state);
  const activeId = state.items[state.activeIndex];

  useEffect(() => {
    model.setItems(order);
    model.open();
  }, [model, order]);
  useEffect(() => {
    if (activeId) onActiveChange?.(activeId);
  }, [activeId, onActiveChange]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      model.move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const id = model.accept();
      model.open();
      if (id) onSelect?.(id);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose?.();
    }
  };

  const isEmpty = !loading && order.length === 0;
  const announce = loading ? 'Searching' : `${order.length} ${order.length === 1 ? 'result' : 'results'}`;

  return (
    <div
      data-aicl="session-search"
      data-variant={variant}
      data-state={order.length ? 'open' : 'closed'}
      data-count={order.length}
      data-empty={isEmpty || undefined}
      data-loading={loading || undefined}
    >
      <input
        type="search"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={order.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId ? optionId(activeId) : undefined}
        autoFocus={variant === 'modal'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        data-aicl="session-search-input"
      />
      <span data-aicl="session-search-status" role="status" aria-live="polite">
        {announce}
      </span>
      {isEmpty ? (
        <div data-aicl="session-search-empty">{empty ?? 'No results'}</div>
      ) : (
        <div id={listId} role="listbox" aria-label="Results" data-aicl="session-search-results">
          {groups.map((group) => {
            const ids = group.ids.filter((id) => byId[id]);
            if (!ids.length) return null;
            return (
              <div key={group.id} role="group" aria-label={group.label} data-aicl="session-group">
                {group.label ? (
                  <div role="presentation" data-aicl="session-group-label">
                    {group.label}
                  </div>
                ) : null}
                {ids.map((id) => (
                  <SessionListItem
                    key={id}
                    id={optionId(id)}
                    meta={byId[id]!}
                    active={id === activeId}
                    formatTime={formatTime}
                    onSelect={(sid) => {
                      model.setActive(order.indexOf(sid));
                      onSelect?.(sid);
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SidebarNav                                                                  */
/* -------------------------------------------------------------------------- */

export interface SidebarNavItem {
  id: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  active?: boolean;
  badge?: ReactNode;
}

export interface SidebarNavProps {
  items: SidebarNavItem[];
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onNavigate?: (item: SidebarNavItem) => void;
  renderItem?: (item: SidebarNavItem, a: { collapsed: boolean; active: boolean }) => ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  ariaLabel?: string;
}

/** Identical DOM in both states: collapse is paint, and every item keeps its accessible name. */
export function SidebarNav({
  items,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  onNavigate,
  renderItem,
  header,
  footer,
  ariaLabel = 'Primary',
}: SidebarNavProps) {
  const listId = useId();
  const [inner, setInner] = useState(defaultCollapsed);
  const collapsed = collapsedProp ?? inner;
  const toggle = () => {
    if (collapsedProp === undefined) setInner(!collapsed);
    onCollapsedChange?.(!collapsed);
  };

  return (
    <nav aria-label={ariaLabel} data-aicl="sidebar-nav" data-state={collapsed ? 'collapsed' : 'expanded'} data-count={items.length}>
      {header ? <div data-aicl="sidebar-nav-header">{header}</div> : null}
      <button
        type="button"
        data-aicl="sidebar-nav-toggle"
        aria-expanded={!collapsed}
        aria-controls={listId}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={toggle}
      />
      <ul id={listId} data-aicl="sidebar-nav-list">
        {items.map((item) => {
          const active = item.active ?? false;
          const content = renderItem ? (
            renderItem(item, { collapsed, active })
          ) : (
            <>
              {item.icon ? (
                <span data-aicl="sidebar-nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
              ) : null}
              {/* The label stays in the DOM when collapsed: a tooltip is not an accessible name. */}
              <span data-aicl="sidebar-nav-label">{item.label}</span>
              {item.badge ? <span data-aicl="sidebar-nav-badge">{item.badge}</span> : null}
            </>
          );
          const shared = {
            'data-aicl': 'sidebar-nav-item',
            'data-nav-id': item.id,
            'data-active': active || undefined,
            'data-collapsed': collapsed || undefined,
            'aria-current': active ? ('page' as const) : undefined,
            title: collapsed ? item.label : undefined,
          };
          return (
            <li key={item.id}>
              {item.href ? (
                <a href={item.href} {...shared} onClick={() => onNavigate?.(item)}>
                  {content}
                </a>
              ) : (
                <button type="button" {...shared} onClick={() => onNavigate?.(item)}>
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {footer ? <div data-aicl="sidebar-nav-footer">{footer}</div> : null}
    </nav>
  );
}
