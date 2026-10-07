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

import type { Message } from '@aicl/core';

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
 *   aicl:/views/<appletId> one view applet
 */
export type WorkspaceAddress = `aicl:/${string}`;

export type WorkspaceRoute =
  | { tab: 'agent'; sessionId?: string }
  | { tab: 'canvas' }
  | { tab: 'overview' }
  | { tab: 'view'; appletId: string };

export function parseAddress(address: string): WorkspaceRoute {
  const path = address.replace(/^aicl:\//, '').replace(/^#?\/?/, '');
  const [head, rest] = [path.split('/')[0], path.split('/').slice(1).join('/')];
  if (head === 'agent') return rest ? { tab: 'agent', sessionId: decodeURIComponent(rest) } : { tab: 'agent' };
  if (head === 'overview') return { tab: 'overview' };
  if (head === 'views' && rest) return { tab: 'view', appletId: decodeURIComponent(rest) };
  return { tab: 'canvas' };
}

export function formatAddress(route: WorkspaceRoute): WorkspaceAddress {
  switch (route.tab) {
    case 'agent':
      return route.sessionId ? `aicl:/agent/${encodeURIComponent(route.sessionId)}` : 'aicl:/agent';
    case 'overview':
      return 'aicl:/overview';
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
}

/* ── Server events (all) ──────────────────────────────────────────── */

/** Everything the server pushes over GET /api/events (besides scratch-op relay requests). */
export type ServerEvent =
  | { type: 'session'; session: SessionInfo }
  | { type: 'session-removed'; id: string }
  | { type: 'applet'; applet: AppletInfo }
  | { type: 'applet-removed'; id: string }
  | { type: 'navigate'; address: WorkspaceAddress };
