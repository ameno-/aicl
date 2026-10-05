/**
 * Core conversation model. Framework-agnostic and DOM-free by construction.
 *
 * Derived from a survey of 1,262 screens across four shipping agentic-chat
 * products. Where a choice here looks over-general, it is because at least one
 * surveyed product needs it; where it looks narrow, no surveyed product needed
 * more.
 */

export type Role = 'user' | 'assistant' | 'system';

export type ToolStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled';

export type ArtifactKind =
  | 'code'
  | 'document'
  | 'diff'
  | 'preview'
  | 'terminal'
  | 'table'
  | 'chart';

export type FinishReason =
  | 'stop'
  | 'length'
  | 'tool-calls'
  | 'content-filter'
  | 'aborted'
  | 'error';

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  /** Surfaced by three of four surveyed products, so it is first-class. */
  costUsd?: number;
}

/* -------------------------------------------------------------------------- */
/* Parts                                                                       */
/* -------------------------------------------------------------------------- */

export interface TextPart {
  type: 'text';
  text: string;
}

/**
 * Chain-of-thought or planning output shown in a collapsible block.
 * Kept distinct from `text` because it is styled differently, is collapsed by
 * default, and must be excluded when copying a message.
 */
export interface ReasoningPart {
  type: 'reasoning';
  text: string;
  collapsed?: boolean;
  /** Present once the block is complete; drives "Thought for 12s" labels. */
  durationMs?: number;
}

export interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  name: string;
  args: unknown;
  status: ToolStatus;
  /** Args stream in as text before they parse; UIs show a shimmer meanwhile. */
  argsText?: string;
}

export interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  result: unknown;
  isError?: boolean;
}

export interface FilePart {
  type: 'file';
  mediaType: string;
  url: string;
  name?: string;
  size?: number;
  /** Set while an upload is still in flight so the chip can show progress. */
  uploadProgress?: number;
}

/**
 * A staged draft attachment. Not a `Part` yet: it has no URL, can be removed,
 * and can fail. `toFilePart` converts it once the host has uploaded it.
 */
export interface Attachment {
  id: string;
  mediaType: string;
  name: string;
  size?: number;
  previewUrl?: string;
  status: 'uploading' | 'ready' | 'error';
  /** 0–1 while uploading. */
  progress?: number;
}

export function toFilePart(attachment: Attachment, url: string): FilePart {
  return {
    type: 'file',
    mediaType: attachment.mediaType,
    url,
    name: attachment.name,
    ...(attachment.size !== undefined ? { size: attachment.size } : {}),
  };
}

/** A structured reference inserted by a mention menu; `range` indexes the draft text. */
export interface Mention {
  id: string;
  label: string;
  range: [number, number];
  metadata?: Record<string, unknown>;
}

export interface CitationPart {
  type: 'citation';
  sourceId: string;
  quote?: string;
  url?: string;
  title?: string;
}

export interface ArtifactPart {
  type: 'artifact';
  artifactId: string;
  kind: ArtifactKind;
  title?: string;
  /** Artifacts are versioned in every product that has them. */
  version?: number;
}

export interface ErrorPart {
  type: 'error';
  message: string;
  retryable?: boolean;
  code?: string;
}

/**
 * Consumer-defined parts. The `data-` prefix keeps custom types from ever
 * colliding with types added to the core union later.
 */
export interface DataPart {
  type: `data-${string}`;
  data: unknown;
}

export type Part =
  | TextPart
  | ReasoningPart
  | ToolCallPart
  | ToolResultPart
  | FilePart
  | CitationPart
  | ArtifactPart
  | ErrorPart
  | DataPart;

export type PartType = Part['type'];

/* -------------------------------------------------------------------------- */
/* Messages                                                                    */
/* -------------------------------------------------------------------------- */

export interface Message {
  id: string;
  role: Role;
  parts: Part[];
  createdAt?: number;
  /**
   * Set when the turn was interrupted. The partial content is retained rather
   * than discarded, matching the behaviour of every surveyed product.
   */
  aborted?: boolean;
  usage?: Usage;
  metadata?: Record<string, unknown>;
}

/**
 * Branching. Editing a user message forks the conversation rather than
 * destroying history, so the transcript is a tree that is rendered as the
 * currently selected path.
 */
export interface MessageNode {
  message: Message;
  parentId: string | null;
  childIds: string[];
}

/* -------------------------------------------------------------------------- */
/* Conversation status                                                         */
/* -------------------------------------------------------------------------- */

/**
 * `submitted` is deliberately separate from `streaming`: between the request
 * leaving and the first event arriving there is nothing to render and nothing to
 * abort, but further submits must still be rejected. Collapsing the two is the
 * usual cause of double-submitting send buttons.
 */
export type ChatStatus =
  | 'idle'
  | 'submitted'
  | 'streaming'
  | 'aborted'
  | 'error';

export interface ChatState {
  status: ChatStatus;
  /** Insertion-ordered node map; never a nested tree, to keep appends O(1). */
  nodes: Record<string, MessageNode>;
  /** Ids along the currently selected branch, root-first. */
  path: string[];
  error?: { message: string; retryable?: boolean };
  /** Id of the assistant message currently being written, if any. */
  streamingId?: string;
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                   */
/* -------------------------------------------------------------------------- */

export type StreamEvent =
  | { type: 'message-start'; id: string; role: 'assistant' }
  | { type: 'part-start'; index: number; part: Part }
  /** Appends to the part at `index`; avoids resending the whole part per token. */
  | { type: 'part-delta'; index: number; delta: string }
  | { type: 'part-end'; index: number; part?: Part }
  | { type: 'message-end'; finishReason: FinishReason; usage?: Usage }
  | { type: 'error'; error: { message: string; retryable?: boolean } };

export interface SendRequest {
  /** Messages along the active branch, oldest first. */
  messages: Message[];
  /** Opaque to the library; forwarded verbatim to the backend. */
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * The entire I/O surface of the library. Implement this to drive the components
 * from any backend, or from an in-memory fake in tests.
 */
export interface ChatTransport {
  send(req: SendRequest, signal: AbortSignal): AsyncIterable<StreamEvent>;
}

/* -------------------------------------------------------------------------- */
/* Store                                                                       */
/* -------------------------------------------------------------------------- */

export interface ReadableStore<T> {
  get(): T;
  subscribe(listener: (value: T) => void): () => void;
}
