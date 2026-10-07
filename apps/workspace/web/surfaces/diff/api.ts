import { useCallback, useEffect, useRef, useState } from 'react';

export async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(data.message ?? `request failed (${res.status})`);
  return data;
}

/** GET `url` now and whenever `stamp` (the surface's updatedAt) changes. */
export function useRemote<T>(url: string | null, stamp: unknown) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    if (!url) return;
    const mine = ++seq.current;
    try {
      const next = await call<T>('GET', url);
      if (mine === seq.current) {
        setData(next);
        setError(null);
      }
    } catch (cause) {
      if (mine === seq.current) setError((cause as Error).message);
    }
  }, [url]);
  useEffect(() => {
    void reload();
  }, [reload, stamp]);
  return { data, error, reload, set: setData };
}
