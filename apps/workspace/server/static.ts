/**
 * Serves the built web app (dist/) with SPA fallback, so `npm start` runs the
 * whole product on one port without Vite. Only used with `--serve-web`.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
};

/** True when the request was answered (a file, or index.html for an app route). */
export async function serveWeb(root: string, req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const decoded = decodeURIComponent(pathname);
  const candidate = path.resolve(root, '.' + (decoded.endsWith('/') ? decoded + 'index.html' : decoded));
  const inside = candidate === root || candidate.startsWith(root + path.sep);
  let file = inside ? candidate : path.join(root, 'index.html');
  let info = await stat(file).catch(() => null);
  // Unknown path: an asset-looking one is a 404; anything else is a client route.
  if (!info?.isFile()) {
    if (path.extname(decoded) && !decoded.endsWith('.html')) return false;
    file = path.join(root, 'index.html');
    info = await stat(file).catch(() => null);
    if (!info?.isFile()) return false;
  }
  const hashed = file.includes(`${path.sep}assets${path.sep}`);
  res.writeHead(200, {
    'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': info.size,
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).pipe(res);
  return true;
}
