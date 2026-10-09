import type { Server } from 'node:http';
import type { ChatBackend } from './backend.js';

export function pickBackend(env?: Record<string, string | undefined>): Promise<{ name: string; backend: ChatBackend }>;
export function startServer(env?: Record<string, string | undefined>): Promise<Server>;
