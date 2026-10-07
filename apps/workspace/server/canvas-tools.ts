/**
 * Canvas agent upgrades (work package D): arrange/focus tools and the HTTP
 * tool API used by the `aicl` CLI for external agents.
 * CONTRACT: shared/runtime.ts. D implements; main.ts already mounts `routes` and `tools`.
 */
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { RouteTable } from './http.ts';
import type { Relay } from './relay.ts';

/** Appended to the agent's system prompt: viewport/actions context and arranging. D fills it in. */
export const CANVAS_PROMPT = '';

export interface CanvasToolsModule {
  tools: ToolDefinition[];
  /** Built after all tools exist, so the CLI can call any of them. */
  routes(allTools: ToolDefinition[]): RouteTable;
}

export function createCanvasTools(options: { relay: Relay }): CanvasToolsModule {
  void options;
  return { tools: [], routes: () => ({}) };
}
