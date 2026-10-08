/**
 * Surface service: browser (wave 4, see shared/surfaces.ts).
 *
 * One shared headless Chromium (playwright-core), launched on first use and
 * closed when the last browser surface closes. Each surface is a page in its
 * own context, streamed to viewers as a CDP screencast over /ws/browser/:id
 * and driven by the person (input messages) or the agent (browser_* tools).
 */
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { chromium, type Browser, type BrowserContext, type CDPSession, type Locator, type Page } from 'playwright-core';
import { Type } from 'typebox';
import { WebSocketServer, type WebSocket } from 'ws';
import { MAIN_SESSION_ID } from '../../shared/runtime.ts';
import type { FeatureModule } from '../feature.ts';
import { askApproval } from '../hitl.ts';
import { json, readJson } from '../http.ts';
import { sessionIdFromToolContext } from '../session-context.ts';
import type { SurfaceContext } from './context.ts';
import { collectOutline, formatOutline, OUTLINE_CAP } from './browser/outline.ts';
import {
  hostKey,
  isFreeUrl,
  isPreset,
  normalizeUrl,
  scalePoint,
  summarizeUrl,
  toFraction,
  VIEWPORTS,
  type Viewport,
  type ViewportPreset,
} from './browser/policy.ts';

const READ_CAP = 8000;
const PROMPT = `Browser:
- You have a real browser. After you build something with a UI (a dev server, an applet's view, a static page), open it with browser_open and check it: browser_snapshot for the outline, browser_click / browser_type to use it, browser_read for its text, browser_screenshot to look at it.
- The user sees the same page live. Right after browser_open, before you use the page, add it to the canvas with scratch_add so they can watch: component "surface" with props { kind: "browser", id: <the id browser_open returned> }.
- localhost and files in the workspace open freely; any other site asks the user for approval once per host. If declined, do not retry, work from what you have.
- Refs (e1, e2…) in a snapshot are only valid until the next snapshot.`;

type ClientMessage =
  | { t: 'mouse'; type: 'down' | 'up' | 'move'; nx: number; ny: number; button?: 'left' | 'middle' | 'right'; clicks?: number }
  | { t: 'wheel'; nx: number; ny: number; dx: number; dy: number }
  | { t: 'key'; type: 'down' | 'up'; key: string }
  | { t: 'type'; text: string }
  | { t: 'navigate'; url: string }
  | { t: 'back' | 'forward' | 'reload' }
  | { t: 'viewport'; preset?: string; width?: number; height?: number }
  | { t: 'view'; w: number; h: number; dpr?: number };

interface Live {
  id: string;
  context: BrowserContext;
  page: Page;
  cdp: CDPSession;
  preset: ViewportPreset | 'custom';
  viewport: Viewport;
  clients: Set<WebSocket>;
  loading: boolean;
  loadTimer?: NodeJS.Timeout;
  screencast: { maxWidth: number; maxHeight: number } | null;
  want: { w: number; h: number };
  lastFrame?: Buffer;
  queue: Promise<unknown>;
  closed: boolean;
}

const clampViewport = (w: number, h: number): Viewport => ({
  width: Math.round(Math.min(2400, Math.max(200, w))),
  height: Math.round(Math.min(2400, Math.max(200, h))),
});

