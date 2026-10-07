/**
 * Which session a tool call belongs to. Tools are shared by every session;
 * Pi hands each execute() a context whose sessionManager knows its file, and
 * the hub maps files to session ids. main.ts registers the resolver.
 */
import { MAIN_SESSION_ID } from '../shared/runtime.ts';

type Resolver = (file: string | undefined) => string | undefined;
let resolver: Resolver = () => undefined;

export function setSessionResolver(next: Resolver): void {
  resolver = next;
}

/** The session id for a tool's `ctx` (5th execute argument); MAIN when unknown. */
export function sessionIdFromToolContext(ctx: unknown): string {
  const sm = (ctx as { sessionManager?: { getSessionFile?: () => string | undefined } } | undefined)?.sessionManager;
  return resolver(sm?.getSessionFile?.()) ?? MAIN_SESSION_ID;
}
