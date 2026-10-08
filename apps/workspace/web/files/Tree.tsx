/**
 * Workspace file tree, drawn by @pierre/trees (https://trees.software):
 * path-first, virtualized, with built-in search, keyboard navigation and git
 * status markers. Selecting a file opens it.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { FileTree, useFileTree } from '@pierre/trees/react';
import type { GitStatus, GitStatusEntry } from '@pierre/trees';
import type { GitStatus as RepoStatus, GitStatusFile } from '../../shared/git.ts';
import './files.css';

export interface TreeProps {
  /** Called when a file is activated (selected). */
  onOpen(path: string): void;
  /** Reload paths and git status when this changes (e.g. after the agent edits files). */
  refreshKey?: unknown;
  /** The tree's own filter box; off when the host already has a search (the ⌘P picker). */
  search?: boolean;
  className?: string;
}

/** The tree's own CSS variables, mapped onto AICL tokens so it follows the kit. */
const THEME = {
  '--trees-fg-override': 'var(--aicl-text)',
  '--trees-bg-override': 'transparent',
  '--trees-border-color-override': 'var(--aicl-border)',
  '--trees-selected-bg-override': 'var(--aicl-accent-soft)',
  height: '100%',
} as CSSProperties;

function statusOf(f: GitStatusFile): GitStatus {
  const code = f.index !== ' ' && f.index !== '?' ? f.index : f.worktree;
  if (code === '?') return 'untracked';
  if (code === 'A') return 'added';
  if (code === 'D') return 'deleted';
  if (code === 'R') return 'renamed';
  return 'modified';
}

async function loadGitStatus(): Promise<GitStatusEntry[]> {
  try {
    const s = (await (await fetch('/api/git/status')).json()) as RepoStatus;
    if (!s.repo) return [];
    const seen = new Map<string, GitStatus>();
    for (const f of [...s.untracked, ...s.unstaged, ...s.staged]) seen.set(f.path, statusOf(f));
    return [...seen].map(([path, status]) => ({ path, status }));
  } catch {
    return [];
  }
}

export function Tree({ onOpen, refreshKey, search = true, className }: TreeProps) {
  const open = useRef(onOpen);
  open.current = onOpen;
  const { model } = useFileTree({
    paths: [],
    search,
    flattenEmptyDirectories: true,
    onSelectionChange: (selected) => {
      const path = selected[selected.length - 1];
      // Directories end with "/"; selecting one just expands it.
      if (path && !path.endsWith('/')) open.current(path);
    },
  });

  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.all([fetch('/api/surfaces/files/paths').then((r) => r.json() as Promise<{ paths: string[] }>), loadGitStatus()])
      .then(([{ paths }, git]) => {
        if (!live) return;
        model.resetPaths(paths);
        setCount(paths.length);
        model.setGitStatus(git);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [model, refreshKey]);

  if (count === 0) {
    return (
      <div className="files-empty">
        <p>No files in this workspace yet.</p>
        <p>Files the assistant creates, and anything you add to the folder, appear here.</p>
      </div>
    );
  }
  return <FileTree model={model} className={className ? `files-tree ${className}` : 'files-tree'} style={THEME} />;
}