export function createBrowserSurface(context: SurfaceContext): FeatureModule {
  const { surfaces, workspace } = context;
  const live = new Map<string, Live>();
  const approvedHosts = new Map<string, Set<string>>();
  let browserPromise: Promise<Browser> | null = null;

  const getBrowser = (): Promise<Browser> => {
    browserPromise ??= chromium.launch({ headless: true }).then(
      (b) => {
        b.on('disconnected', () => {
          browserPromise = null;
          for (const s of [...live.values()]) void dispose(s, true);
        });
        return b;
      },
      (cause: unknown) => {
        browserPromise = null;
        throw new Error(
          `Could not launch Chromium (${cause instanceof Error ? cause.message.split('\n')[0] : String(cause)}). Install it with: npx playwright-core install chromium`,
        );
      },
    );
    return browserPromise;
  };

  const closeBrowserIfIdle = async () => {
    if (live.size > 0 || !browserPromise) return;
    const pending = browserPromise;
    browserPromise = null;
    await pending.then((b) => b.close()).catch(() => {});
  };
  // Chromium is launched with playwright's default signal handling and dies with our pipe on exit.

  /* ── Streaming ──────────────────────────────────────────────────── */

  const sendJson = (s: Live, msg: unknown) => {
    const text = JSON.stringify(msg);
    for (const c of s.clients) if (c.readyState === 1) c.send(text);
  };

  const stateOf = async (s: Live) => {
    let canBack = false;
    let canForward = false;
    try {
      const h = (await s.cdp.send('Page.getNavigationHistory')) as { currentIndex: number; entries: unknown[] };
      canBack = h.currentIndex > 0;
      canForward = h.currentIndex < h.entries.length - 1;
    } catch {
      /* page closing */
    }
    return {
      t: 'state',
      url: s.page.url(),
      title: await s.page.title().catch(() => ''),
      preset: s.preset,
      viewport: s.viewport,
      loading: s.loading,
      canBack,
      canForward,
    };
  };

  const refresh = async (s: Live) => {
    if (s.closed) return;
    const state = await stateOf(s);
    if (s.closed) return;
    surfaces.patch('browser', s.id, {
      title: state.title || summarizeUrl(state.url),
      summary: summarizeUrl(state.url),
      status: s.loading ? 'busy' : 'idle',
      meta: { url: state.url, preset: s.preset, width: s.viewport.width, height: s.viewport.height },
    });
    sendJson(s, state);
  };

  const screencastSize = (s: Live) => ({
    maxWidth: Math.round(Math.min(s.viewport.width, Math.max(200, s.want.w))),
    maxHeight: Math.round(Math.min(s.viewport.height, Math.max(200, s.want.h))),
  });

  const stopScreencast = async (s: Live) => {
    if (!s.screencast) return;
    s.screencast = null;
    await s.cdp.send('Page.stopScreencast').catch(() => {});
  };

  const startScreencast = async (s: Live) => {
    if (s.screencast || s.closed || s.clients.size === 0) return;
    s.screencast = screencastSize(s);
    await s.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, ...s.screencast, everyNthFrame: 1 }).catch(() => {
      s.screencast = null;
    });
  };

  const restartScreencast = async (s: Live) => {
    await stopScreencast(s);
    await startScreencast(s);
  };

  /** Serialize page.mouse/keyboard calls so fast input stays in order. */
  const enqueue = (s: Live, fn: () => Promise<unknown>) => {
    s.queue = s.queue.then(fn).catch(() => {});
  };

  const handleInput = (s: Live, msg: ClientMessage) => {
    const { page } = s;
    switch (msg.t) {
      case 'mouse': {
        const p = scalePoint(msg.nx, msg.ny, s.viewport);
        enqueue(s, async () => {
          if (msg.type === 'move') return page.mouse.move(p.x, p.y);
          await page.mouse.move(p.x, p.y);
          const button = msg.button ?? 'left';
          return msg.type === 'down' ? page.mouse.down({ button, clickCount: msg.clicks ?? 1 }) : page.mouse.up({ button, clickCount: msg.clicks ?? 1 });
        });
        break;
      }
      case 'wheel': {
        const p = scalePoint(msg.nx, msg.ny, s.viewport);
        enqueue(s, async () => {
          await page.mouse.move(p.x, p.y);
          return page.mouse.wheel(msg.dx, msg.dy);
        });
        break;
      }
      case 'key':
        enqueue(s, () => (msg.type === 'down' ? page.keyboard.down(msg.key) : page.keyboard.up(msg.key)));
        break;
      case 'type':
        enqueue(s, () => page.keyboard.insertText(msg.text));
        break;
      case 'navigate':
        enqueue(s, async () => {
          await page.goto(normalizeUrl(msg.url), { waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => {});
        });
        break;
      case 'back':
        enqueue(s, () => page.goBack({ timeout: 10_000 }).catch(() => {}));
        break;
      case 'forward':
        enqueue(s, () => page.goForward({ timeout: 10_000 }).catch(() => {}));
        break;
      case 'reload':
        enqueue(s, () => page.reload({ timeout: 20_000 }).catch(() => {}));
        break;
      case 'viewport':
        void setViewport(s, msg.preset, msg.width, msg.height);
        break;
      case 'view': {
        const dpr = Math.min(2, Math.max(1, msg.dpr ?? 1));
        const want = { w: msg.w * dpr, h: msg.h * dpr };
        const before = s.want;
        s.want = want;
        if (s.screencast) {
          const next = screencastSize(s);
          const changed = Math.abs(next.maxWidth - s.screencast.maxWidth) / s.screencast.maxWidth > 0.2 || Math.abs(next.maxHeight - s.screencast.maxHeight) / s.screencast.maxHeight > 0.2;
          if (changed) void restartScreencast(s);
        } else if (before !== want) void startScreencast(s);
        break;
      }
    }
  };

  async function setViewport(s: Live, preset?: string, width?: number, height?: number) {
    let next: Viewport;
    if (isPreset(preset)) {
      next = { ...VIEWPORTS[preset] };
      s.preset = preset;
    } else if (typeof width === 'number' && typeof height === 'number') {
      next = clampViewport(width, height);
      s.preset = 'custom';
    } else return;
    s.viewport = next;
    await s.page.setViewportSize(next).catch(() => {});
    if (s.screencast) await restartScreencast(s);
    await refresh(s);
  }

  const attach = (s: Live, ws: WebSocket) => {
    s.clients.add(ws);
    void (async () => {
      ws.send(JSON.stringify(await stateOf(s)));
      await startScreencast(s);
      // An initial frame so a still page shows up at once.
      const shot = await s.page.screenshot({ type: 'jpeg', quality: 70 }).catch(() => null);
      if (shot && ws.readyState === 1) ws.send(shot);
    })();
    ws.on('message', (raw, isBinary) => {
      if (isBinary) return;
      try {
        handleInput(s, JSON.parse(raw.toString()) as ClientMessage);
      } catch {
        /* ignore malformed */
      }
    });
    ws.on('close', () => {
      s.clients.delete(ws);
      if (s.clients.size === 0) void stopScreencast(s);
    });
    ws.on('error', () => ws.close());
  };

  /* ── Pages ──────────────────────────────────────────────────────── */

  async function dispose(s: Live, alreadyGone = false) {
    if (s.closed) return;
    s.closed = true;
    live.delete(s.id);
    clearTimeout(s.loadTimer);
    for (const c of s.clients) c.close();
    s.clients.clear();
    if (!alreadyGone) {
      await s.cdp.send('Page.stopScreencast').catch(() => {});
      await s.context.close().catch(() => {});
    }
    surfaces.remove('browser', s.id);
    await closeBrowserIfIdle();
  }

  async function openPage(url: string, viewport: ViewportPreset | Viewport | undefined, openedBy: 'user' | 'agent', sessionId?: string) {
    const browser = await getBrowser();
    const preset: Live['preset'] = typeof viewport === 'string' ? viewport : viewport ? 'custom' : 'desktop';
    const size = typeof viewport === 'string' ? { ...VIEWPORTS[viewport] } : viewport ? clampViewport(viewport.width, viewport.height) : { ...VIEWPORTS.desktop };
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    ctx.setDefaultTimeout(5000);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    const id = `br-${randomUUID().slice(0, 6)}`;
    const s: Live = {
      id,
      context: ctx,
      page,
      cdp,
      preset,
      viewport: size,
      clients: new Set(),
      loading: true,
      screencast: null,
      want: { w: size.width, h: size.height },
      queue: Promise.resolve(),
      closed: false,
    };
    live.set(id, s);
    surfaces.upsert({
      kind: 'browser',
      id,
      title: summarizeUrl(url),
      summary: summarizeUrl(url),
      status: 'busy',
      openedBy,
      ...(sessionId ? { sessionId } : {}),
      meta: { url, preset, width: size.width, height: size.height },
    });

    cdp.on('Page.screencastFrame', (frame: { data: string; sessionId: number }) => {
      void cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
      const buf = Buffer.from(frame.data, 'base64');
      s.lastFrame = buf;
      for (const c of s.clients) if (c.readyState === 1 && c.bufferedAmount < 2_000_000) c.send(buf);
    });
    const settle = () => {
      clearTimeout(s.loadTimer);
      s.loading = false;
      void refresh(s);
    };
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return;
      s.loading = true;
      clearTimeout(s.loadTimer);
      s.loadTimer = setTimeout(settle, 8000);
      void refresh(s);
    });
    page.on('domcontentloaded', () => void refresh(s));
    page.on('load', settle);
    page.on('close', () => void dispose(s, true));
    page.on('dialog', (d) => void d.dismiss().catch(() => {}));
    // New tabs are not shown; follow them in this page instead.
    page.on('popup', (popup) => {
      void (async () => {
        await popup.waitForLoadState('domcontentloaded').catch(() => {});
        const target = popup.url();
        await popup.close().catch(() => {});
        if (target && target !== 'about:blank') await page.goto(target, { waitUntil: 'domcontentloaded' }).catch(() => {});
      })();
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => {});
    await refresh(s);
    return s;
  }

  surfaces.onClose('browser', async (id) => {
    const s = live.get(id);
    if (s) await dispose(s);
  });

  /* ── Agent tools ────────────────────────────────────────────────── */

  const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }], details: {} });
  const pageOf = (id: string): Live => {
    const s = live.get(id);
    if (!s) throw new Error(`No browser surface "${id}". Open one with browser_open.`);
    return s;
  };
  const agentEvent = (s: Live, action: string, at?: { x: number; y: number }) =>
    sendJson(s, { t: 'agent', action, at: Date.now(), ...(at ? toFraction(at.x, at.y, s.viewport) : {}) });
  const settleAfterAction = async (s: Live) => {
    await s.page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 150));
  };
  const where = async (s: Live) => `Page: ${JSON.stringify(await s.page.title().catch(() => ''))} <${s.page.url()}>`;

  const target = async (s: Live, p: { ref?: string | undefined; text?: string | undefined; selector?: string | undefined }): Promise<{ locator: Locator; label: string }> => {
    if (p.ref) return { locator: s.page.locator(`[data-aicl-ref="${p.ref.replace(/[^\w-]/g, '')}"]`).first(), label: `ref ${p.ref}` };
    if (p.selector) return { locator: s.page.locator(p.selector).first(), label: p.selector };
    if (p.text) {
      // Buttons and links by name first; plain text only when none matches.
      const byRole = s.page.getByRole('button', { name: p.text }).or(s.page.getByRole('link', { name: p.text }));
      const locator = (await byRole.count()) > 0 ? byRole.first() : s.page.getByText(p.text).first();
      return { locator, label: `"${p.text}"` };
    }
    throw new Error('Give one of ref, text or selector.');
  };

  const targetParams = {
    ref: Type.Optional(Type.String({ description: 'Ref like "e3" from the last browser_snapshot.' })),
    selector: Type.Optional(Type.String({ description: 'CSS selector.' })),
  };

  const open = defineTool({
    name: 'browser_open',
    label: 'Open in browser',
    description:
      'Open a URL in a new browser surface (a real headless Chromium the user can watch live). Returns the surface id used by the other browser_* tools. localhost and workspace files are free; other sites need the user\'s approval.',
    parameters: Type.Object({
      url: Type.String({ description: 'e.g. http://localhost:5173/ or example.com' }),
      viewport: Type.Optional(Type.Union([Type.Literal('desktop'), Type.Literal('tablet'), Type.Literal('mobile')])),
    }),
    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      const url = normalizeUrl(params.url);
      const sessionId = sessionIdFromToolContext(ctx);
      if (!isFreeUrl(url, workspace)) {
        const host = hostKey(url);
        const known = approvedHosts.get(sessionId);
        if (!known?.has(host)) {
          const answer = await askApproval({ sessionId, toolCallId, tool: 'browser', summary: `Open ${host}`, input: { url } }, signal);
          if (!answer.approved) return text(`The user declined to let you open ${host}: ${answer.note || 'no reason given'}. Do not retry; work without it.`);
          approvedHosts.set(sessionId, (known ?? new Set()).add(host));
        }
      }
      const s = await openPage(url, params.viewport, 'agent', sessionId);
      return text(`Opened browser surface ${s.id}. ${await where(s)}\nTo show the user, scratch_add a component "surface" with props {"kind":"browser","id":"${s.id}"}.`);
    },
  });

  const snapshot = defineTool({
    name: 'browser_snapshot',
    label: 'Browser snapshot',
    description: 'Compact outline of the page: headings and interactive elements with refs (e1, e2…) for browser_click / browser_type. Refs are valid until the next snapshot.',
    parameters: Type.Object({ id: Type.String() }),
    async execute(_id, params) {
      const s = pageOf(params.id);
      const items = await s.page.evaluate(collectOutline, OUTLINE_CAP);
      agentEvent(s, 'snapshot');
      return text(formatOutline(items, { title: await s.page.title().catch(() => ''), url: s.page.url() }));
    },
  });

  const click = defineTool({
    name: 'browser_click',
    label: 'Browser click',
    description: 'Click an element by ref (from browser_snapshot), visible text, or CSS selector. The user sees the click.',
    parameters: Type.Object({ id: Type.String(), ...targetParams, text: Type.Optional(Type.String({ description: 'Visible text or accessible name of a button/link.' })) }),
    async execute(_id, params) {
      const s = pageOf(params.id);
      const { locator, label } = await target(s, params);
      try {
        await locator.scrollIntoViewIfNeeded();
        const box = await locator.boundingBox();
        if (box) agentEvent(s, 'click', { x: box.x + box.width / 2, y: box.y + box.height / 2 });
        await locator.click();
      } catch (cause) {
        const hint = params.ref ? ' Refs expire; take a new browser_snapshot.' : '';
        throw new Error(`Could not click ${label}: ${cause instanceof Error ? cause.message.split('\n')[0] : String(cause)}.${hint}`);
      }
      await settleAfterAction(s);
      return text(`Clicked ${label}. ${await where(s)}`);
    },
  });

  const type = defineTool({
    name: 'browser_type',
    label: 'Browser type',
    description: 'Type text into an input (by ref or selector), replacing its value; with neither, types into the focused element. submit presses Enter afterwards.',
    parameters: Type.Object({ id: Type.String(), ...targetParams, text: Type.String(), submit: Type.Optional(Type.Boolean()) }),
    async execute(_id, params) {
      const s = pageOf(params.id);
      if (params.ref || params.selector) {
        const { locator, label } = await target(s, params);
        try {
          await locator.scrollIntoViewIfNeeded();
          const box = await locator.boundingBox();
          if (box) agentEvent(s, 'type', { x: box.x + box.width / 2, y: box.y + box.height / 2 });
          await locator.fill(params.text);
        } catch (cause) {
          const hint = params.ref ? ' Refs expire; take a new browser_snapshot.' : '';
          throw new Error(`Could not type into ${label}: ${cause instanceof Error ? cause.message.split('\n')[0] : String(cause)}.${hint}`);
        }
      } else {
        agentEvent(s, 'type');
        await s.page.keyboard.type(params.text);
      }
      if (params.submit) await s.page.keyboard.press('Enter');
      await settleAfterAction(s);
      return text(`Typed ${JSON.stringify(params.text.slice(0, 60))}${params.submit ? ' and pressed Enter' : ''}. ${await where(s)}`);
    },
  });

  const read = defineTool({
    name: 'browser_read',
    label: 'Browser read',
    description: `The page's main text (up to ${READ_CAP} characters).`,
    parameters: Type.Object({ id: Type.String() }),
    async execute(_id, params) {
      const s = pageOf(params.id);
      const body = await s.page.evaluate(() => ((document.querySelector('main') as HTMLElement | null) ?? document.body).innerText);
      agentEvent(s, 'read');
      const trimmed = body.replace(/\n{3,}/g, '\n\n').trim();
      const more = trimmed.length > READ_CAP ? `\n…(${trimmed.length - READ_CAP} more characters)` : '';
      return text(`${await where(s)}\n\n${trimmed.slice(0, READ_CAP)}${more}`);
    },
  });

  const screenshot = defineTool({
    name: 'browser_screenshot',
    label: 'Browser screenshot',
    description: 'A screenshot of the page as an image, for looking at layout and visuals.',
    parameters: Type.Object({ id: Type.String() }),
    async execute(_id, params) {
      const s = pageOf(params.id);
      const shot = await s.page.screenshot({ type: 'jpeg', quality: 70 });
      agentEvent(s, 'screenshot');
      return {
        content: [
          { type: 'image' as const, data: shot.toString('base64'), mimeType: 'image/jpeg' },
          { type: 'text' as const, text: await where(s) },
        ],
        details: {},
      };
    },
  });

  /* ── HTTP + WebSocket ───────────────────────────────────────────── */

  const wss = new WebSocketServer({ noServer: true });
  const PREFIX = '/ws/browser/';

  return {
    routes: {
      'POST /api/surfaces/browser': async (req, res) => {
        const body = await readJson<{ url?: unknown; viewport?: unknown }>(req).catch(() => ({}) as { url?: unknown; viewport?: unknown });
        if (typeof body.url !== 'string' || !body.url.trim()) return json(res, 400, { message: 'url is required' });
        const viewport = isPreset(body.viewport) ? body.viewport : undefined;
        try {
          const s = await openPage(normalizeUrl(body.url), viewport, 'user', MAIN_SESSION_ID);
          json(res, 200, { surface: surfaces.get('browser', s.id) });
        } catch (cause) {
          json(res, 500, { message: cause instanceof Error ? cause.message : String(cause) });
        }
      },
      'GET /api/surfaces/browser/:id/screenshot': async (_req, res, { params }) => {
        const s = live.get(params['id']!);
        if (!s) return json(res, 404, { message: 'no such browser surface' });
        const png = await s.page.screenshot({ type: 'png' }).catch(() => null);
        if (!png) return json(res, 500, { message: 'screenshot failed' });
        res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
        res.end(png);
      },
    },
    tools: [open, snapshot, click, type, read, screenshot],
    prompt: PROMPT,
    upgrades: {
      [PREFIX]: (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        const id = decodeURIComponent(new URL(req.url ?? '/', 'http://local').pathname.slice(PREFIX.length));
        const s = live.get(id);
        if (!s) return void socket.destroy();
        wss.handleUpgrade(req, socket, head, (ws) => attach(s, ws));
      },
    },
  };
}
