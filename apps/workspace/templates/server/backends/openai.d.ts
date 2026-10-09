import type { ChatBackend } from '../backend.js';

/** `options.client` injects an OpenAI SDK client; otherwise one is created from the environment. */
export function createOpenAIBackend(env?: Record<string, string | undefined>, options?: { client?: unknown }): ChatBackend;
