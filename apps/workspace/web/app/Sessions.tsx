/**
 * Session navigation: the sidebar (kits with nav 'sidebar') and the dropdown
 * (top-bar kits, narrow screens, the sidebar collapsed). Labels come from
 * kit.vocabulary; grouping from kit.layout.grouping.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bucketByRecency, type SessionMeta } from '@aicl/core';
import { AlertDialog } from '@aicl/react';
import { ChevronDown, FolderPlus, Pencil, PanelLeftClose, Search, SquarePen, Trash2 } from 'lucide-react';
import { MAIN_SESSION_ID, type SessionInfo } from '../../shared/runtime.ts';
import type { ProviderKit } from '../../shared/kits.ts';
import { toasts } from '../chatStore.ts';
import { createSession, deleteSession, renameSession, setActiveSession, useActiveSessionId, useSessions } from '../sessionsApi.ts';
import { navigate } from '../router.ts';
import { setPrefs } from './prefs.ts';
import { ChatTree } from './ChatTree.tsx';
import { LiveResources } from './LiveResources.tsx';

/** The server's defaults ("Main", "New chat") in the kit's words ("Main task", "New project"). */
export const sessionTitle = (s: SessionInfo, kit: ProviderKit): string =>
  s.id === MAIN_SESSION_ID && s.title === 'Main'
    ? `Main ${kit.vocabulary.sessions.toLowerCase().replace(/s$/, '')}`
    : s.title === 'New chat'
      ? kit.vocabulary.newSession
      : s.title;

export function StatusDot({ status }: { status: SessionInfo['status'] }) {
  return <span className="s-dot" data-status={status} role="img" aria-label={status === 'running' ? 'Working' : status === 'error' ? 'Failed' : 'Idle'} />;
}

/** Starts a session and opens the agent page on it. */
export async function startSession(): Promise<void> {
  try {
    const id = await createSession();
    navigate({ tab: 'agent', sessionId: id });
  } catch (cause) {
    toasts.push({ title: 'Could not start a session', description: cause instanceof Error ? cause.message : String(cause), variant: 'error' });
  }
}

export function openSession(id: string): void {
  setActiveSession(id);
  navigate({ tab: 'agent', sessionId: id });
}

interface RowsProps {
  kit: ProviderKit;
  query: string;
  /** Called after a row is chosen (to close a dropdown). */
  onPicked?: () => void;
}

