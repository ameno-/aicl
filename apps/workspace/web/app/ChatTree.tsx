/**
 * The chats sidebar as a tree (AICL-46), drawn by @pierre/trees: pinned
 * chats, folders (nested), unfiled chats by recency, archived; sub-agents
 * nest under the chat that spawned them. Rows show live status, approvals
 * waiting and recency; a context menu, drag and drop and inline rename
 * manage them.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { FileTree, useFileTree } from '@pierre/trees/react';
import type { ContextMenuItem as FileTreeContextMenuItem, ContextMenuOpenContext as FileTreeContextMenuOpenContext, FileTreeRowDecoration } from '@pierre/trees';
import { AlertDialog } from '@aicl/react';
import { Archive, ArchiveRestore, FolderInput, FolderPlus, MessageSquare, Pencil, Pin, PinOff, SquarePen, Trash2 } from 'lucide-react';
import { buildChatTree, folderForDrop, type ChatTree as Tree } from '../../shared/chat-tree.ts';
import { MAIN_SESSION_ID, type SessionInfo } from '../../shared/runtime.ts';
import type { ProviderKit } from '../../shared/kits.ts';
import { toasts } from '../chatStore.ts';
import { useHitl } from '../agentic/hitl.tsx';
import { addFolder, deleteFolder, deleteSession, organizeSession, renameFolder, useActiveSessionId, useFolders, useSessions } from '../sessionsApi.ts';
import { openSession, sessionTitle } from './Sessions.tsx';

/** The tree's CSS variables on AICL tokens, so it follows the theme. */
const THEME = {
  '--trees-fg-override': 'var(--aicl-text)',
  '--trees-bg-override': 'transparent',
  '--trees-border-color-override': 'var(--aicl-border)',
  '--trees-selected-bg-override': 'var(--aicl-surface)',
  // Cofounder calm: the selected row is a soft card, focus a quiet hairline — no blue ring.
  '--trees-selected-focused-border-color-override': 'var(--aicl-border-strong)',
  '--trees-focus-ring-color-override': 'var(--aicl-border-focus)',
  '--trees-focus-ring-width-override': '1px',
  '--trees-accent-override': 'var(--aicl-text-muted)',
  '--trees-border-radius-override': 'var(--aicl-radius-md)',
  // The tree draws in a shadow root: hand it the app's type.
  '--trees-font-family-override': 'var(--aicl-font-sans)',
  '--trees-font-size-override': '13.5px',
} as CSSProperties;

/** Chat rows use a speech-bubble icon instead of a file icon. */
const ICONS = {
  set: 'minimal' as const,
  spriteSheet:
    '<svg xmlns="http://www.w3.org/2000/svg" style="display:none"><symbol id="aicl-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></symbol></svg>',
  remap: { 'file-tree-icon-file': { name: 'aicl-chat', viewBox: '0 0 24 24' } },
};

const fail = (what: string) => (cause: unknown) =>
  toasts.push({ title: `Could not ${what}`, description: cause instanceof Error ? cause.message : String(cause), variant: 'error' });

/**
 * A blur right after a field opens is the context menu handing focus back to the tree row,
 * not the user leaving: take focus back instead of committing.
 */
const settled = (opened: number, e: React.FocusEvent<HTMLInputElement>, commit: () => void) => {
  if (Date.now() - opened < 400) {
    const el = e.currentTarget;
    window.setTimeout(() => el.focus(), 0);
    return;
  }
  commit();
};

const baseName = (path: string): string => {
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.slice(trimmed.lastIndexOf('/') + 1);
};

interface MenuProps {
  item: FileTreeContextMenuItem;
  context: FileTreeContextMenuOpenContext;
  tree: Tree;
  sessions: Map<string, SessionInfo>;
  folders: string[];
  onRename: (path: string) => void;
  onDelete: (s: SessionInfo) => void;
  onNewFolder: (parent: string) => void;
}

