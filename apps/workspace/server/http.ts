/**
 * Tiny HTTP helpers and a route table, so feature modules (sessions,
 * applets, canvas tools) register their own endpoints instead of all
 * editing one switch in main.ts.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: { url: URL; params: Record<string, string> },
) => unknown | Promise<unknown>;

/** Keys are "METHOD /path/with/:params", e.g. "POST /api/applets/:id/rpc/:fn". */
export type RouteTable = Record<string, RouteHandler>;

export function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export async function readJson<T = unknown>(req: IncomingMessage): Promise<T> {
  const text = await readBody(req);
  return (text ? JSON.parse(text) : {}) as T;
}

export function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** First route whose method and path pattern match; `:name` segments become params. */
export function matchRoute(
  tables: RouteTable[],
  method: string,
  pathname: string,
): { handler: RouteHandler; params: Record<string, string> } | undefined {
  const parts = pathname.split('/');
  for (const table of tables) {
    for (const [key, handler] of Object.entries(table)) {
      const [m, pattern] = key.split(' ') as [string, string];
      if (m !== method) continue;
      const pp = pattern.split('/');
      if (pp.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < pp.length; i++) {
        const seg = pp[i]!;
        if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(parts[i]!);
        else if (seg !== parts[i]) {
          ok = false;
          break;
        }
      }
      if (ok) return { handler, params };
    }
  }
  return undefined;
}
