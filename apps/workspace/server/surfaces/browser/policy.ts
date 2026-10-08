/** Pure helpers: which URLs the agent may open freely, viewport presets, coordinate scaling. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 820, height: 1100 },
  mobile: { width: 390, height: 844 },
} as const;
export type ViewportPreset = keyof typeof VIEWPORTS;
export interface Viewport {
  width: number;
  height: number;
}

export const isPreset = (v: unknown): v is ViewportPreset => typeof v === 'string' && v in VIEWPORTS;

/** "example.com/x" -> https://example.com/x; localhost and bare ports default to http. */
export function normalizeUrl(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error('empty url');
  if (/^(https?|file|about|data):/i.test(raw)) return raw;
  if (/^(localhost|127\.0\.0\.1|\[::1\]|[^/]*\.localhost)(:\d+)?(\/|$)/i.test(raw)) return `http://${raw}`;
  return `https://${raw}`;
}

/** The host to ask about ("example.com"), or "local files" for file: URLs outside the workspace. */
export function hostKey(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol === 'file:' ? 'local files' : u.hostname.toLowerCase();
  } catch {
    return url;
  }
}

/** localhost, 127.0.0.1, ::1, *.localhost and file URLs inside the workspace are free. */
export function isFreeUrl(url: string, workspace: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol === 'about:') return true;
  if (u.protocol === 'file:') {
    const rel = path.relative(workspace, fileURLToPath(u));
    return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.localhost');
}

/** Viewer fractions (0..1 of the drawn frame) to page pixels, clamped to the viewport. */
export function scalePoint(nx: number, ny: number, viewport: Viewport): { x: number; y: number } {
  const c = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
  return { x: Math.round(c(nx) * (viewport.width - 1)), y: Math.round(c(ny) * (viewport.height - 1)) };
}

/** Page pixels to fractions, for telling viewers where the agent clicked. */
export function toFraction(x: number, y: number, viewport: Viewport): { nx: number; ny: number } {
  return { nx: x / viewport.width, ny: y / viewport.height };
}

/** "localhost:5173/app" for lists and card headers. */
export function summarizeUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol === 'file:') return path.basename(u.pathname);
    if (u.protocol === 'about:') return 'blank';
    const p = u.pathname === '/' ? '' : u.pathname;
    return `${u.host}${p}`;
  } catch {
    return url;
  }
}
