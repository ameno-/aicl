// AICL-41 canvas as the shared design space: work frames, agent presence, follow, canvas-first mode,
// "Open in app", tidy. Runs against a live `npm run dev` with a real model and CLEARS the canvas of the
// workspace that server points at. Use a throwaway git repo containing src/app.ts and notes.md:
//   E2E_API=http://127.0.0.1:5190 E2E_WEB=http://localhost:5191 node e2e/workspace-canvas.mjs --clears-canvas --shots=<dir> [--headed]
import { chromium } from 'playwright-core';

const API = process.env.E2E_API ?? 'http://127.0.0.1:5180';
const WEB = process.env.E2E_WEB ?? 'http://localhost:5181';

if (!process.argv.includes('--clears-canvas')) {
  console.error('Refusing to run: this test clears the canvas. Use a throwaway AICL_WORKSPACE and pass --clears-canvas.');
  process.exit(2);
}
const SHOTS = process.argv.find((a) => a.startsWith('--shots='))?.slice(8);
const headed = process.argv.includes('--headed');

const b = await chromium.launch({ headless: !headed, ...(process.env.E2E_CHROME ? { executablePath: process.env.E2E_CHROME } : {}) });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/409|Failed to load resource|WebGL|GPU/.test(m.text()) && errors.push(m.text()));
let failed = 0;
const check = async (name, fn) => {
  try {
    const r = await fn();
    console.log(`PASS ${name}${r ? ` — ${r}` : ''}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name} — ${e.message.split('\n')[0]}`);
  }
};
const shot = (name) => (SHOTS ? p.screenshot({ path: `${SHOTS}/${name}.png` }) : undefined);
const dock = () => p.getByRole('complementary', { name: /Agent chat|Floating chat/ }).first();
const until = async (fn, timeout, what) => {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn().catch(() => false);
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out: ${what}`);
    await p.waitForTimeout(250);
  }
};

/** Everything about the canvas the checks need, read from the live editor. */
const world = () =>
  p.evaluate(() => {
    const e = window.__aiclEditor;
    const shapes = e.getCurrentPageShapes();
    const frames = shapes
      .filter((s) => s.type === 'frame' && s.meta?.workframe)
      .map((f) => {
        const kids = shapes
          .filter((s) => s.parentId === f.id && s.props?.component === 'surface')
          .map((s) => ({ id: s.id, kind: s.props.props.kind, sid: s.props.props.id, x: s.x, y: s.y, w: s.props.w, h: s.props.h, moved: !!s.meta?.userMoved }));
        return { id: f.id, name: f.props.name, session: f.meta.sessionId, x: f.x, y: f.y, w: f.props.w, h: f.props.h, kids };
      });
    return { frames, camera: e.getCamera(), cards: shapes.filter((s) => s.props?.component === 'surface').length };
  });
const overlap = (a, c) => a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;

/** Send in the visible chat; approve every approval card until the turn ends. */
async function ask(text, { onTick } = {}) {
  const input = dock().locator('[data-aicl=composer-input]').first();
  await input.fill(text);
  await dock().locator('[data-aicl=composer-submit]').first().click();
  await p.waitForTimeout(500);
  const start = Date.now();
  const end = start + 240000;
  let sawBusy = false;
  for (;;) {
    for (const card of await p.locator('[data-hitl=approval]').all()) {
      const btn = card.getByRole('button', { name: 'Approve' });
      if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
    }
    if (onTick) await onTick();
    const busy = (await (await fetch(`${API}/api/sessions`)).json()).sessions.some((s) => s.status === 'running');
    sawBusy ||= busy;
    if (!busy && (sawBusy || Date.now() - start > 20000)) break;
    if (Date.now() > end) throw new Error('turn did not finish');
    await p.waitForTimeout(400);
  }
}

await p.goto(`${WEB}/#/canvas`);
await p.waitForFunction(() => window.__aiclEditor, null, { timeout: 30000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__aiclEditor.deleteShapes([...window.__aiclEditor.getCurrentPageShapeIds()]));

/* ── 1. the run: frame, cards, presence, follow ─────────────────── */
let sawCursor = false;
let sawGlow = false;
let cursorLabel = '';
let cameraMoved = false;
const cam0 = (await world()).camera;
await p.getByRole('button', { name: 'Follow agent' }).first().click();
await check('Follow turns on from the canvas toolbar', async () => {
  const on = await p.locator('.canvas-toolbar button[aria-label="Follow agent"]').getAttribute('aria-pressed');
  if (on !== 'true') throw new Error('not pressed');
});

await ask(
  "Open src/app.ts, change the greeting, show me this turn's diff, and run `echo built` in the agent terminal.",
  {
    onTick: async () => {
      if (!sawCursor && (await p.locator('[data-presence-cursor]').count()) > 0) {
        sawCursor = true;
        cursorLabel = (await p.locator('.presence-label').first().innerText()).trim();
        sawGlow = (await p.locator('[data-presence-glow]').count()) > 0;
        await shot('workframe-midrun');
      }
      const c = (await world()).camera;
      if (Math.abs(c.x - cam0.x) + Math.abs(c.y - cam0.y) + Math.abs(c.z - cam0.z) > 1) cameraMoved = true;
    },
  },
);
await p.waitForTimeout(1500);

await check('work frame titled with the session holds file, diff and terminal cards, no overlap', async () => {
  const w = await world();
  if (w.frames.length !== 1) throw new Error(`frames: ${w.frames.length}`);
  const f = w.frames[0];
  const kinds = f.kids.map((k) => k.kind).sort();
  for (const k of ['diff', 'file', 'terminal']) if (!kinds.includes(k)) throw new Error(`missing ${k}: ${kinds}`);
  for (let i = 0; i < f.kids.length; i++) {
    const a = f.kids[i];
    if (a.x < 0 || a.y < 0 || a.x + a.w > f.w || a.y + a.h > f.h) throw new Error(`${a.kind} outside frame`);
    for (let j = i + 1; j < f.kids.length; j++) if (overlap(a, f.kids[j])) throw new Error(`${a.kind} overlaps ${f.kids[j].kind}`);
  }
  const title = (await (await fetch(`${API}/api/sessions`)).json()).sessions.find((s) => s.id === f.session)?.title;
  if (!title || f.name !== title) throw new Error(`frame "${f.name}" vs session "${title}"`);
  return `"${f.name}": ${kinds.join(', ')}; frame ${Math.round(f.w)}x${Math.round(f.h)}`;
});
await check('agent presence cursor and glow were visible during the run', async () => {
  if (!sawCursor) throw new Error('no cursor seen');
  if (!sawGlow) throw new Error('no glow seen');
  return `label "${cursorLabel}"`;
});
await check('presence fades after the agent goes idle', async () => {
  await until(async () => (await p.locator('[data-presence-cursor]').count()) === 0, 8000, 'cursor fade');
});
await check('Follow moved the camera during the run', async () => {
  if (!cameraMoved) throw new Error('camera never moved');
});
await check('a user wheel on the canvas turns Follow off', async () => {
  await p.mouse.move(800, 500);
  await p.mouse.wheel(0, 120);
  await until(async () => (await p.locator('.canvas-toolbar button[aria-label="Follow agent"]').getAttribute('aria-pressed')) === 'false', 3000, 'follow off');
});
await shot('workframe-done');

/* ── 2. reload: no duplicates; user moves are respected ─────────── */
const before = await world();
await p.reload();
await p.waitForFunction(() => window.__aiclEditor, null, { timeout: 30000 });
await p.waitForTimeout(2500);
await check('reload adds no duplicate cards', async () => {
  const w = await world();
  if (w.cards !== before.cards) throw new Error(`cards ${before.cards} → ${w.cards}`);
  const keys = w.frames.flatMap((f) => f.kids.map((k) => `${k.kind}/${k.sid}`));
  if (new Set(keys).size !== keys.length) throw new Error(`duplicate surface cards: ${keys}`);
  return `${w.cards} cards`;
});

const moved = before.frames[0].kids.find((k) => k.kind === 'terminal');
await p.evaluate(({ id }) => {
  const e = window.__aiclEditor;
  const s = e.getShape(id);
  e.updateShape({ id, type: s.type, x: s.x + 37, y: s.y + 91 });
}, { id: moved.id });
await p.waitForTimeout(800);
const movedAt = await p.evaluate((id) => {
  const s = window.__aiclEditor.getShape(id);
  return { x: s.x, y: s.y, flag: !!s.meta?.userMoved };
}, moved.id);
await check('moving a card marks it as user-placed', async () => {
  if (!movedAt.flag) throw new Error('userMoved not set');
});
await ask('Now run `echo again` in the agent terminal and open notes.md for me.');
await p.waitForTimeout(1500);
await check('the moved card is not moved back by later agent work', async () => {
  const w = await world();
  const k = w.frames[0].kids.find((c) => c.id === moved.id);
  if (!k || k.x !== movedAt.x || k.y !== movedAt.y) throw new Error(`card at ${k?.x},${k?.y}; expected ${movedAt.x},${movedAt.y}`);
  const kids = w.frames[0].kids;
  // The user's own move may overlap an old neighbour (their call); everything else must not overlap.
  const old = new Set(before.frames[0].kids.map((c) => c.id));
  for (let i = 0; i < kids.length; i++)
    for (let j = i + 1; j < kids.length; j++) {
      const bothOldWithMoved = old.has(kids[i].id) && old.has(kids[j].id) && (kids[i].id === moved.id || kids[j].id === moved.id);
      if (!bothOldWithMoved && overlap(kids[i], kids[j])) throw new Error(`${kids[i].kind} overlaps ${kids[j].kind}`);
    }
  return `${kids.length} cards, new ones placed without overlap`;
});

/* ── 3. canvas-first mode ───────────────────────────────────────── */
await check('canvas-first mode: toggle, floating chat replies, About chip', async () => {
  await p.keyboard.press('Control+Shift+F');
  await p.locator('.floating-chat').waitFor({ timeout: 5000 });
  if (!p.url().includes('mode=focus')) throw new Error('route is not mode=focus');
  if (await p.locator('.shell-topbar, header.topbar').count()) throw new Error('top bar still visible');
  await p.evaluate(() => {
    const e = window.__aiclEditor;
    e.select(...e.getCurrentPageShapes().filter((s) => s.props?.component === 'surface').slice(0, 2).map((s) => s.id));
  });
  await dock().getByText(/About: 2 cards/).waitFor({ timeout: 5000 });
  const input = dock().locator('[data-aicl=composer-input]').first();
  await input.fill('Reply with exactly the word: pong');
  await dock().locator('[data-aicl=composer-submit]').first().click();
  await dock().getByText('pong', { exact: true }).last().waitFor({ timeout: 120000 });
  await shot('canvas-first');
});
await check('floating chat drags and collapses', async () => {
  const bar = p.locator('.floating-chat__bar');
  const box0 = await p.locator('.floating-chat').boundingBox();
  const bb = await bar.boundingBox();
  await p.mouse.move(bb.x + 60, bb.y + 10);
  await p.mouse.down();
  await p.mouse.move(bb.x - 240, bb.y + 90, { steps: 6 });
  await p.mouse.up();
  const box1 = await p.locator('.floating-chat').boundingBox();
  if (Math.abs(box1.x - box0.x) < 100) throw new Error('did not move');
  await p.getByRole('button', { name: 'Collapse chat' }).click();
  await p.getByRole('button', { name: 'Expand chat' }).click();
  await p.locator('.floating-chat').waitFor();
});
await check('Open in app on the diff card opens the Agent tab on Changes', async () => {
  await p.evaluate(() => {
    const e = window.__aiclEditor;
    e.selectNone();
  });
  const diffCard = p.locator('.aicl-card', { has: p.locator('[data-surface=diff]') }).first();
  await diffCard.waitFor({ timeout: 10000 });
  await diffCard.getByRole('button', { name: 'Open in app' }).dispatchEvent('click');
  await until(async () => /#\/agent\//.test(p.url()), 5000, 'agent route');
  await p.locator('.agent-page [data-surface=diff]').first().waitFor({ timeout: 15000 });
  await shot('open-in-app');
});

/* ── 4. second session + tidy ───────────────────────────────────── */
await p.goto(`${WEB}/#/canvas`);
await p.waitForTimeout(1500);
await p.getByRole('button', { name: /new (chat|session|task|project)/i }).first().click();
await ask('Create a file extra.txt containing the word hi, then open it for me with the file_open tool. Nothing else.');
await p.waitForTimeout(1500);
await check('a second session gets its own work frame', async () => {
  const w = await world();
  if (w.frames.length < 2) throw new Error(`frames: ${w.frames.length}`);
  return w.frames.map((f) => f.name).join(' | ');
});
await p.evaluate(() => {
  const e = window.__aiclEditor;
  const f = e.getCurrentPageShapes().filter((s) => s.type === 'frame' && s.meta?.workframe)[0];
  const b = e.getShapePageBounds(f.id);
  // A user-placed note in the way of the lanes, outside every frame.
  e.createShape({ type: 'note', x: b.minX - 40, y: b.minY - 10, props: { richText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'my note' }] }] } } });
});
await p.getByRole('button', { name: 'Tidy canvas' }).click();
await p.waitForTimeout(1500);
await check('Tidy lays frames in lanes, most recent first, clear of the user note', async () => {
  const frames = await p.evaluate(() => {
    const e = window.__aiclEditor;
    return e.getCurrentPageShapes().filter((s) => s.type === 'frame' && s.meta?.workframe).map((f) => {
      const b = e.getShapePageBounds(f.id);
      return { session: f.meta.sessionId, x: b.x, y: b.y, w: b.w, h: b.h };
    });
  });
  const note = await p.evaluate(() => {
    const e = window.__aiclEditor;
    const n = e.getCurrentPageShapes().find((s) => s.type === 'note');
    const b = e.getShapePageBounds(n.id);
    return { x: b.x, y: b.y, w: b.w, h: b.h };
  });
  const sessions = (await (await fetch(`${API}/api/sessions`)).json()).sessions;
  const order = [...frames].sort((a, c) => a.y - c.y).map((f) => f.session);
  const recent = [...order].sort((a, c) => (sessions.find((s) => s.id === c)?.updatedAt ?? 0) - (sessions.find((s) => s.id === a)?.updatedAt ?? 0));
  if (order.join() !== recent.join()) throw new Error(`lane order ${order} vs recency ${recent}`);
  for (let i = 0; i < frames.length; i++) {
    if (overlap(frames[i], note)) throw new Error('a frame overlaps the user note');
    for (let j = i + 1; j < frames.length; j++) if (overlap(frames[i], frames[j])) throw new Error('frames overlap');
  }
  return `${frames.length} lanes: ${order.join(' → ')}`;
});
await shot('tidy-lanes');

await check('no page errors', async () => {
  if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
});
await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
