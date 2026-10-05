/**
 * Relays scratchpad ops from the agent to an open canvas.
 *
 * While a tab is open, the browser's tldraw editor is the authority: it applies
 * ops with the real shape API (measured text, bound arrows, validation), and
 * the server only waits for the result. Disk is the fallback for reads.
 */

import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import type { ScratchOp, ScratchResult } from '../shared/scratch.ts';

interface Pending {
  resolve: (result: ScratchResult) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class NoCanvasError extends Error {
  constructor() {
    super('The scratchpad is not open in a browser. Ask the user to open the workspace, then retry.');
  }
}

export function createRelay(timeoutMs = 15_000) {
  /** Newest last: the most recently connected tab receives ops. */
  const clients: ServerResponse[] = [];
  const pending = new Map<string, Pending>();

  const send = (res: ServerResponse, payload: unknown) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  return {
    /** Mounts a GET as the server → browser event stream. */
    connect(res: ServerResponse): void {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      res.write(': connected\n\n');
      clients.push(res);
      const keepAlive = setInterval(() => res.write(': ping\n\n'), 15_000);
      res.on('close', () => {
        clearInterval(keepAlive);
        clients.splice(clients.indexOf(res), 1);
      });
    },

    get connected(): boolean {
      return clients.length > 0;
    },

    /** Broadcasts a notice (e.g. the agent's run state) to every tab. */
    broadcast(payload: unknown): void {
      for (const res of clients) send(res, payload);
    },

    request(op: ScratchOp, signal?: AbortSignal): Promise<ScratchResult> {
      const target = clients[clients.length - 1];
      if (!target) return Promise.reject(new NoCanvasError());
      const id = randomUUID();
      return new Promise<ScratchResult>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`The canvas did not answer within ${timeoutMs / 1000}s.`));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            pending.delete(id);
            reject(new Error('Cancelled.'));
          },
          { once: true },
        );
        send(target, { type: 'scratch-op', id, op });
      });
    },

    /** Completes a request with the browser's answer. */
    settle(id: string, answer: { ok: true; result: ScratchResult } | { ok: false; error: string }): boolean {
      const entry = pending.get(id);
      if (!entry) return false;
      clearTimeout(entry.timer);
      pending.delete(id);
      if (answer.ok) entry.resolve(answer.result);
      else entry.reject(new Error(answer.error));
      return true;
    },
  };
}

export type Relay = ReturnType<typeof createRelay>;
