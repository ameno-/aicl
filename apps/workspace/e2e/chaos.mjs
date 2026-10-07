// Robustness: server killed mid-turn, a card whose renderer throws, going offline,
// terminal output across a server restart.
//
// Unlike the other suites this one STARTS AND STOPS the server itself (it has to
// kill it), plus a Vite dev server, from AICL_PORT / AICL_WEB_PORT /
// AICL_WORKSPACE. It uses a real model and CLEARS the canvas, so point
// AICL_WORKSPACE at a throwaway folder:
//
//   AICL_PORT=5196 AICL_WEB_PORT=5197 AICL_WORKSPACE=$(mktemp -d) \
//     node e2e/chaos.mjs --clears-canvas
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const PORT = process.env.AICL_PORT ?? '5196';
const WEB_PORT = process.env.AICL_WEB_PORT ?? '5197';
const WORKSPACE = process.env.AICL_WORKSPACE;
const API = process.env.E2E_API ?? `http://127.0.0.1:${PORT}`;
const WEB = process.env.E2E_WEB ?? `http://localhost:${WEB_PORT}`;
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!process.argv.includes('--clears-canvas') || !WORKSPACE) {
  console.error('Refusing to run: this test clears the canvas and kills a server. Set AICL_WORKSPACE to a throwaway folder and pass --clears-canvas.');
  process.exit(2);
}

/* ── processes ─────────────────────────────────────────────────────── */

