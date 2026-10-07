/**
 * Workspace server: the Pi agent behind `/api/chat`, the canvas relay behind
 * `/api/events`, and the scratchpad snapshot behind `/api/scratch`.
 */

import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import type { Message, StreamEvent } from '@aicl/core';
import { ChatHandlerError, createChatHandler } from '@aicl/server';
import { createWorkspaceAgent } from './agent.ts';
import { createPiEventMapper, type PiEvent } from './pi-mapper.ts';
import { serveFile, defaultReferencesRoot } from './files.ts';
import { createReferenceTools } from './references.ts';
import { createRelay } from './relay.ts';
import { createWorkspaceStore } from './store.ts';
import { createScratchTools } from './tools.ts';
import { createUiTools } from './ui-tools.ts';
import { createApplets } from './applets.ts';
import { createCanvasTools } from './canvas-tools.ts';
import { matchRoute, type RouteTable } from './http.ts';

const PORT = Number(process.env['AICL_PORT'] ?? '5180');
const HOST = process.env['AICL_HOST'] ?? '127.0.0.1';
const WORKSPACE = path.resolve(process.env['AICL_WORKSPACE'] ?? process.cwd());

const relay = createRelay();
const store = createWorkspaceStore(WORKSPACE);
const applets = createApplets({ workspace: WORKSPACE, relay });
const canvasTools = createCanvasTools({ relay });
function allTools() {
  return [
    ...createScratchTools(relay, store),
    ...createUiTools(relay),
    ...createReferenceTools(relay),
    ...applets.tools,
    ...canvasTools.tools,
  ];
}

/** Feature modules' endpoints, tried after the core routes below. */
const featureRoutes: RouteTable[] = [applets.routes, canvasTools.routes(allTools())];

const agent = await createWorkspaceAgent({
  cwd: WORKSPACE,
  model: process.env['AICL_MODEL'],
  tools: allTools(),
});

const lastUserText = (messages: Message[]): string => {
  const last = messages[messages.length - 1];
  if (last?.role !== 'user') return '';
  return last.parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('\n')
    .trim();
};

/** Runs one prompt and yields its events as AICL stream events. */
async function* runPrompt(text: string, signal: AbortSignal): AsyncGenerator<StreamEvent> {
  const map = createPiEventMapper(randomUUID());
  const queue: StreamEvent[] = [];
  let wake: (() => void) | null = null;
  let done = false;

  const push = (events: StreamEvent[]) => {
    if (!events.length) return;
    queue.push(...events);
    wake?.();
  };
  const unsubscribe = agent.subscribe((event) => push(map(event as PiEvent)));
  const onAbort = () => void agent.abort();
  signal.addEventListener('abort', onAbort, { once: true });

  // prompt() resolves only after the whole run, auto-retries included, so it
  // and not agent_end is the end of the turn.
  agent
    .prompt(text)
    .then(
      () => push(map.finish()),
      (cause: unknown) => {
        const message = cause instanceof Error ? cause.message : String(cause);
        push([{ type: 'error', error: { message, retryable: true } }]);
      },
    )
    .finally(() => {
      done = true;
      wake?.();
    });

  try {
    while (true) {
      if (queue.length) {
        const event = queue.shift()!;
        yield event;
        continue;
      }
      if (done) return;
      await new Promise<void>((resolve) => (wake = resolve));
      wake = null;
    }
  } finally {
    unsubscribe();
    signal.removeEventListener('abort', onAbort);
  }
}

/**
 * What the user has selected, sent by the dock with every request. Appended to
 * the prompt for the agent only; the client renders its own text.
 */
function canvasContextBlock(body: Record<string, unknown>): string {
  const ctx = body['canvasContext'] as { selectedShapes?: unknown; uiSelection?: { shapeId?: unknown; nodeId?: unknown } | null } | undefined;
  if (!ctx || typeof ctx !== 'object') return '';
  const lines: string[] = [];
  const shapes = Array.isArray(ctx.selectedShapes) ? ctx.selectedShapes.filter((s): s is string => typeof s === 'string') : [];
  if (shapes.length) lines.push(`selected: ${shapes.join(', ')}`);
  const ui = ctx.uiSelection;
  if (ui && typeof ui.shapeId === 'string' && typeof ui.nodeId === 'string') {
    lines.push(`ui-selection: screen ${ui.shapeId.replace(/^shape:/, '')}, element ${ui.nodeId}`);
  }
  return lines.length ? `\n\n<canvas-context>\n${lines.join('\n')}\n</canvas-context>` : '';
}

const chat = createChatHandler((req) => {
  const text = lastUserText(req.messages);
  if (!text) throw new ChatHandlerError(400, 'The last message must be user text.', false);
  if (agent.isStreaming) throw new ChatHandlerError(409, 'The agent is still working. Stop it or wait.', true);
  return runPrompt(text + canvasContextBlock(req.body), req.signal);
});

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

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
          model: agent.model ? `${agent.model.provider}/${agent.model.id}` : null,
          busy: agent.isStreaming,
        });
      default: {
        const hit = matchRoute(featureRoutes, req.method ?? 'GET', url.pathname);
        if (hit) return hit.handler(req, res, { url, params: hit.params });
        return json(res, 404, { message: 'not found' });
      }
    }
  })().catch((cause: unknown) => {
    console.error(cause);
    if (!res.headersSent) json(res, 500, { message: 'internal error' });
    else res.end();
  });
});

server.listen(PORT, HOST, () => {
  const model = agent.model ? `${agent.model.provider}/${agent.model.id}` : 'none';
  console.log(`aicl workspace server on http://${HOST}:${PORT} · workspace ${WORKSPACE} · model ${model}`);
});
