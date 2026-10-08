/**
 * The workspace runtime contract ("moi computer", wave 1). Pure types and
 * constants shared by server and browser. Each work package implements one
 * part against this file; none of them change it.
 *
 *   A  sessions     — many persistent agent conversations (Pi sessions on disk)
 *   B  applets      — agent-written React widgets/views + server functions
 *   C  shell        — Agent / Canvas / Overview / Views tabs + copilot dock
 *   D  canvas agent — viewport/action context, arrange + focus tools, CLI
 */

import type { SwarmEvent } from './swarm.ts';
import type { SurfaceInfo, SurfaceKind } from './surfaces.ts';
import type { Message } from '@aicl/core';
import type { GraphEdge, GraphNode, HitlAnswer, HitlRequest, LivePlan, TerminalChunk } from './agentic.ts';

/* ── Sessions (A) ─────────────────────────────────────────────────── */

export interface SessionInfo {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: 'idle' | 'running' | 'error';
  /** Snippet of the last assistant text, for session lists. */
  preview?: string;
  /** 'chat' for normal conversations; 'node' for agents living on the canvas (wave 2). */
  kind: 'chat' | 'node';
  /** "provider/id" chosen for this session with POST /api/sessions/:id/model; absent = the workspace default. */
  model?: string;
  /** Multi-agent lineage (swarm): the session that spawned this one, the top of its tree, its role and task. */
  parentId?: string;
  rootId?: string;
  role?: string;
  task?: string;
  spawnedBy?: 'user' | 'agent';
  /** Tokens and cost summed over this session's assistant messages. */
  usage?: SessionUsage;
  /** What it is doing now: a tool call label, "thinking" or "writing"; only while running. */
  currentStep?: string;
  /** Start of the latest run, and its end (absent while running). */
  startedAt?: number;
  finishedAt?: number;
  /** The latest run was stopped by a user or a parent. */
  stopped?: boolean;
  /** Sidebar organisation (AICL-46): a folder path like "Work/Research", pinned to the top, or archived. */
  folder?: string;
  pinned?: boolean;
  archived?: boolean;
}

export interface SessionUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
}

/** An external client using the workspace (MCP bridge, CLI): GET /api/connections. */
export interface ClientConnection {
  /** "mcp:claude-code", "mcp", "cli"… */
  name: string;
  kind: 'mcp' | 'cli' | 'other';
  firstSeen: number;
  lastSeen: number;
  /** Tool calls made. */
  calls: number;
  lastTool?: string;
}

/** One entry of GET /api/models → { models: ModelOption[], default: string | null }. */
export interface ModelOption {
  /** "provider/id". */
  id: string;
  label: string;
  provider: string;
}

/** The conversation everything uses when no session is chosen. */
export const MAIN_SESSION_ID = 'main';

/*
 * HTTP (A):
 *   GET    /api/sessions                    → { sessions: SessionInfo[] }   (newest first)
 *   POST   /api/sessions  { title?, kind? } → { session: SessionInfo }
 *   PATCH  /api/sessions/:id  { title }     → { session: SessionInfo }
 *   DELETE /api/sessions/:id                → { ok: true }                  (main cannot be deleted)
 *   GET    /api/sessions/:id/messages       → { messages: Message[] }       (@aicl/core shape, for reload)
 *   POST   /api/sessions/:id/stop           → { ok: true }
 *   GET    /api/models[?all=1]              → { models: ModelOption[], default: string | null }
 *   POST   /api/sessions/:id/model { model } → { session: SessionInfo }     (409 while the session is running)
 *   GET    /api/files?dir=<rel>             → { dir, entries: [{ name, path, dir: boolean, size? }] }  (workspace only)
 *   GET    /api/file/text?path=<rel>        → { path, text, truncated }     (workspace only, text files)
 *   POST   /api/chat { messages, sessionId?, canvasContext? }  → SSE StreamEvents (sessionId defaults to MAIN)
 *   GET    /api/info                        → { workspace, model, busy }    (busy = any session running)
 */
export interface SessionMessagesResponse {
  messages: Message[];
}

/* ── Applets (B) ──────────────────────────────────────────────────── */

/**
 * An applet is one agent-written React module at
 *   <workspace>/.aicl/applets/<id>.tsx         default export = the component
 *   <workspace>/.aicl/applets/<id>.server.ts   optional: exported async functions (run on the server)
 * Files starting with `_` are shared code, never applets. The module may
 * `export const config: AppletConfig`.
 */
export type AppletKind = 'widget' | 'view';

export interface AppletConfig {
  title?: string;
  /** widget: a card (Overview grid or canvas). view: a full tab. Default widget. */
  kind?: AppletKind;
  /** lucide icon name, kebab-case. */
  icon?: string;
  /** Overview grid footprint, 1–4. */
  colSpan?: number;
  rowSpan?: number;
}

export interface AppletInfo {
  id: string;
  kind: AppletKind;
  title: string;
  icon?: string;
  colSpan: number;
  rowSpan: number;
  hasServer: boolean;
  /** Epoch ms of the last successful build. */
  builtAt?: number;
  /** Last build error, or a runtime error reported by the browser since then. */
  error?: string;
}

