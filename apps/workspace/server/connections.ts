/**
 * External clients using the workspace (AICL-46): MCP bridges (Claude Code,
 * Pi, …) and the `aicl` CLI identify themselves with `x-aicl-client`. The
 * sidebar lists them so it is visible what is connected to the assistant.
 */
import type { IncomingMessage } from 'node:http';
import type { ClientConnection } from '../shared/runtime.ts';
import { json, type RouteTable } from './http.ts';
import type { Relay } from './relay.ts';

/** A client that has not called for this long is shown as idle, and dropped after DROP_AFTER. */
const DROP_AFTER = 24 * 60 * 60 * 1000;

export function createConnections(relay: Pick<Relay, 'broadcast'>, now: () => number = Date.now) {
  const seen = new Map<string, ClientConnection>();
  return {
    /** Records a request; returns the connection when the request named a client. */
    touch(req: IncomingMessage, url: URL): ClientConnection | undefined {
      const raw = req.headers['x-aicl-client'];
      const name = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 80);
      if (!name) return undefined;
      const t = now();
      const prev = seen.get(name);
      const tool = /^\/api\/tools\/([^/]+)$/.exec(url.pathname)?.[1];
      const next: ClientConnection = {
        name,
        kind: name === 'cli' ? 'cli' : name.startsWith('mcp') ? 'mcp' : 'other',
        firstSeen: prev?.firstSeen ?? t,
        lastSeen: t,
        calls: (prev?.calls ?? 0) + (tool ? 1 : 0),
        ...(tool ? { lastTool: decodeURIComponent(tool) } : prev?.lastTool ? { lastTool: prev.lastTool } : {}),
      };
      seen.set(name, next);
      relay.broadcast({ type: 'connection', connection: next });
      return next;
    },
    list(): ClientConnection[] {
      const t = now();
      for (const [k, c] of seen) if (t - c.lastSeen > DROP_AFTER) seen.delete(k);
      return [...seen.values()].sort((a, b) => b.lastSeen - a.lastSeen);
    },
    routes(): RouteTable {
      return { 'GET /api/connections': (_req, res) => json(res, 200, { connections: this.list() }) };
    },
  };
}
