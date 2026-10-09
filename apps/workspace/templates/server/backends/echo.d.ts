import type { ChatBackend } from '../backend.js';

export function createEchoBackend(options?: { delayMs?: number }): ChatBackend;