function RowMenu({ item, context, tree, sessions, folders, onRename, onDelete, onNewFolder }: MenuProps) {
  const node = tree.nodes.get(item.path) ?? tree.nodes.get(`${item.path}/`);
  const [moving, setMoving] = useState(false);
  const run = (fn: () => unknown) => () => {
    setMoving(false); // the menu component is reused for the next row
    context.close();
    void Promise.resolve(fn()).catch(fail('update the chat'));
  };
  if (!node) return null;

  if (node.kind === 'section') return null;

  if (node.kind === 'folder') {
    return (
      <div className="ct-menu" role="menu">
        <button type="button" role="menuitem" onClick={run(async () => openSession(await newChatIn(node.folder)))}>
          <SquarePen size={14} aria-hidden="true" /> New chat here
        </button>
        <button type="button" role="menuitem" onClick={run(() => onNewFolder(node.folder))}>
          <FolderPlus size={14} aria-hidden="true" /> New folder inside
        </button>
        <button type="button" role="menuitem" onClick={() => (context.close({ restoreFocus: false }), onRename(item.path))}>
          <Pencil size={14} aria-hidden="true" /> Rename
        </button>
        <button type="button" role="menuitem" className="ct-danger" onClick={run(() => deleteFolder(node.folder))}>
          <Trash2 size={14} aria-hidden="true" /> Delete folder (keeps its chats)
        </button>
      </div>
    );
  }

  const s = sessions.get(node.sessionId);
  if (!s) return null;
  if (moving) {
    return (
      <div className="ct-menu" role="menu" aria-label="Move to folder">
        <button type="button" role="menuitem" disabled={!s.folder} onClick={run(() => organizeSession(s.id, { folder: '' }))}>
          No folder
        </button>
        {folders.map((f) => (
          <button key={f} type="button" role="menuitem" disabled={s.folder === f} onClick={run(() => organizeSession(s.id, { folder: f }))}>
            {f}
          </button>
        ))}
        <button type="button" role="menuitem" onClick={run(() => onNewFolder(''))}>
          <FolderPlus size={14} aria-hidden="true" /> New folder…
        </button>
      </div>
    );
  }
  return (
    <div className="ct-menu" role="menu">
      <button type="button" role="menuitem" onClick={run(() => openSession(s.id))}>
        <MessageSquare size={14} aria-hidden="true" /> Open
      </button>
      <button type="button" role="menuitem" onClick={() => (context.close({ restoreFocus: false }), onRename(item.path))}>
        <Pencil size={14} aria-hidden="true" /> Rename
      </button>
      {s.parentId ? null : (
        <>
          <button type="button" role="menuitem" onClick={() => setMoving(true)}>
            <FolderInput size={14} aria-hidden="true" /> Move to…
          </button>
          <button type="button" role="menuitem" onClick={run(() => organizeSession(s.id, { pinned: !s.pinned }))}>
            {s.pinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />} {s.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button type="button" role="menuitem" onClick={run(() => organizeSession(s.id, { archived: !s.archived }))}>
            {s.archived ? <ArchiveRestore size={14} aria-hidden="true" /> : <Archive size={14} aria-hidden="true" />} {s.archived ? 'Unarchive' : 'Archive'}
          </button>
        </>
      )}
      {s.id === MAIN_SESSION_ID ? null : (
        <button type="button" role="menuitem" className="ct-danger" onClick={() => (context.close(), onDelete(s))}>
          <Trash2 size={14} aria-hidden="true" /> Delete
        </button>
      )}
    </div>
  );
}

/** A new chat filed in `folder`; resolves to its id. */
async function newChatIn(folder: string): Promise<string> {
  const res = await fetch('/api/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
  const { session } = (await res.json()) as { session: SessionInfo };
  if (folder) await organizeSession(session.id, { folder });
  return session.id;
}

export function ChatTree({ kit, newFolderRequest, onNewFolderHandled }: { kit: ProviderKit; newFolderRequest: string | null; onNewFolderHandled: () => void }) {
  const sessions = useSessions();
  const folders = useFolders();
  const activeId = useActiveSessionId();
  const hitl = useHitl();
  const [toDelete, setToDelete] = useState<SessionInfo | null>(null);
  const [draftFolder, setDraftFolder] = useState<{ parent: string; name: string } | null>(null);
  // Rename happens in our own field (not the tree's shadow-DOM one, which drops keystrokes).
  const [renaming, setRenaming] = useState<({ kind: 'chat'; id: string } | { kind: 'folder'; folder: string }) & { value: string } | null>(null);
  const renameOpened = useRef(0);
  const folderOpened = useRef(0);
  useEffect(() => {
    if (renaming) renameOpened.current = Date.now();
  }, [renaming !== null]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (draftFolder) folderOpened.current = Date.now();
  }, [draftFolder !== null]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveRename = () => {
    const r = renaming;
    setRenaming(null);
    const name = r?.value.trim().replace(/\//g, '∕');
    if (!r || !name) return;
    if (r.kind === 'chat') void organizeSession(r.id, { title: name }).catch(fail('rename the chat'));
    else {
      const parent = r.folder.includes('/') ? r.folder.slice(0, r.folder.lastIndexOf('/')) : '';
      if (name !== baseName(r.folder)) void renameFolder(r.folder, parent ? `${parent}/${name}` : name).catch(fail('rename the folder'));
    }
  };

  const tree = useMemo(() => buildChatTree(sessions, folders, { title: (s) => sessionTitle(s, kit) }), [sessions, folders, kit]);
  const byId = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  const waiting = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of hitl.pending) m.set(r.sessionId, (m.get(r.sessionId) ?? 0) + 1);
    return m;
  }, [hitl.pending]);

  // Callbacks the tree holds on to read the latest state through refs.
  const live = useRef({ tree, byId, waiting });
  live.current = { tree, byId, waiting };
  // Our display order (pinned, folders, recent, archived) as a rank the tree's comparator reads.
  const rank = useMemo(() => {
    const m = new Map<string, number>();
    tree.paths.forEach((p, i) => {
      m.set(p, i);
      if (p.endsWith('/')) m.set(p.slice(0, -1), i);
    });
    return m;
  }, [tree]);
  const rankRef = useRef(rank);
  rankRef.current = rank;
  const syncing = useRef(false);
  // A right-click selects the row too; that must open the menu, not the chat.
  const secondary = useRef(0);
  // The row actually right-clicked: after a move the tree's own menu can point at the focused row instead.
  const clickedPath = useRef<string | null>(null);

  const { model } = useFileTree({
    paths: [],
    sort: (a, b) => (rankRef.current.get(a.path) ?? Number.MAX_SAFE_INTEGER) - (rankRef.current.get(b.path) ?? Number.MAX_SAFE_INTEGER),
    // Folders and sections open; chats with sub-agents start collapsed (expanded on demand).
    initialExpansion: 'closed',
    search: true,
    fileTreeSearchMode: 'hide-non-matches',
    flattenEmptyDirectories: false,
    icons: ICONS,
    composition: { contextMenu: { enabled: true, triggerMode: 'both', buttonVisibility: 'when-needed' } },
    onSelectionChange: (selected) => {
      if (syncing.current || Date.now() - secondary.current < 400) return;
      const path = selected[selected.length - 1];
      const node = path ? live.current.tree.nodes.get(path) : undefined;
      if (node?.kind === 'chat') openSession(node.sessionId);
    },
    renderRowDecoration: ({ item }): FileTreeRowDecoration | null => {
      const { tree: t, byId: ids, waiting: w } = live.current;
      const node = t.nodes.get(item.path) ?? t.nodes.get(`${item.path}/`);
      if (!node) return null;
      if (node.kind !== 'chat') {
        const n = [...t.nodes.entries()].filter(([p, v]) => v.kind === 'chat' && p.startsWith(item.path.endsWith('/') ? item.path : `${item.path}/`)).length;
        return n ? { text: String(n), title: `${n} chat${n === 1 ? '' : 's'}` } : null;
      }
      const s = ids.get(node.sessionId);
      if (!s) return null;
      const asks = w.get(s.id) ?? 0;
      if (asks) return { text: `${asks} waiting`, title: `${asks} approval${asks === 1 ? '' : 's'} or question${asks === 1 ? '' : 's'} waiting for you`, parts: [{ text: '● ', color: 'var(--aicl-warning)' }, { text: `${asks} waiting` }] };
      if (s.status === 'running') return { text: 'working', title: s.currentStep ?? 'Working', parts: [{ text: '● ', color: 'var(--aicl-success)' }, { text: 'working' }] };
      if (s.status === 'error') return { text: 'failed', title: 'The last run failed', parts: [{ text: '● ', color: 'var(--aicl-danger)' }, { text: 'failed' }] };
      return null;
    },
    dragAndDrop: {
      canDrag: (paths) => paths.every((p) => {
        const n = live.current.tree.nodes.get(p);
        return n?.kind === 'chat' && !live.current.byId.get(n.sessionId)?.parentId;
      }),
      canDrop: (e) => folderForDrop(live.current.tree, e.target.directoryPath) !== null,
      onDropComplete: (e) => {
        const where = folderForDrop(live.current.tree, e.target.directoryPath);
        if (!where) return;
        for (const p of e.draggedPaths) {
          const n = live.current.tree.nodes.get(p);
          if (n?.kind !== 'chat') continue;
          const change = 'folder' in where ? { folder: where.folder, pinned: false, archived: false } : 'pin' in where ? { pinned: true, archived: false } : { archived: true, pinned: false };
          void organizeSession(n.sessionId, change).catch(fail('move the chat'));
        }
      },
    },
  });

  // Feed the tree. A reset rebuilds it (and would cancel an inline rename or a drag), so it
  // happens only when the set of rows changed; status and approvals just repaint the rows.
  const lastPaths = useRef('');
  useEffect(() => {
    const key = tree.paths.join('\n');
    if (key !== lastPaths.current) {
      lastPaths.current = key;
      model.resetPaths(tree.paths);
      // Folders and Pinned open; Archived and sub-agent groups stay collapsed until asked.
      for (const [path, node] of tree.nodes) {
        if (node.kind === 'chat' || (node.kind === 'section' && node.section === 'archived')) continue;
        const item = model.getItem(path);
        if (item && 'expand' in item) item.expand();
      }
    } else {
      model.setComposition(model.getComposition());
    }
  }, [model, tree, waiting]);

  // Keep the active chat selected without re-opening it.
  useEffect(() => {
    const at = tree.pathOf.get(activeId);
    const item = at ? model.getItem(at) : null;
    syncing.current = true;
    // Exactly one selected row: the open chat.
    for (const p of model.getSelectedPaths()) if (p !== at) model.getItem(p)?.deselect();
    if (item && !item.isSelected()) item.select();
    syncing.current = false;
  }, [model, tree, activeId]);

  // "New folder" from the header or a menu: an inline field above the tree.
  useEffect(() => {
    if (newFolderRequest === null) return;
    setDraftFolder({ parent: newFolderRequest, name: '' });
    onNewFolderHandled();
  }, [newFolderRequest, onNewFolderHandled]);

  const saveFolder = () => {
    const d = draftFolder;
    setDraftFolder(null);
    const name = d?.name.trim();
    if (d && name) void addFolder(d.parent ? `${d.parent}/${name}` : name).catch(fail('create the folder'));
  };

  return (
    <div
      className="ct"
      data-chat-tree=""
      onPointerDownCapture={(e) => {
        if (e.button === 2 || (e.button === 0 && e.ctrlKey)) secondary.current = Date.now();
      }}
      onContextMenuCapture={(e) => {
        secondary.current = Date.now();
        const row = e.nativeEvent.composedPath().find((n): n is HTMLElement => n instanceof HTMLElement && n.hasAttribute('data-item-path'));
        clickedPath.current = row?.getAttribute('data-item-path') ?? null;
      }}
    >
      {draftFolder ? (
        <form
          className="ct-new-folder"
          onSubmit={(e) => {
            e.preventDefault();
            saveFolder();
          }}
        >
          <FolderPlus size={14} aria-hidden="true" />
          <input
            autoFocus
            aria-label="New folder name"
            placeholder={draftFolder.parent ? `New folder in ${draftFolder.parent}` : 'New folder'}
            value={draftFolder.name}
            onChange={(e) => setDraftFolder({ ...draftFolder, name: e.target.value })}
            onBlur={(e) => settled(folderOpened.current, e, saveFolder)}
            onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setDraftFolder(null))}
          />
        </form>
      ) : null}
      {renaming ? (
        <form
          className="ct-new-folder"
          onSubmit={(e) => {
            e.preventDefault();
            saveRename();
          }}
        >
          <Pencil size={14} aria-hidden="true" />
          <input
            autoFocus
            aria-label={renaming.kind === 'chat' ? 'Chat name' : 'Folder name'}
            value={renaming.value}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
            onBlur={(e) => settled(renameOpened.current, e, saveRename)}
            onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setRenaming(null))}
          />
        </form>
      ) : null}
      <FileTree
        model={model}
        className="ct-tree"
        style={THEME}
        renderContextMenu={(item, context) => (
          <RowMenu
            key={clickedPath.current ?? item.path}
            item={clickedPath.current && clickedPath.current !== item.path ? { ...item, path: clickedPath.current } : item}
            context={context}
            tree={tree}
            sessions={byId}
            folders={folders}
            onRename={(path) => {
              const n = tree.nodes.get(path) ?? tree.nodes.get(`${path}/`);
              if (n?.kind === 'chat') setRenaming({ kind: 'chat', id: n.sessionId, value: sessionTitle(byId.get(n.sessionId)!, kit) });
              else if (n?.kind === 'folder') setRenaming({ kind: 'folder', folder: n.folder, value: baseName(n.folder) });
            }}
            onDelete={setToDelete}
            onNewFolder={(parent) => setDraftFolder({ parent, name: '' })}
          />
        )}
      />
      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete “${toDelete ? sessionTitle(toDelete, kit) : ''}”?`}
        variant="danger"
        consequence="This permanently deletes the chat and its messages. Archive it instead to keep it out of the way."
        onConfirm={() => {
          if (toDelete) void deleteSession(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}

