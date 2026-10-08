// The assistant application (AICL-44) against a live `npm run dev` (E2E_API / E2E_WEB) and a real model.
// One design (no kit picker): start a chat from the hero, ask for a plan + a bash call, approve it,
// watch the work panel show it live (Plan appears only with a plan, Changes is never empty), get the
// reply. Then shortcuts, settings, the model picker, persistence, Esc to stop, and the copilot dock
// living only on the Canvas tab. (Sidebar management has its own suite: e2e/sidebar.mjs.)
//   AICL_PORT=5192 AICL_WEB_PORT=5193 AICL_WORKSPACE=<temp dir with notes.md> npm run dev
//   E2E_API=http://127.0.0.1:5192 E2E_WEB=http://localhost:5193 node e2e/app.mjs --scratch-workspace --shots=/tmp/shots
// Runs headed (WebGPU ambience only renders in a real window); pass --headless to skip that.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const API = process.env.E2E_API ?? 'http://127.0.0.1:5180';
const WEB = process.env.E2E_WEB ?? 'http://localhost:5181';

if (!process.argv.includes('--scratch-workspace')) {
  console.error('Refusing to run: the agent runs commands and writes in the server workspace. Use a throwaway AICL_WORKSPACE and pass --scratch-workspace.');
  process.exit(2);
}
const SHOTS = process.argv.find((a) => a.startsWith('--shots='))?.slice(8);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const headless = process.argv.includes('--headless');

const HERO = 'What should we work on today?';
const PROMPT = 'Make a 2-step plan, run `echo hello` with bash, then say done.';

