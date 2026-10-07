/**
 * The page's single connection to GET /api/events.
 *
 * There must be exactly one: the relay sends agent canvas ops to the most
 * recently connected client, so a second EventSource would steal them.
 * Everything that needs server events subscribes here.
 */
import type { ServerEvent } from '../shared/runtime.ts';
import type { ScratchOp } from '../shared/scratch.ts';

export type ScratchOpEvent = { type: 'scratch-op'; id: string; op: ScratchOp };
type AnyEvent = ServerEvent | ScratchOpEvent;
type Handler<T extends AnyEvent['type']> = (event: Extract<AnyEvent, { type: T }>) => void;

const handlers = new Map<string, Set<(e: AnyEvent) => void>>();
let source: EventSource | null = null;

function ensure(): void {
  if (source || typeof EventSource === 'undefined') return;
  source = new EventSource('/api/events');
  source.onmessage = (message) => {
    let event: AnyEvent;
    try {
      event = JSON.parse(message.data) as AnyEvent;
    } catch {
      return;
    }
    handlers.get(event.type)?.forEach((h) => h(event));
  };
}

/** Subscribe to one event type; returns an unsubscribe function. */
export function onServerEvent<T extends AnyEvent['type']>(type: T, handler: Handler<T>): () => void {
  ensure();
  let set = handlers.get(type);
  if (!set) handlers.set(type, (set = new Set()));
  const h = handler as (e: AnyEvent) => void;
  set.add(h);
  return () => set!.delete(h);
}
