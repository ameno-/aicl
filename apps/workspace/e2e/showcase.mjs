// README screenshots (AICL-58): the Agent page after one real turn, the canvas with three designed
// screens in different styles, and those screens exported and running. Uses a real model for one
// turn and writes screens into the workspace, so run it against a throwaway AICL_WORKSPACE:
//   AICL_PORT=5194 AICL_WEB_PORT=5195 AICL_WORKSPACE=$(mktemp -d) npm run dev
//   E2E_API=http://127.0.0.1:5194 E2E_WEB=http://localhost:5195 node e2e/showcase.mjs --scratch-workspace --out=../../docs/screenshots
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const API = process.env.E2E_API ?? 'http://127.0.0.1:5180';
const WEB = process.env.E2E_WEB ?? 'http://localhost:5181';
const OUT = path.resolve(process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? 'showcase');
if (!process.argv.includes('--scratch-workspace')) {
  console.error('Refusing to run: this writes screens and a chat into the server workspace. Use a throwaway AICL_WORKSPACE and pass --scratch-workspace.');
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });
const ROOT = path.resolve(import.meta.dirname, '..');
const aicl = (...args) => execFileSync(process.execPath, [path.join(ROOT, 'bin/aicl.mjs'), '--url', API, ...args]).toString().trim();

// The built-in sample screen (shared/ui-spec.ts), read through the TypeScript loader.
const SAMPLE_ROOT = JSON.parse(
  execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', `import { SAMPLE_SCREEN } from ${JSON.stringify(path.join(ROOT, 'shared/ui-spec.ts'))}; console.log(JSON.stringify(SAMPLE_SCREEN.root));`]).toString(),
);
const thread = (children) => ({ id: 'thread', type: 'column', props: { grow: true, scroll: true, padding: 'lg', gap: 'md', maxWidth: 720 }, children });
const SCREENS = [
  {
    id: 'agent-thread',
    name: 'Agent thread',
    frame: 'desktop',
    theme: { preset: 'devin' },
    x: 0,
    y: 1000,
    root: SAMPLE_ROOT,
  },
  {
    id: 'build-studio',
    name: 'Build studio',
    frame: 'desktop',
    theme: { preset: 'lovable' },
    x: 0,
    y: 0,
    root: {
      id: 'root',
      type: 'column',
      props: { surface: 'bg', padding: 'xl', gap: 'lg', align: 'center' },
      children: [
        { id: 'title', type: 'heading', props: { text: 'What do you want to build?', level: 1, align: 'center' } },
        thread([
          { id: 'u1', type: 'userMessage', props: { text: 'A habit tracker with streaks' } },
          { id: 'p1', type: 'plan', props: { title: 'Plan', steps: [{ label: 'Data model', status: 'done' }, { label: 'Streak logic', status: 'running' }, { label: 'Reminders', status: 'pending' }] } },
          { id: 'a1', type: 'assistantMessage', props: { text: 'Starting with the **data model**, then the streak logic.' } },
        ]),
        { id: 'composer', type: 'composer', props: { placeholder: 'Describe your app…', chips: ['Todo app', 'Landing page', 'CRM'] } },
      ],
    },
  },
  {
    id: 'research-panel',
    name: 'Research panel',
    frame: 'panel',
    theme: { preset: 'cofounder' },
    x: 1060,
    y: 0,
    root: {
      id: 'root',
      type: 'column',
      props: { surface: 'bg' },
      children: [
        { id: 'header', type: 'header', props: { title: 'Market research', subtitle: 'Cofounder', actions: ['more'] } },
        thread([
          { id: 'u1', type: 'userMessage', props: { text: 'Who are our three closest competitors?' } },
          { id: 'r1', type: 'reasoning', props: { durationSec: 14 } },
          { id: 's1', type: 'toolStep', props: { label: 'Searched 12 sources', status: 'success' } },
          { id: 'a1', type: 'assistantMessage', props: { text: 'Three stand out:\n\n1. **Acme**: same buyer, cheaper\n2. **Globex**: better integrations\n3. **Initech**: enterprise only' } },
          { id: 'doc', type: 'artifact', props: { title: 'Competitor brief', kind: 'document', version: 1 } },
        ]),
        { id: 'composer', type: 'composer', props: { placeholder: 'Ask a follow-up…' } },
      ],
    },
  },
];

const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
// Canvas shot without the copilot dock (web/shell/Shell.tsx reads this key).
await page.addInitScript(() => localStorage.setItem('aicl.dock.open', '0'));

// 1. Canvas: three screens, three styles.
await page.goto(`${WEB}/#/canvas`);
await page.waitForTimeout(3000);
for (const s of SCREENS) {
  aicl('call', 'ui_create_screen', JSON.stringify(s));
}
aicl('call', 'canvas_focus', JSON.stringify({ ids: ['build-studio', 'research-panel'] }));
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(OUT, 'canvas-screens.png') });
console.log('canvas-screens.png');

// 2. Export each screen and run it on the echo backend.
const dir = mkdtempSync(path.join(tmpdir(), 'aicl-showcase-'));
let port = 8810;
for (const s of SCREENS) {
  const zip = path.join(dir, `${s.id}.zip`);
  aicl('export', s.id, '--target', 'html', '--out', zip);
  execFileSync('unzip', ['-q', zip, '-d', path.join(dir, s.id)]);
  const p = port++;
  const server = spawn(process.execPath, ['server/index.js'], { cwd: path.join(dir, s.id), env: { ...process.env, PORT: String(p), AICL_BACKEND: 'echo' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes('chat server on') && resolve()));
  const size = s.frame === 'panel' ? { width: 420, height: 760 } : { width: 1280, height: 800 };
  const app = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
  await app.goto(`http://127.0.0.1:${p}/`);
  const input = app.getByRole('textbox', { name: 'Message' });
  await input.fill(s.id === 'research-panel' ? 'Summarise that in one line' : 'Make it a todo app instead');
  await input.press('Enter');
  await app.getByText('You said:').waitFor({ timeout: 10000 });
  await app.waitForTimeout(1200);
  await app.screenshot({ path: path.join(OUT, `export-${s.id}.png`) });
  console.log(`export-${s.id}.png`);
  await app.close();
  server.kill();
}

// 3. The Agent page after one real turn (skip with --skip-agent to avoid the model call).
if (process.argv.includes('--skip-agent')) {
  await browser.close();
  process.exit(0);
}
await page.evaluate(() => localStorage.setItem('aicl.dock.open', '1'));
await page.goto(`${WEB}/#/agent`);
await page.locator('.hero [data-aicl=composer-input]').first().waitFor({ timeout: 15000 });
const composer = page.locator('.hero [data-aicl=composer-input]').first();
await composer.fill('Make a 3-step plan to add an export button to a chat app, using plan_update, then summarise it in two sentences.');
await composer.press('Enter');
const convo = page.locator('.conversation');
await convo.locator('[data-aicl=message][data-role=assistant]').first().waitFor({ timeout: 60000 });
await convo.locator('[data-aicl=composer][data-state=ready]').first().waitFor({ timeout: 300000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(OUT, 'agent-page.png') });
console.log('agent-page.png');

await browser.close();
