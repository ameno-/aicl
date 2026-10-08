import { useSyncExternalStore } from 'react';
import { formatAddress, parseAddress, type WorkspaceAddress, type WorkspaceRoute } from '../shared/runtime.ts';

/**
 * Hash routing for the workspace tabs: #/agent, #/canvas, #/overview,
 * #/views/<id>. Addresses (aicl:/…) are the public form; the hash mirrors
 * them so reloads, links, and back/forward work.
 */

const read = (): WorkspaceRoute => parseAddress(window.location.hash.replace(/^#\/?/, 'aicl:/'));

let current: WorkspaceRoute = typeof window === 'undefined' ? { tab: 'canvas' } : read();
/** Canvas-first mode (AICL-41): `aicl:/canvas?mode=focus`. The query rides in the hash; the route itself stays a plain canvas route. */
const readFocus = (): boolean => /^#\/?canvas\?(.*&)?mode=focus(&|$)/.test(window.location.hash);
let focus = typeof window === 'undefined' ? false : readFocus();
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    current = read();
    focus = readFocus();
    for (const l of [...listeners]) l();
  });
}

export const getFocusMode = (): boolean => focus;

export function setFocusMode(on: boolean): void {
  window.location.hash = on ? '#/canvas?mode=focus' : '#/canvas';
}

export function useFocusMode(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getFocusMode,
    getFocusMode,
  );
}

export function getRoute(): WorkspaceRoute {
  return current;
}

export function navigate(address: WorkspaceAddress | WorkspaceRoute): void {
  const route = typeof address === 'string' ? parseAddress(address) : address;
  const wantsFocus = typeof address === 'string' && route.tab === 'canvas' && /[?&]mode=focus(&|$)/.test(address);
  const hash = wantsFocus ? '#/canvas?mode=focus' : '#/' + formatAddress(route).replace(/^aicl:\//, '');
  if (window.location.hash !== hash) window.location.hash = hash;
}

export function useRoute(): WorkspaceRoute {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getRoute,
    getRoute,
  );
}
