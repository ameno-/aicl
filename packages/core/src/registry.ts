/**
 * Part renderer registry.
 *
 * The transcript dispatches on part type through this map rather than a
 * `switch`. A `switch` would mean every new part type requires a library
 * release; a registry lets consumers add domain parts at runtime while the
 * transcript renderer stays closed for modification.
 *
 * Renderers are typed as `unknown` here because core cannot name a framework's
 * component type. Adapters re-export a narrowed `createRendererRegistry` bound
 * to their own component type.
 */

import type { Part, PartType } from './types.js';

export interface RendererRegistry<R> {
  /** Renderer for `part`, or the fallback when the type is unregistered. */
  resolve(part: Part): R | undefined;
  register(type: string, renderer: R): void;
  /** Used for any part type without an explicit renderer. */
  setFallback(renderer: R): void;
  has(type: string): boolean;
}

export function createRendererRegistry<R>(
  initial: Partial<Record<PartType | string, R>> = {},
  fallback?: R,
): RendererRegistry<R> {
  const map = new Map<string, R>(Object.entries(initial) as Array<[string, R]>);
  let fallbackRenderer = fallback;

  return {
    resolve(part) {
      const exact = map.get(part.type);
      if (exact) return exact;

      // Allow a single `data-*` renderer to cover a family of custom parts,
      // e.g. registering 'data-' to catch 'data-invoice' and 'data-receipt'.
      if (part.type.startsWith('data-')) {
        const wildcard = map.get('data-');
        if (wildcard) return wildcard;
      }

      // Returning the fallback rather than throwing matters: a server that adds
      // a part type must not white-screen clients that predate it.
      return fallbackRenderer;
    },

    register(type, renderer) {
      map.set(type, renderer);
    },

    setFallback(renderer) {
      fallbackRenderer = renderer;
    },

    has(type) {
      return map.has(type);
    },
  };
}
