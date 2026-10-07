/**
 * The shape every wave-2 feature module returns (server/hitl.ts, live.ts,
 * nodes.ts, graph.ts). main.ts collects routes, tools, prompt fragments,
 * Pi extensions, and agent-event listeners from each.
 */
import type { InlineExtension, ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { RouteTable } from './http.ts';
import type { Relay } from './relay.ts';
import type { SessionHub } from './sessions.ts';

export interface FeatureContext {
  workspace: string;
  relay: Relay;
  /** The session hub; call it lazily (it exists after the agent factory is built). */
  hub(): SessionHub;
}

export interface FeatureModule {
  routes: RouteTable;
  tools: ToolDefinition[];
  /** Appended to the agent's system prompt. */
  prompt?: string;
  /** Pi inline extensions (e.g. a tool_call gate). */
  extensions?: InlineExtension[];
  /** Extra hidden <canvas-context> text for a session's prompt (e.g. an agent node's role and inputs); '' for none. */
  contextFor?(sessionId: string): Promise<string>;
  /** Every Pi event of every session. */
  onAgentEvent?(sessionId: string, event: unknown): void;
}

export const emptyFeature = (): FeatureModule => ({ routes: {}, tools: [] });