/** Search-filtered, grouped session rows with inline rename and delete. */
function SessionRows({ kit, query, onPicked }: RowsProps) {
  const sessions = useSessions();
  const activeId = useActiveSessionId();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [toDelete, setToDelete] = useState<SessionInfo | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = sessions.filter((s) => !q || `${s.title} ${s.preview ?? ''}`.toLowerCase().includes(q));
    if (kit.layout.grouping === 'flat') return shown.length ? [{ id: 'all', label: '', items: shown }] : [];
    const meta: SessionMeta[] = shown.map((s) => ({ id: s.id, title: s.title, updatedAt: s.updatedAt }));
    const byId = new Map(shown.map((s) => [s.id, s]));
    return bucketByRecency(meta, Date.now())
      .filter((g) => g.sessions.length)
      .map((g) => ({ id: g.id, label: g.label ?? '', items: g.sessions.map((m) => byId.get(m.id)!) }));
  }, [sessions, query, kit.layout.grouping]);

  const commit = (s: SessionInfo) => {
    const title = draft.trim();
    setRenaming(null);
    if (title && title !== s.title) void renameSession(s.id, title);
  };

  if (!groups.length) return <p className="s-empty">{query ? `No ${kit.vocabulary.sessions.toLowerCase()} match “${query}”.` : `No ${kit.vocabulary.sessions.toLowerCase()} yet.`}</p>;

  return (
    <>
      {groups.map((g) => (
        <section key={g.id} className="s-group" aria-label={g.label || kit.vocabulary.sessions}>
          {g.label ? <h3 className="s-group-label">{g.label}</h3> : null}
          <ul className="s-list">
            {g.items.map((s) => {
              const active = s.id === activeId;
              return (
                <li key={s.id} className="s-row" data-active={active || undefined} data-session={s.id}>
                  {renaming === s.id ? (
                    <input
                      className="s-rename"
                      aria-label={`Rename ${kit.vocabulary.sessions.toLowerCase().replace(/s$/, '')}`}
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      onBlur={() => commit(s)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commit(s);
                        else if (e.key === 'Escape') {
                          e.stopPropagation();
                          setRenaming(null);
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="s-open"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => {
                        openSession(s.id);
                        onPicked?.();
                      }}
                      onDoubleClick={() => {
                        setDraft(s.title);
                        setRenaming(s.id);
                      }}
                    >
                      <StatusDot status={s.status} />
                      <span className="s-text">
                        <span className="s-title">{sessionTitle(s, kit)}</span>
                        {s.status === 'running' ? <span className="s-sub">Working…</span> : s.preview ? <span className="s-sub">{s.preview}</span> : null}
                      </span>
                    </button>
                  )}
                  {renaming === s.id ? null : (
                    <span className="s-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Rename ${s.title}`}
                        title="Rename"
                        onClick={() => {
                          setDraft(s.title);
                          setRenaming(s.id);
                        }}
                      >
                        <Pencil size={13} aria-hidden="true" />
                      </button>
                      {s.id === MAIN_SESSION_ID ? null : (
                        <button type="button" className="icon-button" aria-label={`Delete ${s.title}`} title="Delete" onClick={() => setToDelete(s)}>
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete “${toDelete?.title ?? ''}”?`}
        variant="danger"
        consequence="This permanently deletes it and its messages."
        onConfirm={() => {
          if (toDelete) void deleteSession(toDelete.id);
          setToDelete(null);
        }}
      />
    </>
  );
}

function SearchField({ kit, value, onChange }: { kit: ProviderKit; value: string; onChange: (v: string) => void }) {
  return (
    <label className="s-search">
      <Search size={14} aria-hidden="true" />
      <input type="search" aria-label={`Search ${kit.vocabulary.sessions.toLowerCase()}`} placeholder={`Search ${kit.vocabulary.sessions.toLowerCase()}`} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function SessionsSidebar({ kit }: { kit: ProviderKit }) {
  const [folderRequest, setFolderRequest] = useState<string | null>(null);
  const clearRequest = useCallback(() => setFolderRequest(null), []);
  return (
    <aside className="agent-sidebar" aria-label={kit.vocabulary.sessions}>
      <div className="s-head">
        <h2 className="s-heading">{kit.vocabulary.sessions}</h2>
        <span className="s-head-actions">
          <button type="button" className="icon-button" aria-label="New folder" title="New folder" onClick={() => setFolderRequest('')}>
            <FolderPlus size={16} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button" aria-label="Collapse sidebar" title="Collapse sidebar" onClick={() => setPrefs({ sidebarCollapsed: true })}>
            <PanelLeftClose size={16} aria-hidden="true" />
          </button>
        </span>
      </div>
      <button type="button" className="agent-new" onClick={() => void startSession()}>
        <SquarePen size={16} aria-hidden="true" />
        <span>{kit.vocabulary.newSession}</span>
      </button>
      <div className="agent-sessions">
        <ChatTree kit={kit} newFolderRequest={folderRequest} onNewFolderHandled={clearRequest} />
      </div>
      <LiveResources />
    </aside>
  );
}

/** Dropdown with the same rows: the active title is the trigger. */
export function SessionsMenu({ kit, compact }: { kit: ProviderKit; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const sessions = useSessions();
  const activeId = useActiveSessionId();
  const active = sessions.find((s) => s.id === activeId);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false));
    window.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc, true);
    return () => {
      window.removeEventListener('mousedown', away);
      window.removeEventListener('keydown', esc, true);
    };
  }, [open]);

  return (
    <div className="s-menu" ref={root}>
      <button type="button" className="s-menu-trigger" aria-haspopup="true" aria-expanded={open} aria-label={`${kit.vocabulary.sessions} menu`} onClick={() => setOpen((o) => !o)}>
        {active ? <StatusDot status={active.status} /> : null}
        <span className="s-menu-title">{active && !compact ? sessionTitle(active, kit) : kit.vocabulary.sessions}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div className="s-menu-pop" role="dialog" aria-label={kit.vocabulary.sessions}>
          <button
            type="button"
            className="agent-new"
            onClick={() => {
              setOpen(false);
              void startSession();
            }}
          >
            <SquarePen size={16} aria-hidden="true" />
            <span>{kit.vocabulary.newSession}</span>
          </button>
          <SearchField kit={kit} value={query} onChange={setQuery} />
          <div className="s-menu-rows">
            <SessionRows kit={kit} query={query} onPicked={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
