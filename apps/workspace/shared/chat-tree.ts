/**
 * The chats sidebar as a path tree (AICL-46), for @pierre/trees.
 *
 *   Pinned/…            pinned chats (wherever they are filed)
 *   <folder>/…          user folders, nested ("Work/Research/…")
 *   <chat>              unfiled chats at the root, most recent first
 *   Archived/…          archived chats, last
 *
 * A chat with sub-agents (swarm lineage) is a directory: its children nest
 * under it, and selecting the directory opens the chat itself. Paths are
 * display names, so titles are made path-safe and unique per directory; the
 * returned map ties every path back to what it stands for.
 */
import type { SessionInfo } from './runtime.ts';

export const PINNED = 'Pinned';
export const ARCHIVED = 'Archived';

export type ChatTreeNode =
  | { kind: 'chat'; sessionId: string }
  | { kind: 'folder'; folder: string }
  | { kind: 'section'; section: 'pinned' | 'archived' };

export interface ChatTree {
  /** Depth-first, in display order (pass with `presorted: true`). Directories end with "/". */
  paths: string[];
  nodes: Map<string, ChatTreeNode>;
  /** Where each session's row is. */
  pathOf: Map<string, string>;
}

/** "a/b" in a title would read as folders: swap in a look-alike slash. */
const safe = (name: string): string => name.replace(/\//g, '∕').trim() || 'Untitled';

export function buildChatTree(
  sessions: readonly SessionInfo[],
  folders: readonly string[],
  options: { title?: (s: SessionInfo) => string; query?: string } = {},
): ChatTree {
  const title = options.title ?? ((s: SessionInfo) => s.title);
  const q = options.query?.trim().toLowerCase() ?? '';
  const nodes = new Map<string, ChatTreeNode>();
  const pathOf = new Map<string, string>();
  const paths: string[] = [];

  const byId = new Map(sessions.map((s) => [s.id, s]));
  const childrenOf = new Map<string, SessionInfo[]>();
  for (const s of sessions) {
    if (s.parentId && byId.has(s.parentId)) childrenOf.set(s.parentId, [...(childrenOf.get(s.parentId) ?? []), s]);
  }
  const recent = (a: SessionInfo, b: SessionInfo) => b.updatedAt - a.updatedAt;
  const matches = (s: SessionInfo): boolean =>
    !q || `${title(s)} ${s.preview ?? ''} ${s.role ?? ''}`.toLowerCase().includes(q) || (childrenOf.get(s.id) ?? []).some(matches);

  /** Unique child name within one directory. */
  const used = new Map<string, Set<string>>();
  const nameIn = (dir: string, wanted: string): string => {
    const taken = used.get(dir) ?? new Set<string>();
    used.set(dir, taken);
    let name = wanted;
    for (let i = 2; taken.has(name); i++) name = `${wanted} (${i})`;
    taken.add(name);
    return name;
  };

  const addChat = (dir: string, s: SessionInfo): void => {
    const kids = (childrenOf.get(s.id) ?? []).filter(matches).sort(recent);
    const name = nameIn(dir, safe(title(s)));
    const path = kids.length ? `${dir}${name}/` : `${dir}${name}`;
    paths.push(path);
    nodes.set(path, { kind: 'chat', sessionId: s.id });
    pathOf.set(s.id, path);
    for (const k of kids) addChat(path, k);
  };

  // Top-level chats only: sub-agents appear under their parent.
  const tops = sessions.filter((s) => !(s.parentId && byId.has(s.parentId)) && matches(s)).sort(recent);
  const pinned = tops.filter((s) => s.pinned && !s.archived);
  const archived = tops.filter((s) => s.archived);
  const live = tops.filter((s) => !s.pinned && !s.archived);

  if (pinned.length) {
    const dir = `${PINNED}/`;
    paths.push(dir);
    nodes.set(dir, { kind: 'section', section: 'pinned' });
    for (const s of pinned) addChat(dir, s);
  }

  // Folders (and their parents) as directories, alphabetical, each followed by its chats.
  const allFolders = new Set<string>();
  for (const f of folders) {
    const parts = f.split('/').filter(Boolean);
    for (let i = 1; i <= parts.length; i++) allFolders.add(parts.slice(0, i).join('/'));
  }
  for (const s of live) if (s.folder) allFolders.add(s.folder);
  const reserved = new Set([PINNED, ARCHIVED]);
  const bySegments = (a: string, b: string): number => {
    const x = a.split('/');
    const y = b.split('/');
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const c = x[i]!.localeCompare(y[i]!);
      if (c) return c;
    }
    return x.length - y.length; // a parent before its children
  };
  const folderList = [...allFolders].filter((f) => !reserved.has(f.split('/')[0]!)).sort(bySegments);
  const filed = new Map<string, SessionInfo[]>();
  for (const s of live) if (s.folder && allFolders.has(s.folder)) filed.set(s.folder, [...(filed.get(s.folder) ?? []), s]);
  for (const f of folderList) {
    const inFolder = filed.get(f) ?? [];
    // While searching, hide folders with nothing matching under them.
    if (q && !folderList.some((g) => (g === f || g.startsWith(`${f}/`)) && (filed.get(g)?.length ?? 0) > 0)) continue;
    const dir = `${f.split('/').map(safe).join('/')}/`;
    paths.push(dir);
    nodes.set(dir, { kind: 'folder', folder: f });
    for (const s of inFolder) addChat(dir, s);
  }

  for (const s of live) if (!s.folder || !allFolders.has(s.folder)) addChat('', s);

  if (archived.length) {
    const dir = `${ARCHIVED}/`;
    paths.push(dir);
    nodes.set(dir, { kind: 'section', section: 'archived' });
    for (const s of archived) addChat(dir, s);
  }

  return { paths, nodes, pathOf };
}

/** The folder a drop onto `dirPath` means: '' for the root, null for Pinned/Archived (handled as pin/archive). */
export function folderForDrop(tree: ChatTree, dirPath: string | null): { folder: string } | { pin: true } | { archive: true } | null {
  if (!dirPath) return { folder: '' };
  const node = tree.nodes.get(dirPath.endsWith('/') ? dirPath : `${dirPath}/`);
  if (!node) return null;
  if (node.kind === 'folder') return { folder: node.folder };
  if (node.kind === 'section') return node.section === 'pinned' ? { pin: true } : { archive: true };
  return null; // onto a chat with sub-agents: not a place to file things
}
