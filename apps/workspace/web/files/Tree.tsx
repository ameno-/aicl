/** Workspace file tree: lazy directories, keyboard navigation (↑ ↓ expand with → collapse with ← Enter opens). */
import { ChevronDown, ChevronRight, File, Folder } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { listTree, type TreeEntry } from './api.ts';
import './files.css';

export interface TreeProps {
  /** Called when a file is activated (click or Enter). */
  onOpen(path: string): void;
  /** Reload everything when this changes (e.g. after the agent edits files). */
  refreshKey?: unknown;
  dotfiles?: boolean;
  className?: string;
}

interface Row {
  entry: TreeEntry;
  depth: number;
}

export function Tree({ onOpen, refreshKey, dotfiles = false, className }: TreeProps) {
  const [children, setChildren] = useState<Record<string, TreeEntry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (dir: string) =>
      listTree(dir, dotfiles)
        .then((r) => setChildren((c) => ({ ...c, [dir]: r.entries })))
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'could not list files')),
    [dotfiles],
  );

  useEffect(() => {
    setError(null);
    void load('');
    for (const dir of expanded) void load(dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on toggle/refresh only
  }, [load, refreshKey]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    const walk = (dir: string, depth: number) => {
      for (const entry of children[dir] ?? []) {
        out.push({ entry, depth });
        if (entry.dir && expanded.has(entry.path)) walk(entry.path, depth + 1);
      }
    };
    walk('', 0);
    return out;
  }, [children, expanded]);

  const toggle = (dir: string, open: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(dir);
      else next.delete(dir);
      return next;
    });
    if (open && !children[dir]) void load(dir);
  };

  const activate = (entry: TreeEntry) => {
    setCursor(entry.path);
    if (entry.dir) toggle(entry.path, !expanded.has(entry.path));
    else onOpen(entry.path);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!rows.length) return;
    const i = Math.max(0, rows.findIndex((r) => r.entry.path === cursor));
    const row = rows[i]!;
    const move = (to: number) => {
      e.preventDefault();
      setCursor(rows[Math.min(rows.length - 1, Math.max(0, to))]!.entry.path);
    };
    switch (e.key) {
      case 'ArrowDown':
        return move(cursor ? i + 1 : 0);
      case 'ArrowUp':
        return move(i - 1);
      case 'Home':
        return move(0);
      case 'End':
        return move(rows.length - 1);
      case 'ArrowRight':
        e.preventDefault();
        if (row.entry.dir) {
          if (!expanded.has(row.entry.path)) toggle(row.entry.path, true);
          else move(i + 1);
        }
        return;
      case 'ArrowLeft': {
        e.preventDefault();
        if (row.entry.dir && expanded.has(row.entry.path)) return toggle(row.entry.path, false);
        const parent = row.entry.path.includes('/') ? row.entry.path.slice(0, row.entry.path.lastIndexOf('/')) : null;
        if (parent) setCursor(parent);
        return;
      }
      case 'Enter':
      case ' ':
        e.preventDefault();
        return activate(row.entry);
    }
  };

  return (
    <div className={`ft ${className ?? ''}`} role="tree" tabIndex={0} onKeyDown={onKeyDown} aria-label="Workspace files">
      {error && <div className="ft-empty">{error}</div>}
      {!error && !rows.length && children[''] && <div className="ft-empty">No files.</div>}
      {rows.map(({ entry, depth }) => {
        const open = entry.dir && expanded.has(entry.path);
        return (
          <div
            key={entry.path}
            role="treeitem"
            aria-selected={cursor === entry.path}
            aria-expanded={entry.dir ? open : undefined}
            className="ft-row"
            style={{ paddingLeft: 6 + depth * 14 }}
            data-path={entry.path}
            onClick={() => activate(entry)}
          >
            {entry.dir ? open ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden /> : <span style={{ width: 13 }} />}
            {entry.dir ? <Folder size={13} aria-hidden /> : <File size={13} aria-hidden />}
            <span className="ft-name">{entry.name}</span>
          </div>
        );
      })}
    </div>
  );
}
