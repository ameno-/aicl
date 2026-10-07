/**
 * App preferences (AICL-34): appearance, motion, and where the panels are.
 * One tiny persisted store; every view reads it through usePrefs().
 */
import { useSyncExternalStore } from 'react';
import { resolveTheme } from '../../shared/ui-spec.ts';
import type { ProviderKit } from '../../shared/kits.ts';

export type ThemeMode = 'kit' | 'light' | 'dark' | 'system';

export interface Prefs {
  /** 'kit': the kit's own palette; 'system' follows the OS. */
  theme: ThemeMode;
  reducedMotion: boolean;
  sidebarCollapsed: boolean;
  workPanelOpen: boolean;
  /** px once the user has dragged the edge; 0 = the kit's default (preview kits: most of the page). */
  workPanelWidth: number;
  /** The work panel's active tab (or the computer panel's pinned step: see WorkPanel). */
  workTab: string | null;
}

const KEY = 'aicl.prefs';
const DEFAULTS: Prefs = { theme: 'kit', reducedMotion: false, sidebarCollapsed: false, workPanelOpen: false, workPanelWidth: 0, workTab: null };

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>) };
  } catch {
    return DEFAULTS;
  }
}

let current: Prefs = typeof window === 'undefined' ? DEFAULTS : load();
const listeners = new Set<() => void>();

export function setPrefs(patch: Partial<Prefs>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode: preferences last for this page */
  }
  for (const l of [...listeners]) l();
}

export const getPrefs = (): Prefs => current;

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}

const darkQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

/** Re-renders on OS appearance changes (only matters for theme 'system'). */
export function usePrefersDark(): boolean {
  return useSyncExternalStore(
    (l) => {
      darkQuery?.addEventListener('change', l);
      return () => darkQuery?.removeEventListener('change', l);
    },
    () => darkQuery?.matches ?? false,
    () => false,
  );
}

/** The kit with the user's light/dark choice applied to its tokens. */
export function withTheme(kit: ProviderKit, theme: ThemeMode, prefersDark: boolean): ProviderKit {
  const mode = theme === 'kit' ? kit.tokens.mode : theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  if (mode === kit.tokens.mode) return kit;
  return { ...kit, tokens: resolveTheme({ preset: kit.preset, overrides: { mode } }) };
}

/** Next appearance for the "toggle theme" command: flips what is on screen now. */
export function toggledTheme(kit: ProviderKit, theme: ThemeMode, prefersDark: boolean): ThemeMode {
  return withTheme(kit, theme, prefersDark).tokens.mode === 'dark' ? 'light' : 'dark';
}
