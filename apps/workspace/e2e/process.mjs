// Integration: process surface (agent process_start with approval, detected port, browser opens it, Stop from the view).
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
const surfaces = async () => (await (await fetch(`${API}/api/surfaces`)).json()).surfaces;
const waitFor = async (fn, ms = 60000) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out');
    await p.waitForTimeout(300);
  }
};

await p.goto(`${WEB}/`);
await p.waitForFunction(() => window.__aiclEditor, null, { timeout: 30000 });
await p.waitForTimeout(800);
const clearCanvas = () =>
  p.evaluate(() => {
    const ed = window.__aiclEditor;
    ed.deleteShapes([...ed.getCurrentPageShapeIds()]);
  });
// Cards of surfaces from an earlier run would reconnect to sockets that no longer exist: clear, let it save, reload.
await clearCanvas();
await p.waitForTimeout(2500);
errors.length = 0;
await p.reload();
await p.waitForFunction(() => window.__aiclEditor, null, { timeout: 30000 });
await p.waitForTimeout(800);

let proc;
const old = new Set((await surfaces()).filter((s) => s.kind === 'process').map((s) => s.id));
await check('agent starts a static server as a process after approval', async () => {
  await dock().locator('[data-aicl=composer-input]').first().fill(
    'Start a static file server for this workspace with `python3 -m http.server 0` as a process (process_start), then open it in the browser (browser_open).',
  );
  await dock().locator('[data-aicl=composer-submit]').first().click();
  const approval = dock().locator('[data-hitl=approval]').last();
  await approval.waitFor({ timeout: 120000 });
  await shot('process-approval');
  if ((await surfaces()).some((s) => s.kind === 'process' && !old.has(s.id))) throw new Error('process existed before approval');
  await approval.getByRole('button', { name: 'Approve' }).click();
  proc = await waitFor(async () => (await surfaces()).find((s) => s.kind === 'process' && !old.has(s.id) && s.meta?.ports?.length));
  return `${proc.id} ports ${proc.meta.ports}`;
});

await check('browser surface opens the detected port', async () => {
  const port = proc.meta.ports[0];
  const browser = await waitFor(async () => (await surfaces()).find((s) => s.kind === 'browser' && String(s.meta?.url ?? '').includes(String(port))), 120000);
  return browser.meta.url;
});

await check('process view shows running state, port button and logs; Stop ends it', async () => {
  await p.evaluate((id) => {
    const ed = window.__aiclEditor;
    ed.createShape({ id: 'shape:proc1', type: 'aicl-component', x: 0, y: 0, props: { w: 620, h: 340, component: 'surface', title: 'Process', props: { kind: 'process', id } } });
    ed.select('shape:proc1');
    ed.zoomToSelection({ animation: { duration: 0 } });
    ed.selectNone();
  }, proc.id);
  const view = p.locator(`[data-surface=process][data-surface-id="${proc.id}"]`);
  await view.waitFor({ timeout: 20000 });
  await view.locator('.proc-port').first().waitFor({ timeout: 10000 });
  await view.locator('.proc-log', { hasText: 'Serving HTTP' }).waitFor({ timeout: 10000 });
  await shot('process-running');
  await view.getByRole('button', { name: 'Stop process' }).click();
  await waitFor(async () => (await surfaces()).find((s) => s.id === proc.id)?.meta?.status === 'exited', 15000);
  await view.locator('.proc-state', { hasText: 'exited' }).waitFor({ timeout: 10000 });
  await shot('process-stopped');
});

await check('Restart brings it back; port button opens a browser surface', async () => {
  const view = p.locator(`[data-surface=process][data-surface-id="${proc.id}"]`);
  await view.getByRole('button', { name: 'Restart process' }).click();
  await waitFor(async () => {
    const s = (await surfaces()).find((x) => x.id === proc.id);
    return s?.meta?.status === 'running' && s.meta.ports.length ? s : null;
  }, 15000);
  const before = (await surfaces()).filter((s) => s.kind === 'browser').length;
  await view.locator('.proc-port').first().click();
  await waitFor(async () => (await surfaces()).filter((s) => s.kind === 'browser').length > before, 15000);
  await fetch(`${API}/api/surfaces/process/${proc.id}/stop`, { method: 'POST' });
});

await check('no page errors', async () => {
  if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
});

await b.close();
process.exit(failed ? 1 : 0);