const b = await chromium.launch({ headless, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan'] });
const ctx = await b.newContext({ viewport: { width: 1480, height: 940 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/409|Failed to load resource|WebGPU|GPU/i.test(m.text()) && errors.push(m.text()));

let failed = 0;
const check = async (name, fn) => {
  try {
    const r = await fn();
    console.log(`PASS ${name}${r ? ` — ${r}` : ''}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name} — ${e.message.split('\n')[0]}`);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/FAIL-${name.replace(/\W+/g, '-').slice(0, 60)}.png` }).catch(() => {});
  }
};
const shot = (name) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png` });
const MOD = 'ControlOrMeta';
const C = {
  root: '[data-aicl=composer]',
  input: '[data-aicl=composer-input]',
  stop: '[data-aicl=composer-submit][data-role=stop]',
  ready: '[data-aicl=composer][data-state=ready]',
  done: '[data-aicl=composer][data-state=ready], [data-aicl=composer][data-state=error]',
};
/** Re-throws a wait failure with the step's name, so a FAIL line says what was missing. */
const step = (name) => (e) => {
  throw new Error(`${name}: ${e.message.split('\n')[0]}`);
};

async function palette(query) {
  await p.keyboard.press(`${MOD}+k`);
  const input = p.getByRole('combobox', { name: 'Search commands' });
  await input.waitFor({ timeout: 5000 });
  await input.fill(query);
  await p.getByRole('option').first().waitFor({ timeout: 5000 });
  await p.keyboard.press('Enter');
  await input.waitFor({ state: 'detached', timeout: 5000 });
}
const sidebar = () => p.locator('aside.agent-sidebar');
const panel = () => p.locator('aside[aria-label="Work panel"]');

await p.goto(`${WEB}/#/agent`);
await p.waitForSelector('.agent-page', { timeout: 30000 });

await check('one design: the assistant shell, a chats tree, no kit picker', async () => {
  await p.locator('[data-kit="assistant"].app-root').waitFor({ timeout: 5000 });
  if ((await sidebar().getAttribute('aria-label')) !== 'Chats') throw new Error('sidebar is not "Chats"');
  await sidebar().locator('[data-chat-tree]').waitFor({ timeout: 5000 });
  await p.keyboard.press(`${MOD}+k`);
  const input = p.getByRole('combobox', { name: 'Search commands' });
  await input.fill('kit');
  await p.waitForTimeout(300);
  const kitCommands = await p.getByRole('option', { name: /Switch kit/ }).count();
  await p.keyboard.press('Escape');
  if (kitCommands) throw new Error('⌘K still offers "Switch kit"');
  if (await p.getByRole('button', { name: /copilot/i }).count()) throw new Error('copilot toggle shown off the Canvas tab');
});

await check('new chat from the hero', async () => {
  await palette('New chat');
  const hero = p.locator('.hero');
  await hero.waitFor({ timeout: 10000 });
  const title = (await hero.locator('.hero-title').textContent())?.trim();
  if (title !== HERO) throw new Error(`hero title "${title}"`);
  await hero.locator(C.root).first().waitFor();
  await p.waitForTimeout(1500); // let the ambience settle for the screenshot
  await shot('1-hero');
  return title;
});

await check('ask, approve bash, work panel live, reply; Plan only with a plan; Changes never empty', async () => {
  const input = p.locator('.hero').locator(C.input).first();
  await input.fill(PROMPT);
  await input.press('Enter');
  const convo = p.locator('.conversation');
  await convo.locator('[data-aicl=message][data-role=user]').waitFor({ timeout: 15000 });

  await panel().waitFor({ timeout: 60000 }).catch(step('the work panel opens by itself'));
  const approval = convo.locator('[data-hitl=approval]').last();
  await approval.waitFor({ timeout: 120000 });
  await shot('2-approval');
  await approval.getByRole('button', { name: 'Approve' }).click();

  await panel().getByRole('tab', { name: 'Terminal' }).click();
  await panel().locator('[data-pane=terminal]').getByText('hello', { exact: false }).first().waitFor({ timeout: 60000 }).catch(step('Terminal shows the output live'));
  await p.waitForTimeout(600);
  await shot('3-working');

  await convo.locator(C.ready).first().waitFor({ timeout: 300000 });
  const reply = await convo.locator('[data-aicl=message][data-role=assistant]').last().innerText();
  if (!/done/i.test(reply)) throw new Error(`reply was: ${reply.slice(0, 120)}`);

  // Plan: present now (a plan exists), and last.
  const tabs = await panel().getByRole('tablist', { name: 'Work panel tabs' }).getByRole('tab').allTextContents();
  if (!/^Plan/.test(tabs[tabs.length - 1] ?? '')) throw new Error(`Plan is not the last tab: ${tabs.join(' | ')}`);
  await panel().getByRole('tab', { name: /^Plan/ }).click();
  await panel().locator('[data-fx-component=AnimatedPlan]').waitFor({ timeout: 10000 }).catch(step('Plan tab shows the plan'));

  // Files: the tree, then the file view.
  await panel().getByRole('tab', { name: 'Files' }).click();
  const entry = panel().locator('[data-pane=files]').getByRole('treeitem', { name: 'notes.md' }).first();
  await entry.waitFor({ timeout: 10000 }).catch(step('Files tab lists notes.md'));
  await entry.click();
  const { text: notes } = await (await fetch(`${API}/api/file/text?path=notes.md`)).json();
  const line = notes.trim().split('\n').pop().replace(/^[-#\s]+/, '').slice(0, 40);
  await panel().locator('[data-pane=file-content]').getByText(line).first().waitFor({ timeout: 10000 }).catch(step(`file view shows "${line}"`));

  // Changes: a diff (git) or the GitHub start (not a repo) — never an empty pane.
  await panel().getByRole('tab', { name: 'Changes' }).click();
  await panel().locator('[data-surface=diff], .wp-github').first().waitFor({ timeout: 20000 }).catch(step('Changes shows a diff or GitHub'));
  await shot('4-done');
  return tabs.join(' · ');
});

await check('⌘N starts a chat; it appears in the tree', async () => {
  const before = (await (await fetch(`${API}/api/sessions`)).json()).sessions.length;
  await p.keyboard.press(`${MOD}+n`);
  await p.locator('.hero').waitFor({ timeout: 10000 });
  for (let i = 0; ; i++) {
    if ((await (await fetch(`${API}/api/sessions`)).json()).sessions.length > before) break;
    if (i > 20) throw new Error('no new session');
    await p.waitForTimeout(250);
  }
  await sidebar().getByRole('treeitem', { name: 'New chat' }).first().waitFor({ timeout: 5000 });
});

await check('⌘/ shows shortcuts; settings switches appearance (no kit section)', async () => {
  await p.keyboard.press(`${MOD}+/`);
  await p.getByRole('dialog', { name: 'Keyboard shortcuts' }).waitFor({ timeout: 5000 });
  await p.keyboard.press('Escape');
  await p.getByRole('dialog', { name: 'Keyboard shortcuts' }).waitFor({ state: 'detached', timeout: 5000 });
  await p.getByRole('button', { name: 'Settings' }).click();
  const dlg = p.getByRole('dialog', { name: 'Settings' });
  await dlg.waitFor({ timeout: 5000 });
  if (await dlg.getByRole('radiogroup', { name: 'Kit' }).count()) throw new Error('settings still has a kit picker');
  await dlg.getByRole('radio', { name: 'Dark' }).click();
  await p.waitForFunction(() => document.querySelector('.app-root')?.getAttribute('data-theme') === 'dark', null, { timeout: 5000 });
  await shot('settings-dark');
  await dlg.getByRole('radio', { name: 'Default' }).click();
  await p.keyboard.press('Escape');
});

await check('model picker lists models; the switch persists across reload', async () => {
  const { models } = await (await fetch(`${API}/api/models`)).json();
  if (!models.length) throw new Error('no models');
  await p.keyboard.press(`${MOD}+n`);
  await p.locator('.hero').waitFor();
  const sessionId = (await (await fetch(`${API}/api/sessions`)).json()).sessions[0].id;
  await p.getByRole('button', { name: 'Settings' }).click();
  const select = p.getByRole('dialog', { name: 'Settings' }).getByRole('combobox', { name: 'Model' });
  const options = await select.locator('option').evaluateAll((os) => os.map((o) => o.value));
  if (options.length < 1) throw new Error('picker empty');
  const current = await select.inputValue();
  const next = options.find((o) => o !== current);
  if (!next) return `only one model (${current}); switching skipped`;
  await select.selectOption(next);
  for (let i = 0; ; i++) {
    const got = (await (await fetch(`${API}/api/sessions`)).json()).sessions.find((s) => s.id === sessionId)?.model;
    if (got === next) break;
    if (i > 30) throw new Error(`server has model ${got}, wanted ${next}`);
    await p.waitForTimeout(500);
  }
  await p.keyboard.press('Escape');
  await p.reload();
  await p.waitForSelector('.agent-page');
  await p.getByRole('button', { name: 'Settings' }).click();
  await p.waitForFunction((want) => document.querySelector('select[aria-label=Model]')?.value === want, next, { timeout: 10000 });
  await p.keyboard.press('Escape');
  return `${options.length} models; ${current} -> ${next} survived reload`;
});

await check('reload keeps the open chat', async () => {
  await sidebar().getByRole('treeitem', { name: /^Make a 2-step plan/ }).first().click();
  await p.locator('.conversation [data-aicl=message]').first().waitFor({ timeout: 10000 });
  const title = await p.locator('.agent-thread-header h1').textContent();
  await p.reload();
  await p.locator('.conversation [data-aicl=message]').first().waitFor({ timeout: 15000 });
  const after = await p.locator('.agent-thread-header h1').textContent();
  if (title !== after) throw new Error(`chat changed: ${title} -> ${after}`);
  return `${after}`;
});

await check('Esc stops a running turn', async () => {
  await p.keyboard.press(`${MOD}+n`);
  const input = p.locator('.hero').locator(C.input).first();
  await input.fill('Write a very long essay (at least 1500 words) about the history of otters.');
  await input.press('Enter');
  const convo = p.locator('.conversation');
  await convo.locator(C.stop).first().waitFor({ timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.keyboard.press('Escape');
  await convo.locator(C.done).first().waitFor({ timeout: 20000 });
});

await check('the copilot dock lives on the Canvas tab only', async () => {
  await p.locator('[data-tab="canvas"]').click();
  await p.waitForFunction(() => window.__aiclEditor, null, { timeout: 30000 });
  const dock = p.getByRole('complementary', { name: 'Agent chat' });
  await dock.locator(C.root).first().waitFor({ timeout: 10000 });
  const n = await p.evaluate(() => {
    const e = window.__aiclEditor;
    e.createShape({ type: 'note', x: 40, y: 40 });
    return e.getCurrentPageShapes().length;
  });
  if (n < 1) throw new Error('could not draw');
  await shot('canvas');
  await p.locator('[data-tab="agents"]').click();
  await p.waitForTimeout(500);
  if (await p.locator('.shell-dock[data-open="true"]').count()) throw new Error('dock open on the Agents tab');
});

await check('no page errors', async () => {
  if (errors.length) throw new Error(JSON.stringify(errors.slice(0, 3)));
});

await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
