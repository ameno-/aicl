/**
 * Work frames (AICL-41): the canvas as the shared design space.
 *
 * Listens to the surface index's broadcasts. When an AGENT opens a surface
 * (terminal, browser, file, diff, review…) for a session, and a canvas is
 * connected, it asks the canvas to put a card for it inside that session's
 * frame (a `workframe` op; web/workspace/frames.ts places it). Each surface
 * is announced once: the canvas also refuses a surface it already shows, so a
 * reload or a second event never adds a twin. Sub-agents work in their
 * root's frame.
 */
import type { SessionInfo } from '../shared/runtime.ts';
import type { SurfaceInfo } from '../shared/surfaces.ts';
import type { Relay } from './relay.ts';

export interface WorkframeDeps {
  relay: Pick<Relay, 'connected' | 'request'>;
  session(id: string): Pick<SessionInfo, 'id' | 'title' | 'parentId' | 'rootId'> | undefined;
}

/** The session whose frame holds `sessionId`'s work: its root (walking parents), else itself. */
export function frameOwner(deps: Pick<WorkframeDeps, 'session'>, sessionId: string): string {
  let at = deps.session(sessionId);
  for (let guard = 0; at?.parentId && guard < 20; guard++) {
    const parent = deps.session(at.parentId);
    if (!parent) break;
    at = parent;
  }
  return at?.rootId && deps.session(at.rootId) ? at.rootId : (at?.id ?? sessionId);
}

export function createWorkframes(deps: WorkframeDeps) {
  const announced = new Set<string>();
  let chain: Promise<void> = Promise.resolve();

  const place = (surface: SurfaceInfo): void => {
    const key = `${surface.kind}/${surface.id}`;
    if (announced.has(key) || !surface.sessionId || !deps.relay.connected) return;
    announced.add(key);
    const owner = frameOwner(deps, surface.sessionId);
    const title = deps.session(owner)?.title || 'Session';
    chain = chain.then(async () => {
      try {
        await deps.relay.request({
          op: 'workframe',
          sessionId: owner,
          title,
          surface: { kind: surface.kind, id: surface.id, title: surface.title },
        });
      } catch (cause) {
        // Not placed: let a later event try again.
        announced.delete(key);
        console.warn('[workframes] card skipped:', cause instanceof Error ? cause.message : cause);
      }
    });
  };

  return {
    /** Pass every event the surface registry broadcasts. */
    onEvent(payload: unknown): void {
      const event = payload as { type?: string; surface?: SurfaceInfo };
      if (event?.type === 'surface' && event.surface?.openedBy === 'agent') place(event.surface);
    },
    /** Resolves when pending placements were sent (tests). */
    idle: (): Promise<void> => chain,
  };
}
