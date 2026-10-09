// Types for aicl-chat.js. The message model is AICL's (@aicl/core): a message is an
// ordered list of typed parts, streamed as StreamEvents.

export type Role = 'user' | 'assistant' | 'system';
export type ToolStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled';

export type Part =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string; durationMs?: number }
  | { type: 'tool-call'; toolCallId: string; name: string; args: unknown; status: ToolStatus; argsText?: string }
  | { type: 'tool-result'; toolCallId: string; result: unknown; isError?: boolean }
  | { type: 'artifact'; artifactId: string; kind: string; title?: string; version?: number }
  | { type: 'error'; message: string; retryable?: boolean }
  /** Pre-rendered, escaped HTML from the designed screen (plans, tables, code). */
  | { type: 'html'; html: string }
  | { type: `data-${string}`; data: unknown };

export interface Message {
  id: string;
  role: Role;
  parts: Part[];
  /** Part of the designed sample conversation: shown, never sent to the backend. */
  seed?: boolean;
  aborted?: boolean;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export type ChatStatus = 'idle' | 'submitted' | 'streaming' | 'aborted' | 'error';

export interface ChatState {
  messages: Message[];
  status: ChatStatus;
  error: { message: string; retryable?: boolean } | null;
}

export interface ChatOptions {
  /** Defaults to '/api/chat'. */
  endpoint?: string;
  initialMessages?: Message[];
  /** Extra headers per request, e.g. auth. A function is called on every send. */
  headers?: Record<string, string> | (() => Record<string, string>);
  /** Extra JSON body fields (model, temperature…) sent beside `messages`. */
  body?: Record<string, unknown>;
  /** Send the designed sample messages as history too. Default false. */
  sendSeedMessages?: boolean;
  fetch?: typeof fetch;
}

export interface Chat {
  getState(): ChatState;
  subscribe(listener: (state: ChatState) => void): () => void;
  send(text: string): Promise<void>;
  retry(): Promise<void>;
  stop(): void;
  clear(): void;
}

export function createChat(options?: ChatOptions): Chat;
export function readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>>;
export function renderMarkdown(source: string): string;
export function escapeHtml(text: string): string;
export function toolLabel(part: Extract<Part, { type: 'tool-call' }>): string;
export function reasoningLabel(part: Extract<Part, { type: 'reasoning' }>, streaming: boolean): string;
