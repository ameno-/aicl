/**
 * Workspace server: the Pi agent behind `/api/chat`, the canvas relay behind
 * `/api/events`, and the scratchpad snapshot behind `/api/scratch`.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import type { Message } from '@aicl/core';
import { ChatHandlerError, createChatHandler } from '@aicl/server';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { createAgentFactory } from './agent.ts';
import { createSessionHub, SessionError, type AgentLike, type SessionHub } from './sessions.ts';
import type { FeatureContext, FeatureModule } from './feature.ts';
import { createHitl } from './hitl.ts';
import { createLive } from './live.ts';
import { createNodes } from './nodes.ts';
import { createGraph } from './graph.ts';
import { setSessionResolver } from './session-context.ts';
import { serveFile, defaultReferencesRoot } from './files.ts';
import { createReferenceTools } from './references.ts';
import { createRelay } from './relay.ts';
import { createWorkspaceStore } from './store.ts';
import { createScratchTools } from './tools.ts';
import { createUiTools } from './ui-tools.ts';
import { createApplets } from './applets.ts';
import { createCanvasTools } from './canvas-tools.ts';
import { json, matchRoute, readBody, readJson, type RouteTable } from './http.ts';
import { MAIN_SESSION_ID } from '../shared/runtime.ts';
import { formatCanvasContext } from '../shared/canvas-context-format.ts';
import type { CanvasContext } from '../shared/runtime.ts';

const PORT = Number(process.env['AICL_PORT'] ?? '5180');
const HOST = process.env['AICL_HOST'] ?? '127.0.0.1';
const WORKSPACE = path.resolve(process.env['AICL_WORKSPACE'] ?? process.cwd());

const relay = createRelay();
const store = createWorkspaceStore(WORKSPACE);
const applets = createApplets({ workspace: WORKSPACE, relay });
const canvasTools = createCanvasTools({ relay });

// Wave 2 feature modules (shared/agentic.ts). The hub exists only after the
// agent factory, so they reach it lazily.
let hubRef: SessionHub | null = null;
const featureContext: FeatureContext = {
  workspace: WORKSPACE,
  relay,
  hub: () => {
    if (!hubRef) throw new Error('session hub not ready');
    return hubRef;
  },
};
const features: FeatureModule[] = [
  createHitl(featureContext),
  createLive(featureContext),
  createNodes(featureContext),
  createGraph(featureContext),
];

function allTools() {
  return [
    ...createScratchTools(relay, store),
    ...createUiTools(relay),
    ...createReferenceTools(relay),
    ...applets.tools,
    ...canvasTools.tools,
    ...features.flatMap((f) => f.tools),
  ];
}

/** Feature modules' endpoints, tried after the core routes below. */
const featureRoutes: RouteTable[] = [applets.routes, canvasTools.routes(allTools()), ...features.map((f) => f.routes)];
const SESSIONS_DIR = path.join(WORKSPACE, '.aicl', 'sessions');
const factory = await createAgentFactory({
  cwd: WORKSPACE,
  model: process.env['AICL_MODEL'],
  tools: allTools(),
  prompts: features.map((f) => f.prompt ?? ''),
  extensions: features.flatMap((f) => f.extensions ?? []),
});

const hub = await createSessionHub({
  dir: SESSIONS_DIR,
  createAgent: async (file) =>
    (await factory.createSession(
      file ? SessionManager.open(file, SESSIONS_DIR) : SessionManager.create(WORKSPACE, SESSIONS_DIR),
    )) as unknown as AgentLike,
  onChange: (session) => relay.broadcast({ type: 'session', session }),
  onRemove: (id) => relay.broadcast({ type: 'session-removed', id }),
  onAgentEvent: (sessionId, event) => {
    for (const f of features) f.onAgentEvent?.(sessionId, event);
  },
});
hubRef = hub;
setSessionResolver((file) => hub.idForFile(file));
// Load main now so a missing model or key fails at startup, as before.
const modelLabel = await hub.modelLabel();

const lastUserText = (messages: Message[]): string => {
  const last = messages[messages.length - 1];
  if (last?.role !== 'user') return '';
  return last.parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('\n')
    .trim();
};

/**
 * What the user has selected, sent by the dock with every request. Appended to
 * the prompt for the agent only; the client renders its own text.
 */
