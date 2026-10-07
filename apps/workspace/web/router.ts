import { useSyncExternalStore } from 'react';
import { formatAddress, parseAddress, type WorkspaceAddress, type WorkspaceRoute } from '../shared/runtime.ts';

/**
 * Hash routing for the workspace tabs: #/agent, #/canvas, #/overview,
 * #/views/<id>. Addresses (aicl:/…) are the public form; the hash mirrors
 * them so reloads, links, and back/forward work.
 */

const read = (): WorkspaceRoute => parseAddress(window.location.hash.replace(/^#\/?/, 'aicl:/'));

let current: WorkspaceRoute = typeof window === 'undefined' ? { tab: 'canvas' } : read();
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    current = read();
    for (const l of [...listeners]) l();
  });
}

export function getRoute(): WorkspaceRoute {
  return current;
}

export function navigate(address: WorkspaceAddress | WorkspaceRoute): void {
  const route = typeof address === 'string' ? parseAddress(address) : address;
  const hash = '#/' + formatAddress(route).replace(/^aicl:\//, '');
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
