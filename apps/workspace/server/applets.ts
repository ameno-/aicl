/**
 * Applets: agent-written React widgets/views + server functions (work package B).
 * CONTRACT: shared/runtime.ts. B implements; main.ts already mounts `routes` and `tools`.
 */
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { RouteTable } from './http.ts';
import type { Relay } from './relay.ts';

export interface AppletsModule {
  routes: RouteTable;
  tools: ToolDefinition[];
}

export function createApplets(options: { workspace: string; relay: Relay }): AppletsModule {
  void options;
  return { routes: {}, tools: [] };
}