function canvasContextBlock(body: Record<string, unknown>): string {
  const lines: string[] = [];
  // What the user sees and just did on the canvas (viewport, selection, recent actions, tab).
  const canvas = formatCanvasContext(body['canvasContext'] as CanvasContext | undefined);
  if (canvas) lines.push(canvas);
  // Context the user staged with the Add-context chips: sent here so the dock never shows it.
  const staged = Array.isArray(body['context']) ? (body['context'] as Array<{ label?: unknown; text?: unknown }>) : [];
  for (const item of staged) {
    if (typeof item?.text !== 'string') continue;
    const label = typeof item.label === 'string' ? item.label : 'context';
    lines.push(`context (${label}):\n${item.text.replaceAll('</canvas-context>', '')}`);
  }
  return lines.length ? `\n\n<canvas-context>\n${lines.join('\n')}\n</canvas-context>` : '';
}

/** HTTP surface for conversations (shared/runtime.ts). Hub errors carry their own status. */
const sessionRoutes: RouteTable = {
  'GET /api/sessions': (_req, res) => json(res, 200, { sessions: hub.list() }),
  'POST /api/sessions': async (req, res) => {
    const body = await readJson<{ title?: string; kind?: 'chat' | 'node' }>(req);
    json(res, 200, { session: await hub.create(body) });
  },
  'PATCH /api/sessions/:id': async (req, res, { params }) => {
    const body = await readJson<{ title?: string }>(req);
    json(res, 200, { session: await hub.rename(params['id']!, body.title ?? '') });
  },
  'DELETE /api/sessions/:id': async (_req, res, { params }) => {
    await hub.remove(params['id']!);
    json(res, 200, { ok: true });
  },
  'GET /api/sessions/:id/messages': async (_req, res, { params }) =>
    json(res, 200, { messages: await hub.messages(params['id']!) }),
  'POST /api/sessions/:id/stop': async (_req, res, { params }) => {
    await hub.stop(params['id']!);
    json(res, 200, { ok: true });
  },
};

const chat = createChatHandler(async (req) => {
  const text = lastUserText(req.messages);
  if (!text) throw new ChatHandlerError(400, 'The last message must be user text.', false);
  const sessionId = typeof req.body['sessionId'] === 'string' ? req.body['sessionId'] : MAIN_SESSION_ID;
  try {
    hub.reserve(sessionId);
  } catch (cause) {
    if (cause instanceof SessionError) throw new ChatHandlerError(cause.status, cause.message, cause.status === 409);
    throw cause;
  }
  return hub.run(sessionId, text + canvasContextBlock(req.body), req.signal);
});

async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const controller = new AbortController();
  // `close` on the response fires when the client goes away mid-stream.
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });

  let response;
  try {
    response = await chat(JSON.parse(await readBody(req)), {}, controller.signal);
  } catch (cause) {
    if (cause instanceof ChatHandlerError) {
      return json(res, cause.status, { message: cause.message, retryable: cause.retryable });
    }
    return json(res, 400, { message: cause instanceof Error ? cause.message : 'Bad request' });
  }

  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  // A model can think for a long time between events; a comment frame keeps
  // proxies from treating the stream as idle. Clients ignore non-data lines.
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 15_000);
  try {
    for await (const frame of response.toSse()) {
      if (res.writableEnded) break;
      res.write(frame);
    }
  } finally {
    clearInterval(keepAlive);
    res.end();
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://local');
  const route = `${req.method} ${url.pathname}`;

  void (async () => {
    switch (route) {
      case 'POST /api/chat':
        return handleChat(req, res);
      case 'GET /api/events':
        return relay.connect(res);
      case 'POST /api/scratch/result': {
        const answer = JSON.parse(await readBody(req));
        const ok = relay.settle(String(answer.id), answer);
        return json(res, ok ? 200 : 404, { ok });
      }
      case 'GET /api/file':
        return serveFile(res, [WORKSPACE, defaultReferencesRoot()], url.searchParams.get('path') ?? '');
      case 'GET /api/scratch':
        return json(res, 200, { snapshot: await store.readScratch() });
      case 'PUT /api/scratch':
        await store.writeScratch(JSON.parse(await readBody(req)));
        return json(res, 200, { ok: true });
      case 'GET /api/info':
        return json(res, 200, {
          workspace: WORKSPACE,
          model: modelLabel,
          busy: hub.anyBusy,
        });
      default: {
        const hit = matchRoute([sessionRoutes, ...featureRoutes], req.method ?? 'GET', url.pathname);
        if (hit) return hit.handler(req, res, { url, params: hit.params });
        return json(res, 404, { message: 'not found' });
      }
    }
  })().catch((cause: unknown) => {
    if (cause instanceof SessionError) {
      if (!res.headersSent) json(res, cause.status, { message: cause.message });
      return;
    }
    console.error(cause);
    if (!res.headersSent) json(res, 500, { message: 'internal error' });
    else res.end();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`aicl workspace server on http://${HOST}:${PORT} · workspace ${WORKSPACE} · model ${modelLabel ?? 'none'}`);
});
