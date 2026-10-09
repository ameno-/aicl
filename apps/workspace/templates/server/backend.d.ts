// Types for backend.js: the interface a chat backend implements.

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: Array<{ type: string; text?: string; [key: string]: unknown }>;
}

/** One AICL stream event (see backend.js for the full list). */
export type StreamEvent = { type: string; [key: string]: unknown };

export interface ChatBackend {
  stream(input: { messages: Message[]; body: Record<string, unknown>; signal: AbortSignal }): AsyncIterable<StreamEvent>;
}

export function textOf(message: Message): string;
export function toTurns(messages: Message[]): { system: string; turns: Array<{ role: 'user' | 'assistant'; content: string }> };
export function partIndexer(): (key: string | number) => number;
