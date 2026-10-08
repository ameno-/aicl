/** Thin client for the Sideshow HTTP API (publish, revise, read comments, health). */
import { tokenFor } from './config.ts';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
type Env = Record<string, string | undefined>;

export interface BoardComment {
  id: string;
  seq: number;
  postId?: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface BoardPost {
  id: string;
  sessionId: string;
  version: number;
}

export class SideshowError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export function createClient(fetchImpl: FetchLike, env: Env) {
  async function request<T>(base: string, method: string, pathname: string, body?: unknown, timeoutMs = 10_000): Promise<T> {
    const token = tokenFor(base, env);
    let res: Response;
    try {
      res = await fetchImpl(`${base}${pathname}`, {
        method,
        headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      throw new SideshowError(`Sideshow at ${base} is unreachable: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new SideshowError(data.error ?? `Sideshow answered ${res.status}`, res.status);
    return data;
  }

  return {
    publish(base: string, input: { title: string; html: string; session?: string; sessionTitle: string }): Promise<BoardPost> {
      return request<BoardPost>(base, 'POST', '/api/posts', {
        title: input.title,
        surfaces: [{ kind: 'html', html: input.html }],
        agent: 'aicl',
        sessionTitle: input.sessionTitle,
        ...(input.session ? { session: input.session } : {}),
      });
    },
    revise(base: string, postId: string, input: { title: string; html: string }): Promise<BoardPost> {
      return request<BoardPost>(base, 'PUT', `/api/posts/${encodeURIComponent(postId)}`, { title: input.title, surfaces: [{ kind: 'html', html: input.html }] });
    },
    comments(base: string, postId: string, after: number): Promise<{ comments: BoardComment[]; lastSeq: number }> {
      return request(base, 'GET', `/api/comments?surface=${encodeURIComponent(postId)}&after=${after}`, undefined, 6_000);
    },
    /** Up when the board answers; for a remote, 401 (token missing/wrong) still proves it is up. */
    async health(base: string): Promise<{ ok: boolean; status: number | null; detail?: string }> {
      try {
        const token = tokenFor(base, env);
        const res = await fetchImpl(`${base}/api/version`, {
          ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
          signal: AbortSignal.timeout(2_500),
        });
        if (res.ok) return { ok: true, status: res.status };
        if (res.status === 401) return { ok: true, status: 401, detail: 'reachable; token missing or rejected' };
        return { ok: false, status: res.status };
      } catch (cause) {
        return { ok: false, status: null, detail: cause instanceof Error ? cause.message : String(cause) };
      }
    },
  };
}
