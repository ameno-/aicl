/**
 * Wave 2 contract: functional agentic components and the canvas graph.
 * Pure types and constants shared by server and browser. Each work package
 * implements one part; none of them change this file.
 *
 *   A  human-in-the-loop — the agent asks (question cards) and waits for OKs (approval gates)
 *   B  live work         — the agent's plan and its shell output, live in chat and on the canvas
 *   C  agent nodes       — independent agents living on the canvas, wired by arrows
 *   D  run mode          — a designed screen drives a real agent
 *   E  canvas graph      — what is near, inside, and connected to what (context + state)
 */

/* ── A: human in the loop ─────────────────────────────────────────── */

export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
}

/** A pending request for the user. Rendered as a card in chat and (optionally) on the canvas. */
export type HitlRequest =
  | {
      kind: 'question';
      id: string;
      sessionId: string;
      toolCallId?: string;
      question: string;
      options: QuestionOption[];
      /** Allow several options. */
      multiple?: boolean;
      /** Allow a free-text answer. */
      allowText?: boolean;
      createdAt: number;
    }
  | {
      kind: 'approval';
      id: string;
      sessionId: string;
      toolCallId?: string;
      /** The gated tool, e.g. "bash", "write". */
      tool: string;
      /** Human summary, e.g. "Run `npm install zod`" or "Write src/app.ts (42 lines)". */
      summary: string;
      /** Raw tool input, for an expandable detail view. */
      input: unknown;
      createdAt: number;
    };

export type HitlAnswer =
  | { kind: 'question'; optionIds: string[]; text?: string }
  | { kind: 'approval'; approved: boolean; note?: string };

/*
 * HTTP (A):
 *   GET  /api/hitl                 → { pending: HitlRequest[] }
 *   POST /api/hitl/:id  HitlAnswer → { ok: true }   (resolves the waiting tool call)
 * Tool (A): ask_user { question, options[], multiple?, allowText? } → blocks until answered; result names the choice.
 * Gate (A): bash, and write/edit outside .aicl/applets, wait for approval (Pi `tool_call` extension hook).
 */

/** Tools that always need approval, and the path prefix that write/edit may touch freely. */
export const GATED_TOOLS = ['bash', 'terminal_run'] as const;
export const FREE_WRITE_PREFIX = '.aicl/';

/* ── B: live work ─────────────────────────────────────────────────── */

export interface LivePlanStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export interface LivePlan {
  sessionId: string;
  title?: string;
  steps: LivePlanStep[];
  updatedAt: number;
}

/** One streamed chunk of a running shell command. */
export interface TerminalChunk {
  sessionId: string;
  toolCallId: string;
  command?: string;
  /** New output since the last chunk. */
  text: string;
  done?: boolean;
  exitCode?: number;
}

/*
 * HTTP (B):
 *   GET /api/sessions/:id/plan              → { plan: LivePlan | null }
 *   GET /api/sessions/:id/terminal/:toolId  → { lines: string[], done: boolean, command?: string }
 * Tool (B): plan_update { title?, steps: [{ id?, label, status }] } — the agent's own todo list.
 * Chat: tool calls named plan_update render as the live plan; bash tool calls render as a live terminal.
 */

/* ── C: agent nodes ───────────────────────────────────────────────── */

/** Props of the canvas component "agent": one independent agent on the canvas. */
export interface AgentNodeProps {
  /** Its own session (kind 'node'). Created on first render when absent. */
  sessionId?: string;
  name: string;
  /** Standing instructions, prepended to every message the node receives. */
  role?: string;
}

/*
 * Arrows between agent nodes (and from other shapes into a node) are inputs:
 * when a node runs, it is told what its incoming neighbours contain (via the
 * canvas graph). Tool (C): agent_send { to: <agent node shape id>, message } →
 * runs that node's agent with the message; returns its reply.
 * HTTP (C): POST /api/nodes/:shapeId/run { message } → { reply }.
 */

/* ── D: run mode ──────────────────────────────────────────────────── */

/*
 * A screen in 'run' mode is a live app: its composer sends to a real session
 * (a 'node' session bound to the screen, stored on the spec as
 * runSessionId), and its thread container renders that session's messages
 * with the screen's own element styles (userMessage, assistantMessage,
 * reasoning, toolStep, plan). The screen toolbar gains Run / Design.
 */
export const RUN_THREAD_ID = 'thread';
export const RUN_COMPOSER_ID = 'composer';

/* ── E: canvas graph ──────────────────────────────────────────────── */

export type GraphNodeKind = 'component' | 'screen' | 'agent' | 'note' | 'text' | 'shape' | 'arrow' | 'image' | 'frame' | 'group';

export interface GraphNode {
  /** Short shape id (no "shape:" prefix). */
  id: string;
  kind: GraphNodeKind;
  /** Component name for kind component/screen/agent ("plan", "chat", …). */
  component?: string;
  /** Human label: title, text, or name (≤ 60 chars). */
  label: string;
  bounds: { x: number; y: number; w: number; h: number };
  /** Live state worth tracking (plan progress, agent status, screen name…). */
  state?: Record<string, unknown>;
}

export type GraphEdgeKind =
  | 'contains' // frame/group parent → child, or a shape fully inside another card
  | 'connects' // an arrow bound from → to (label = arrow text)
  | 'near' // within NEAR_DISTANCE of each other's bounds (symmetric; one edge per pair)
  | 'overlaps';

export interface GraphEdge {
  from: string;
  to: string;
  kind: GraphEdgeKind;
  /** connects: the arrow's text; near: the gap in page px. */
  label?: string;
  distance?: number;
}

export interface CanvasGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  builtAt: number;
}

/** Bounds closer than this (page px, gap between edges) count as "near". */
export const NEAR_DISTANCE = 160;

/*
 * Where it lives: built in the browser from the live tldraw store (the
 * authority), pushed to the server on change (PUT /api/graph, debounced), and
 * readable by tools (canvas_graph { focus?, depth? }) and the CLI. The
 * <canvas-context> block gains "neighbourhood": the selection's near,
 * contained, and connected nodes, so "this" comes with its surroundings.
 *   GET /api/graph?focus=<id>&depth=<n> → CanvasGraph (subgraph when focused)
 */
