import type { ChatBackend } from '../backend.js';

/** `options.client` injects an Anthropic SDK client; otherwise one is created from the environment. */
export function createAnthropicBackend(env?: Record<string, string | undefined>, options?: { client?: unknown }): ChatBackend;
