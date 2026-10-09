// Serves POST /api/chat as Server-Sent Events from the backend chosen by
// AICL_BACKEND (anthropic | openai | echo), plus the built UI as static files.
//
//   AICL_BACKEND   default: anthropic if ANTHROPIC_API_KEY is set, else openai if OPENAI_MODEL is set, else echo
//   PORT           default 8787
//   STATIC_DIR     default ../dist (or this folder's parent when it has an index.html)
//
// To use your own backend, implement ChatBackend (./backend.js) and return it from pickBackend.

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const SDKS = { anthropic: '@anthropic-ai/sdk', openai: 'openai' };

export async function pickBackend(env = process.env) {
  let name = env.AICL_BACKEND || (env.ANTHROPIC_API_KEY ? 'anthropic' : env.OPENAI_MODEL ? 'openai' : 'echo');
  if (SDKS[name]) {
    try {
      await import(SDKS[name]);
    } catch {
      const hint = `The ${name} backend needs ${SDKS[name]}: run npm install.`;
      if (env.AICL_BACKEND) throw new Error(hint);
      console.warn(`${hint} Using the echo backend until then (set AICL_BACKEND to choose explicitly).`);
      name = 'echo';
    }
  }
  if (name === 'anthropic') return { name, backend: (await import('./backends/anthropic.js')).createAnthropicBackend(env) };
  if (name === 'openai') return { name, backend: (await import('./backends/openai.js')).createOpenAIBackend(env) };
  if (name === 'echo') return { name, backend: (await import('./backends/echo.js')).createEchoBackend() };
  throw new Error(`Unknown AICL_BACKEND "${name}". Use anthropic, openai or echo.`);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function staticRoot(env) {
  if (env.STATIC_DIR) return path.resolve(env.STATIC_DIR);
  const dist = path.resolve(here, '..', 'dist');
  if (existsSync(path.join(dist, 'index.html'))) return dist;
  const parent = path.resolve(here, '..');
  return existsSync(path.join(parent, 'index.html')) ? parent : null;
}

function serveStatic(root, pathname, res) {
  const target = path.resolve(root, '.' + decodeURIComponent(pathname));
  if (!target.startsWith(root + path.sep) && target !== root) return false;
  // Never serve dotfiles (.env holds your keys), dependencies, or the server's own code.
  const segments = path.relative(root, target).split(path.sep);
  if (segments.some((s) => s.startsWith('.') || s === 'node_modules' || s === 'package.json' || s === 'package-lock.json')) return false;
  let file = target;
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!existsSync(file)) file = path.join(root, 'index.html'); // single-page app fallback
  if (!existsSync(file) || file.startsWith(here + path.sep)) return false;
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
  return true;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export async function startServer(env = process.env) {
  const { name, backend } = await pickBackend(env);
  const root = staticRoot(env);
  const port = Number(env.PORT || 8787);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      let body;
      try {
        body = await readJson(req);
        if (!Array.isArray(body.messages)) throw new Error('messages must be an array');
      } catch (cause) {
        res.writeHead(400, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ message: cause instanceof Error ? cause.message : 'bad request' }));
      }
      const { messages, ...rest } = body;
      const ac = new AbortController();
      res.on('close', () => !res.writableFinished && ac.abort());
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const ping = setInterval(() => res.write(': ping\n\n'), 15000);
      try {
        for await (const event of backend.stream({ messages, body: rest, signal: ac.signal })) {
          if (ac.signal.aborted) break;
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch (cause) {
        if (!ac.signal.aborted) {
          console.error('[chat]', cause);
          const message = cause instanceof Error ? cause.message : String(cause);
          res.write(`data: ${JSON.stringify({ type: 'error', error: { message, retryable: true } })}\n\n`);
        }
      } finally {
        clearInterval(ping);
        if (!res.writableEnded) res.end('data: [DONE]\n\n');
      }
      return;
    }
    if (req.method === 'GET' && root && serveStatic(root, url.pathname, res)) return;
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'not found' }));
  });

  await new Promise((resolve) => server.listen(port, env.HOST || '127.0.0.1', resolve));
  console.log(`chat server on http://${env.HOST || '127.0.0.1'}:${port} · backend ${name}${root ? ` · serving ${path.relative(process.cwd(), root) || '.'}` : ''}`);
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
