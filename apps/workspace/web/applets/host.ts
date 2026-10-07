/**
 * The host runtime applet bundles import from (shared/runtime.ts → HOST_GLOBAL).
 * Importing this module installs `window.__AICL_HOST__` once, before any bundle loads.
 */
import * as react from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as reactDomBase from 'react-dom';
import * as reactDomClient from 'react-dom/client';
import * as aiclReact from '@aicl/react';
import * as aiclMarkdown from '@aicl/react/markdown';
import * as aiclCore from '@aicl/core';
import * as lucide from 'lucide-react';
import { HOST_GLOBAL, type AppletIntents } from '../../shared/runtime.ts';
import { navigate } from '../router.ts';
import { addPendingContext, sendToSession } from '../sessionsApi.ts';

export async function rpc(id: string, fn: string, args: unknown[]): Promise<unknown> {
  const response = await fetch(`/api/applets/${encodeURIComponent(id)}/rpc/${encodeURIComponent(fn)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ args }),
  });
  const body = (await response.json().catch(() => ({ error: `HTTP ${response.status}` }))) as { result?: unknown; error?: string };
  if (body.error !== undefined) throw new Error(body.error);
  return body.result;
}

const intents: AppletIntents = {
  sendMessage: (text, options) => sendToSession(text, options?.sessionId),
  addContext: addPendingContext,
  navigate,
};

const host = {
  react,
  jsxRuntime,
  reactDom: { ...reactDomBase, ...reactDomClient },
  aiclReact,
  aiclMarkdown,
  aiclCore,
  lucide,
  intents,
  rpc,
};

(globalThis as Record<string, unknown>)[HOST_GLOBAL] = host;

export type AppletHostRuntime = typeof host;