const env = {
  ...process.env,
  AICL_PORT: PORT,
  AICL_WEB_PORT: WEB_PORT,
  AICL_WORKSPACE: WORKSPACE,
  AICL_MODEL: process.env.AICL_MODEL || 'ap-codex/gpt-6-luna',
};
const children = new Set();
const spawnChild = (cmd, args) => {
  const child = spawn(cmd, args, { cwd: appDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  child.on('exit', () => children.delete(child));
  child.stdout.on('data', () => {});
  child.stderr.on('data', (d) => process.env.CHAOS_VERBOSE && process.stderr.write(d));
  return child;
};
const waitFor = async (what, ok, timeout = 90000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timed out waiting for ${what}`);
};
let server = null;
const startServer = async () => {
  server = spawnChild('node', ['--experimental-strip-types', '--no-warnings', 'server/main.ts']);
  await waitFor('server', async () => (await fetch(`${API}/api/info`)).ok);
};
const killServer = async () => {
  const s = server;
  server = null;
  if (!s) return;
  const exited = new Promise((r) => s.once('exit', r));
  s.kill('SIGKILL');
  await exited;
};
const web = spawnChild(path.join(appDir, 'node_modules/.bin/vite'), []);
await startServer();
await waitFor('vite', async () => (await fetch(`${WEB}/`)).ok);
const cleanup = async () => {
  for (const c of children) c.kill('SIGKILL');
};
process.on('exit', () => children.forEach((c) => c.kill('SIGKILL')));

/* ── browser ───────────────────────────────────────────────────────── */

const b = await chromium.launch();
const context = await b.newContext({ viewport: { width: 1600, height: 1000 } });
const p = await context.newPage();
const errors = [];
// Errors this suite causes on purpose: a dead server, an offline browser, a card that throws.
const INTENDED = /Failed to load resource|ERR_|net::|Failed to fetch|NetworkError|EventSource|Intentional render failure|The above error occurred|Load failed/;
p.on('pageerror', (e) => !INTENDED.test(e.message) && errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && !INTENDED.test(m.text()) && !/409/.test(m.text()) && errors.push(m.text()));
let failed = 0;
const check = async (name, fn) => {
  try {
    const r = await fn();
    console.log(`PASS ${name}${r ? ` — ${r}` : ''}`);
  } catch (e) {
    failed++;
    if (env.CHAOS_SHOTS) await p.screenshot({ path: `${env.CHAOS_SHOTS}/${failed}.png` }).catch(() => {});
    console.log(`FAIL ${name} — ${e.message.split('\n')[0]}`);
  }
};
const dock = () => p.getByRole('complementary', { name: 'Agent chat' });
const banner = () => p.locator('[data-aicl-connection]');
const composer = () => dock().locator('[data-aicl=composer]').first();
const ready = (timeout = 240000) =>
  dock().locator('[data-aicl=composer][data-state=ready]').first().waitFor({ timeout });
const send = async (text) => {
  await dock().locator('[data-aicl=composer-input]').first().fill(text);
  await dock().locator('[data-aicl=composer-submit]').first().click();
  await dock().locator('[data-aicl=composer-submit][data-role=stop]').first().waitFor({ timeout: 15000 });
};
const open = async () => {
  await p.waitForFunction(() => window.__aiclEditor, null, { timeout: 30000 });
  await p.waitForTimeout(800);
};

try {
  await p.goto(`${WEB}/`);
  await p.waitForTimeout(3000); // let Vite finish any dependency re-optimisation reload
  await p.reload();
  await open();
  await p.evaluate(() => {
    const ed = window.__aiclEditor;
    ed.deleteShapes([...ed.getCurrentPageShapeIds()]);
  });

  // (b) one broken card must not take anything else down.
  await check('a card whose renderer throws shows the error fallback; the rest of the page works', async () => {
    await p.evaluate(() => {
      const ed = window.__aiclEditor;
      const card = (x, extra) => ({
        type: 'aicl-component',
        x,
        y: 0,
        props: { component: 'metric', title: 'Metric', w: 260, h: 160, props: { label: 'Users', value: '42', ...extra } },
      });
      ed.createShapes([card(0, { __aiclThrow: true }), card(320, {})]);
      ed.zoomToFit({ animation: { duration: 0 } });
    });
    await p.locator('[data-aicl-error-boundary="component"]').first().waitFor({ timeout: 10000 });
    const broken = await p.locator('[data-aicl-error-boundary="component"]').count();
    if (broken !== 1) throw new Error(`error fallbacks: ${broken}`);
    const text = (await p.locator('[data-aicl-error-boundary="component"]').textContent()) ?? '';
    if (!/failed to render/.test(text) || !/Retry/.test(text)) throw new Error(`fallback text: ${text}`);
    const good = await p.locator('.aicl-card', { hasText: '42' }).count();
    if (good < 1) throw new Error('the healthy card did not render');
    // The shell is alive: the dock accepts input, Retry re-renders (and fails again, in place).
    await dock().locator('[data-aicl=composer-input]').first().fill('still typing');
    await p.locator('[data-aicl-error-boundary="component"] button', { hasText: 'Retry' }).click();
    await p.locator('[data-aicl-error-boundary="component"]').first().waitFor({ timeout: 5000 });
    return 'one fallback, healthy card intact, dock usable';
  });
  await p.evaluate(() => {
    const ed = window.__aiclEditor;
    ed.deleteShapes([...ed.getCurrentPageShapeIds()]);
  });
  await dock().locator('[data-aicl=composer-input]').first().fill('');

  // (c) offline / online.
  await check('going offline shows the banner; coming back clears it and events resume', async () => {
    await context.setOffline(true);
    await banner().filter({ hasText: 'Offline' }).waitFor({ timeout: 10000 });
    await context.setOffline(false);
    await banner().waitFor({ state: 'detached', timeout: 30000 });
    const title = `Chaos events ${Date.now()}`;
    const r = await fetch(`${API}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!r.ok) throw new Error(`create session: ${r.status}`);
    await dock().getByRole('button', { name: 'Switch chat' }).click();
    await p.getByRole('listbox', { name: 'Chats' }).getByText(title).waitFor({ timeout: 10000 });
    await p.keyboard.press('Escape');
    return 'banner Offline, then gone; a server-side session event reached the page';
  });
  // Back on the main conversation for the turns below.
  await p.evaluate(() => localStorage.setItem('aicl.activeSession', 'main'));
  await p.reload();
  await open();

  // (d) terminal output survives a server restart.
  await check('a bash call\'s terminal output survives a server restart', async () => {
    await send("Run `printf 'alpha\\nbeta\\n'; echo gamma-$((6*7))` with bash, then say done.");
    const approval = dock().locator('[data-hitl=approval]').last();
    await approval.waitFor({ timeout: 120000 });
    await approval.getByRole('button', { name: 'Approve' }).click();
    await ready();
    const term = dock().locator('[data-live=terminal]').last();
    const before = (await term.textContent()) ?? '';
    if (!/gamma-42/.test(before)) throw new Error(`terminal before restart: ${before.slice(0, 80)}`);
    await killServer();
    await startServer();
    const t = await (await fetch(`${API}/api/sessions/main/terminal/latest`)).json();
    if (!t.lines?.includes('gamma-42') || !t.done) throw new Error(`API after restart: ${JSON.stringify(t).slice(0, 120)}`);
    await p.reload();
    await open();
    const after = dock().locator('[data-live=terminal]').last();
    await after.waitFor({ timeout: 20000 });
    await p.waitForFunction(
      () => /gamma-42/.test(document.querySelector('[aria-label="Agent chat"] [data-live=terminal]:last-of-type, [data-live=terminal]')?.textContent ?? ''),
      null,
      { timeout: 20000 },
    );
    return 'terminal shows gamma-42 after restart and reload';
  });

  // (a) the server dies mid-turn.
  await check('server killed mid-turn: banner, recovery, no stuck spinner, transcript intact', async () => {
    const prompt = 'Do not use any tools. Count from 1 to 3000 in plain text, nothing else.';
    await send(prompt);
    // Wait until text is actually streaming.
    await p.waitForFunction(
      () => {
        const msgs = document.querySelectorAll('[aria-label="Agent chat"] [data-aicl=message][data-role=assistant]');
        return (msgs[msgs.length - 1]?.textContent ?? '').length > 40;
      },
      null,
      { timeout: 60000 },
    );
    await killServer();
    await banner().filter({ hasText: /Reconnecting|Connection lost/ }).first().waitFor({ timeout: 30000 });
    await startServer();
    await banner().waitFor({ state: 'detached', timeout: 60000 });
    // Not stuck: the composer returns to ready (the stop button is gone).
    await ready(240000);
    if (await dock().locator('[data-aicl=composer-submit][data-role=stop]').count()) throw new Error('stop button still showing');
    const users = await dock().locator('[data-aicl=message][data-role=user]', { hasText: 'Count from 1 to 3000' }).count();
    if (users !== 1) throw new Error(`user message shown ${users} times`);
    const persisted = await (await fetch(`${API}/api/sessions/main/messages`)).json();
    const persistedUsers = persisted.messages.filter(
      (m) => m.role === 'user' && JSON.stringify(m.parts).includes('Count from 1 to 3000'),
    ).length;
    if (persistedUsers < 1) throw new Error('the server transcript never got the message (it should have been re-sent)');
    // And the conversation still works.
    await send('Reply with the single word: pong');
    await ready();
    const last = ((await dock().locator('[data-aicl=message][data-role=assistant]').last().textContent()) ?? '').toLowerCase();
    if (!/pong/.test(last)) throw new Error(`follow-up reply: ${last.slice(0, 60)}`);
    return `recovered; user message once in UI, ${persistedUsers}x on the server; follow-up answered`;
  });

  await check('no unexpected page errors', async () => {
    if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
  });
} finally {
  await b.close().catch(() => {});
  await cleanup();
}
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
