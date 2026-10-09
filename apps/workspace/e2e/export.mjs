// Export pipeline (AICL-58): every runnable target of a screen installs, builds, serves and chats.
// Generates the sample screen as react, react-tailwind, vue, svelte and html into --dir (default: a temp
// folder), runs `npm install` + `vite build` for the framework targets, starts each export's own
// server/index.js on the echo backend, and drives the page in Chromium: the designed conversation is
// shown, a sent message streams back with reasoning and a tool step, Stop keeps the partial reply.
// No model calls. Needs network for npm install (reused when --dir already has node_modules).
//   node e2e/export.mjs [--dir=/tmp/aicl-exports] [--only=react,html] [--shots=<dir>] [--headed]
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const DIR = arg('dir') ?? mkdtempSync(path.join(tmpdir(), 'aicl-exports-'));
const SHOTS = arg('shots');
const ONLY = arg('only')?.split(',');
const TARGETS = ['react', 'react-tailwind', 'vue', 'svelte', 'html'].filter((t) => !ONLY || ONLY.includes(t));
const ROOT = path.resolve(import.meta.dirname, '..');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

// Generate through the real exporter (TypeScript, run with strip-types).
const gen = path.join(DIR, 'gen.ts');
mkdirSync(DIR, { recursive: true });
writeFileSync(
  gen,
  `import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { exportProject } from ${JSON.stringify(path.join(ROOT, 'server/export/targets.ts'))};
import { SAMPLE_SCREEN } from ${JSON.stringify(path.join(ROOT, 'shared/ui-spec.ts'))};
for (const t of ${JSON.stringify(TARGETS)}) {
  for (const f of exportProject(SAMPLE_SCREEN, t).files) {
    const out = path.join(${JSON.stringify(DIR)}, t, f.path);
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, f.content);
  }
}
`,
);
execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', gen], { stdio: 'inherit' });

const failures = [];
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.log(`  ✗ ${name}: ${error.message}`);
  }
};

const browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
let port = 8790;
for (const target of TARGETS) {
  const cwd = path.join(DIR, target);
  console.log(`${target}  (${cwd})`);
  if (target !== 'html') {
    execFileSync('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd, stdio: 'inherit' });
    await step('npm run typecheck', async () => {
      try {
        execFileSync('npm', ['run', 'typecheck', '--silent'], { cwd, stdio: 'pipe' });
      } catch (error) {
        throw new Error(String(error.stdout || error.stderr || error.message).trim().split('\n').slice(0, 8).join('\n'));
      }
    });
    await step('vite build', async () => execFileSync('npx', ['vite', 'build'], { cwd, stdio: 'pipe' }));
  }
  const p = port++;
  const server = spawn(process.execPath, ['server/index.js'], { cwd, env: { ...process.env, PORT: String(p), AICL_BACKEND: 'echo' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => String(d).includes('chat server on') && resolve());
    server.on('exit', (code) => reject(new Error(`server exited ${code}`)));
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(`http://127.0.0.1:${p}/`);
    await step('designed conversation is shown', async () => {
      await page.getByText('The send button sometimes submits twice').waitFor({ timeout: 5000 });
      await page.getByText('Read packages/core/src/chat.ts').waitFor({ timeout: 2000 });
    });
    await step('a message streams back with reasoning and a tool step', async () => {
      const input = page.getByRole('textbox', { name: 'Message' });
      await input.fill('hello from the export test');
      await input.press('Enter');
      await page.locator('.aicl-md, [class*="leading-relaxed"]').filter({ hasText: 'You said: hello from the export test' }).waitFor({ timeout: 10000 });
      await page.getByText(/^echo$/).waitFor({ timeout: 2000 });
      await page.getByText(/Thought for \ds/).last().waitFor({ timeout: 2000 });
    });
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `export-${target}.png`) });
    await step('Stop keeps the partial reply', async () => {
      const input = page.getByRole('textbox', { name: 'Message' });
      await input.fill('stop me');
      await input.press('Enter');
      await page.getByRole('button', { name: 'Stop' }).click({ timeout: 5000 });
      await page.getByText('Stopped').waitFor({ timeout: 3000 });
      await page.getByRole('button', { name: 'Send' }).waitFor({ timeout: 2000 });
    });
    await step('no page errors', async () => {
      if (errors.length) throw new Error(errors.join(' | '));
    });
  } finally {
    await page.close();
    server.kill();
  }
}
await browser.close();
console.log(failures.length ? `\n${failures.length} failure(s):\n${failures.join('\n')}` : `\nall export targets passed (${TARGETS.join(', ')})`);
process.exit(failures.length ? 1 : 0);
