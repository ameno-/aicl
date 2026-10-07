// moi-computer integration against a live `npm run dev` (:5181/:5180) and a real model.
// Uses the workspace the server points at (expects a notes.md there) and writes
// applets into it: use a throwaway AICL_WORKSPACE and pass --scratch-workspace.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

// Targets the dev servers on 5180/5181; E2E_API / E2E_WEB point it at another instance.
const API = process.env.E2E_API ?? 'http://127.0.0.1:5180';
const WEB = process.env.E2E_WEB ?? 'http://localhost:5181';

if (!process.argv.includes('--scratch-workspace')) {
  console.error('Refusing to run: this test writes applets into the server workspace. Use a throwaway AICL_WORKSPACE and pass --scratch-workspace.');
  process.exit(2);
}
const SHOTS = process.argv.find((a) => a.startsWith('--shots='))?.slice(8);
const here = path.dirname(new URL(import.meta.url).pathname);

const info = await (await fetch(`${API}/api/info`)).json();
const WS = info.workspace;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1680, height: 1050 } });
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
const shot = (name) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png` });
const tab = (key) => p.locator(`[data-tab="${key}"]`).first();
const chat = () => p.locator('[aria-label="Agent chat"], .agent-page').filter({ has: p.locator('[data-aicl=composer]:visible') }).first();
async function ask(text) {
  const c = chat();
  await c.locator('[data-aicl=composer-input]').fill(text);
  await c.locator('[data-aicl=composer-input]').press('Enter');
  await c.locator('[data-aicl=composer-submit][data-role=stop]').waitFor({ timeout: 20000 });
  await c.locator('[data-aicl=composer][data-state=ready], [data-aicl=composer][data-state=error]').waitFor({ timeout: 480000 });
  const state = await c.locator('[data-aicl=composer]').getAttribute('data-state');
  if (state !== 'ready') throw new Error(`agent ended in ${state}`);
  return c.locator('[data-aicl=tool-call]').allTextContents();
}

await p.goto(`${WEB}/`);
await p.waitForTimeout(3000);
await p.reload();
await p.waitForFunction(() => window.__aiclEditor, null, { timeout: 30000 });

await check('shell: tabs, canvas default, dock present', async () => {
  for (const key of ['agent', 'canvas', 'overview']) if (!(await tab(key).count())) throw new Error(`no ${key} tab`);
  if ((await tab('canvas').getAttribute('aria-selected')) !== 'true') throw new Error('canvas not default');
  if (!(await p.locator('[aria-label="Agent chat"]').count())) throw new Error('no dock');
});

await check('agent builds a widget with a server function and pins it to Overview', async () => {
  const steps = await ask(
    'Build a widget applet with id "notes-stats" that shows the number of lines and words in notes.md using a server function, with a Refresh button and an "Ask agent to summarize" button that sends the message "Summarize notes.md in one sentence". Build it and pin it to the Overview, then open the Overview.',
  );
  await tab('overview').waitFor();
  if ((await tab('overview').getAttribute('aria-selected')) !== 'true') await tab('overview').click();
  const card = p.locator('[data-applet="notes-stats"]');
  await card.getByRole('button', { name: /refresh/i }).first().waitFor({ timeout: 30000 });
  await shot('1-overview-widget');
  return `steps: ${steps.slice(-5).join(' | ')}`;
});

await check('widget server function reads live data: Refresh picks up file changes', async () => {
  const card = p.locator('[data-applet="notes-stats"]');
  const before = await card.innerText();
  writeFileSync(path.join(WS, 'notes.md'), readFileSync(path.join(WS, 'notes.md'), 'utf8') + '- added line one\n- added line two\n');
  await card.getByRole('button', { name: /refresh/i }).first().click();
  await p.waitForTimeout(1500);
  const after = await card.innerText();
  if (before === after) throw new Error('nothing changed after refresh');
  return `${before.replace(/\s+/g, ' ').slice(0, 60)} → ${after.replace(/\s+/g, ' ').slice(0, 60)}`;
});

await check('widget button messages the agent (applet intent → session) and the agent answers', async () => {
  const c = p.locator('[aria-label="Agent chat"]');
  if (!(await c.isVisible())) await p.getByRole('button', { name: 'Show copilot' }).click();
  const n = await c.locator('[data-aicl=message][data-role=assistant]').count();
  const users = await c.locator('[data-aicl=message][data-role=user]').count();
  await p.locator('[data-applet="notes-stats"]').getByRole('button', { name: /summarize/i }).click();
  await p.waitForFunction((n) => document.querySelectorAll('[aria-label="Agent chat"] [data-aicl=message][data-role=user]').length > n, users, { timeout: 15000 });
  await c.locator('[data-aicl=composer][data-state=ready]').waitFor({ timeout: 240000 });
  const replies = await c.locator('[data-aicl=message][data-role=assistant]').count();
  if (replies <= n) throw new Error('no answer');
});

await check('agent builds a view applet and it opens as its own tab', async () => {
  const steps = await ask(
    'Build a view applet with id "launch-board" titled "Launch board": a three-column board (Todo, Doing, Done) whose cards come from a server function that parses the bullet lines of notes.md into Todo. Build it and open it.',
  );
  await p.locator('[data-tab="view:launch-board"], [data-tab^="view"]').first().waitFor({ timeout: 20000 });
  await p.waitForTimeout(800);
  const text = await p.locator('.view-page').innerText();
  if (!/todo/i.test(text) || !/done/i.test(text)) throw new Error(`view content: ${text.slice(0, 120)}`);
  await shot('2-view');
  return `steps: ${steps.slice(-4).join(' | ')}`;
});

await check('sessions: a second chat is independent and both persist', async () => {
  await tab('agent').click();
  await p.locator('button:visible', { hasText: 'New chat' }).first().click();
  await p.waitForTimeout(500);
  await ask('Reply with exactly: second chat');
  const res = await (await fetch(`${API}/api/sessions`)).json();
  if (res.sessions.length < 2) throw new Error(`${res.sessions.length} sessions`);
  await shot('3-agent-tab');
  return res.sessions.map((s) => s.title).join(' | ');
});

await check('external agent CLI drives the open canvas', async () => {
  await tab('canvas').click();
  const cli = (args) => execFileSync('node', [path.join(here, '../bin/aicl.mjs'), '--url', API, ...args], { encoding: 'utf8' });
  const tools = cli(['tools']);
  if (!/canvas_arrange/.test(tools)) throw new Error('canvas_arrange missing from CLI tool list');
  cli(['add', JSON.stringify([{ kind: 'note', id: 'cli-a', text: 'from the CLI', x: 0, y: 900 }, { kind: 'note', id: 'cli-b', text: 'external agent', x: 400, y: 1100 }])]);
  cli(['call', 'canvas_arrange', JSON.stringify({ ids: ['cli-a', 'cli-b'], mode: 'stack-horizontal' })]);
  const ys = await p.evaluate(() => ['shape:cli-a', 'shape:cli-b'].map((id) => Math.round(window.__aiclEditor.getShape(id)?.y ?? NaN)));
  if (ys[0] !== ys[1]) throw new Error(`not stacked: ${ys}`);
  return `notes stacked at y=${ys[0]}`;
});

await check('no page errors', async () => {
  if (errors.length) throw new Error(JSON.stringify(errors.slice(0, 3)));
});

await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