/*
 * HTTP (B):
 *   GET  /api/applets                        → { applets: AppletInfo[] }
 *   POST /api/applets/:id/build              → { ok: true, applet } | { ok: false, errors: string[] }
 *   GET  /api/applets/:id/bundle.js          → ESM module (see host runtime below)
 *   POST /api/applets/:id/rpc/:fn { args }   → { result } | { error }       (runs <id>.server.ts export `fn`)
 *   POST /api/applets/:id/log { message, stack? } → { ok: true }            (browser runtime errors)
 *   GET  /api/workspace                      → WorkspaceConfig
 *   PUT  /api/workspace  WorkspaceConfig     → { ok: true }
 */
export interface WorkspaceConfig {
  name: string;
  /** Widget applet ids shown on Overview, in order. */
  overview: string[];
}

/**
 * Host runtime for applet bundles. The page sets `window.__AICL_HOST__`
 * before loading any bundle; the bundler rewrites these bare imports to
 * read from it, so applets share the page's single React and library:
 *   'react', 'react/jsx-runtime', 'react-dom' → host.react / host.jsxRuntime / host.reactDom
 *   '@aicl/react', '@aicl/react/markdown', '@aicl/core' → host.aiclReact / host.aiclMarkdown / host.aiclCore
 *   'lucide-react' → host.lucide
 *   'aicl'        → host.intents (AppletIntents)
 *   './<id>.server' (and any '*.server' import) → RPC stubs calling /api/applets/:id/rpc/:fn
 */
export const HOST_GLOBAL = '__AICL_HOST__';

/** What an applet can ask the workspace to do (import { sendMessage } from 'aicl'). */
export interface AppletIntents {
  /** Send a user message to the agent (current session unless given). */
  sendMessage(text: string, options?: { sessionId?: string }): void;
  /** Stage context for the user's next message (shown as a chip above the composer). */
  addContext(context: { label: string; text: string }): void;
  /** Go to a workspace address. */
  navigate(address: WorkspaceAddress): void;
}

/* ── Shell (C) ────────────────────────────────────────────────────── */

/**
 * Workspace addresses, used by navigate(), links in chat, and the CLI:
 *   aicl:/agent            full-page chat (optionally aicl:/agent/<sessionId>)
 *   aicl:/canvas           the scratchpad
 *   aicl:/overview         widget grid
 *   aicl:/agents           live tree of all agents (swarm)
 *   aicl:/views/<appletId> one view applet
 */
export type WorkspaceAddress = `aicl:/${string}`;

export type WorkspaceRoute =
  | { tab: 'agent'; sessionId?: string }
  | { tab: 'canvas' }
  | { tab: 'overview' }
  | { tab: 'agents' }
  | { tab: 'view'; appletId: string };

export function parseAddress(address: string): WorkspaceRoute {
  const path = address.replace(/^aicl:\//, '').replace(/^#?\/?/, '');
  const [head, rest] = [path.split('/')[0], path.split('/').slice(1).join('/')];
  if (head === 'agent') return rest ? { tab: 'agent', sessionId: decodeURIComponent(rest) } : { tab: 'agent' };
  if (head === 'overview') return { tab: 'overview' };
  if (head === 'agents') return { tab: 'agents' };
  if (head === 'views' && rest) return { tab: 'view', appletId: decodeURIComponent(rest) };
  return { tab: 'canvas' };
}

export function formatAddress(route: WorkspaceRoute): WorkspaceAddress {
  switch (route.tab) {
    case 'agent':
      return route.sessionId ? `aicl:/agent/${encodeURIComponent(route.sessionId)}` : 'aicl:/agent';
    case 'overview':
      return 'aicl:/overview';
    case 'agents':
      return 'aicl:/agents';
    case 'view':
      return `aicl:/views/${encodeURIComponent(route.appletId)}`;
    default:
      return 'aicl:/canvas';
  }
}

/* ── Canvas agent (D) ─────────────────────────────────────────────── */

/** Sent with every prompt (extends the selection context). */
export interface CanvasContext {
  selectedShapes: string[];
  uiSelection: { shapeId: string; nodeId: string } | null;
  /** Page-space bounds of what the user is looking at. */
  viewport?: { x: number; y: number; w: number; h: number };
  /** The user's recent canvas actions, newest last (max ~20), e.g. "created note n1", "moved screen s2". */
  recentActions?: string[];
  /** Which workspace tab the user is on. */
  route?: WorkspaceRoute;
  /** What is near, inside, and connected to the selection (canvas graph, wave 2). */
  neighbourhood?: { nodes: GraphNode[]; edges: GraphEdge[] };
}

/* ── Server events (all) ──────────────────────────────────────────── */

/** Everything the server pushes over GET /api/events (besides scratch-op relay requests). */
export type ServerEvent =
  | { type: 'session'; session: SessionInfo }
  | { type: 'session-removed'; id: string }
  | { type: 'applet'; applet: AppletInfo }
  | { type: 'applet-removed'; id: string }
  | { type: 'navigate'; address: WorkspaceAddress }
  | { type: 'hitl'; request: HitlRequest }
  | { type: 'hitl-resolved'; id: string; answer: HitlAnswer }
  | { type: 'plan'; plan: LivePlan }
  | { type: 'terminal'; chunk: TerminalChunk }
  | { type: 'surface'; surface: SurfaceInfo }
  | { type: 'surface-removed'; kind: SurfaceKind; id: string }
  | { type: 'session-folders'; folders: string[] }
  | { type: 'connection'; connection: ClientConnection }
  | { type: 'swarm'; event: SwarmEvent };
