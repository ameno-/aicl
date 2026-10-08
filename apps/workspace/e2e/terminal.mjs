// Integration: terminal surface on the canvas (typing, resize, agent terminal_run with approval, reload replay).
// Runs against a live `npm run dev` with a real model; use a throwaway AICL_WORKSPACE.
// E2E_API / E2E_WEB point it at another instance; --shots=<dir> saves screenshots.
import { chromium } from 'playwright-core';

const API = process.env.E2E_API ?? 'http://127.0.0.1:5180';
const WEB = process.env.E2E_WEB ?? 'http://localhost:5181';
const SHOTS = process.argv.find((a) => a.startsWith('--shots='))?.slice(8);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/409|Failed to load resource/.test(m.text()) && errors.push(m.text()));
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
const dock = () => p.getByRole('complementary', { name: 'Agent chat' });
const ready = (scope, timeout = 300000) =>
  scope.locator('[data-aicl=composer][data-state=ready], [data-aicl=composer][data-state=error]').first().waitFor({ timeout });
const send = async (scope, text) => {
  await scope.locator('[data-aicl=composer-input]').first().fill(text);
  await scope.locator('[data-aicl=composer-submit]').first().click();
  await scope.locator('[data-aicl=composer-submit][data-role=stop]').first().waitFor({ timeout: 15000 });
};
const rows = (id) => p.locator(`[data-surface=terminal][data-surface-id="${id}"] .xterm-rows`).first();
const screenText = async (id) => (await rows(id).textContent().catch(() => '')) ?? '';
const open = async () => {
  await p.waitForFunction(() => window.__aiclEditor, null, { timeout: 30000 });
  await p.waitForTimeout(800);
};

const created = await (await fetch(`${API}/api/surfaces/terminal`, { method: 'POST', body: JSON.stringify({ title: 'e2e shell' }) })).json();
const id = created.surface.id;

await p.goto(`${WEB}/`);
await p.waitForTimeout(3000);
await p.reload();
await open();
await p.evaluate((tid) => {
  const ed = window.__aiclEditor;
  ed.deleteShapes([...ed.getCurrentPageShapeIds()]);
  ed.createShape({
    id: 'shape:term1',
    type: 'aicl-component',
    x: 0,
    y: 0,
    props: { w: 640, h: 380, component: 'surface', title: 'Terminal', props: { kind: 'terminal', id: tid } },
  });
  ed.select('shape:term1');
  ed.zoomToSelection({ animation: { duration: 0 } });
  ed.selectNone();
}, id);

await check('typing in the canvas card reaches the shell', async () => {
  await rows(id).waitFor({ timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.locator(`[data-surface-id="${id}"] .xterm-screen`).first().click();
  await p.keyboard.type('echo typed-by-user');
  await p.keyboard.press('Enter');
  await p.waitForFunction(
    (tid) => (document.querySelector(`[data-surface-id="${tid}"] .xterm-rows`)?.textContent ?? '').split('typed-by-user').length > 2,
    id,
    { timeout: 10000 },
  );
  await shot('terminal-typed');
  // tldraw shortcuts (e.g. "r" = rectangle tool) must not have fired.
  const tool = await p.evaluate(() => window.__aiclEditor.getCurrentToolId());
  if (tool !== 'select') throw new Error(`tool changed to ${tool}`);
});

await check('resizing the card changes the terminal cols', async () => {
  const cols = async () => {
    const tag = `C${Date.now() % 100000}`;
    await p.keyboard.type(`echo ${tag}=$(tput cols)=`);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(900);
    const m = [...(await screenText(id)).matchAll(new RegExp(`${tag}=(\\d+)=`, 'g'))];
    return Number(m[m.length - 1]?.[1]);
  };
  const before = await cols();
  await p.evaluate(() => window.__aiclEditor.updateShape({ id: 'shape:term1', type: 'aicl-component', props: { w: 400, h: 380 } }));
  await p.waitForTimeout(800);
  await p.keyboard.type('clear');
  await p.keyboard.press('Enter');
  const after = await cols();
  if (!(after < before)) throw new Error(`cols ${before} -> ${after}`);
  return `cols ${before} -> ${after}`;
});

await check('agent terminal_run: approval, live lines in the agent terminal, reply has step 3', async () => {
  await send(dock(), 'Use terminal_run to run `for i in 1 2 3; do echo step $i; sleep 1; done` in the agent terminal.');
  const approval = dock().locator('[data-hitl=approval]').last();
  await approval.waitFor({ timeout: 120000 });
  await shot('terminal-approval');
  const agentId = await p.evaluate(async () => {
    const { surfaces } = await (await fetch('/api/surfaces')).json();
    return surfaces.find((s) => s.title === 'agent')?.id ?? null;
  });
  if (agentId) throw new Error('agent terminal existed before approval');
  await approval.getByRole('button', { name: 'Approve' }).click();
  let aid = null;
  for (let i = 0; i < 40 && !aid; i++) {
    aid = await p.evaluate(async () => {
      const { surfaces } = await (await fetch('/api/surfaces')).json();
      return surfaces.find((s) => s.title === 'agent')?.id ?? null;
    });
    if (!aid) await p.waitForTimeout(250);
  }
  if (!aid) throw new Error('no agent terminal appeared');
  await p.evaluate((tid) => {
    const ed = window.__aiclEditor;
    ed.createShape({ id: 'shape:term2', type: 'aicl-component', x: 700, y: 0, props: { w: 520, h: 380, component: 'surface', title: 'Agent terminal', props: { kind: 'terminal', id: tid } } });
    ed.selectAll();
    ed.zoomToSelection({ animation: { duration: 0 } });
    ed.selectNone();
  }, aid);
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const t = await screenText(aid);
    seen.add((t.match(/^\s*step \d/gm) ?? []).length || (t.match(/step \d/g) ?? []).length);
    if (/step 3/.test(t) && seen.size >= 2) break;
    await p.waitForTimeout(250);
  }
  await ready(dock());
  const reply = await dock().locator('[data-aicl=message][data-role=assistant]').last().textContent();
  if (!/step 3/.test(reply ?? '')) throw new Error(`reply: ${(reply ?? '').slice(0, 120)}`);
  await shot('terminal-agent');
  return `step lines seen live: ${[...seen].join(',')}`;
});

await check('reload replays the scrollback', async () => {
  // The resize check ran `clear`, so write a fresh line to look for after the reload.
  await p.locator(`[data-surface-id="${id}"] .xterm-screen`).click();
  await p.keyboard.type('echo replay-marker');
  await p.keyboard.press('Enter');
  await p.waitForFunction((tid) => (document.querySelector(`[data-surface-id="${tid}"] .xterm-rows`)?.textContent ?? '').split('replay-marker').length > 2, id, { timeout: 10000 });
  await p.reload();
  await open();
  await p.waitForFunction(
    (tid) => (document.querySelector(`[data-surface-id="${tid}"] .xterm-rows`)?.textContent ?? '').split('replay-marker').length > 2,
    id,
    { timeout: 20000 },
  );
  await shot('terminal-reload');
});

await check('no page errors', async () => {
  if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
});

await b.close();
process.exit(failed ? 1 : 0);
