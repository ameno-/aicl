// The application (AICL-34) against a live `npm run dev` (E2E_API / E2E_WEB) and a real model.
// For EACH provider kit: switch via the command menu, start a session from the hero, ask for a plan +
// a bash call, approve it, watch the kit's work panel show it live, get the reply. Then the model
// picker, persistence across reload, shortcuts, session management, and theme.
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

const KITS = [
  { id: 'aicl', label: 'AICL', session: 'New chat', hero: 'What should we build?', panel: 'tabs' },
  { id: 'devin', label: 'Devin-like', session: 'New session', hero: 'What do you want to get done?', panel: 'tabs' },
  { id: 'manus', label: 'Manus-like', session: 'New task', hero: 'What can I do for you?', panel: 'computer' },
  { id: 'lovable', label: 'Lovable-like', session: 'New project', hero: 'Build something lovable', panel: 'preview' },
  { id: 'cofounder', label: 'Cofounder-like', session: 'New task', hero: 'What should we work on today?', panel: 'board' },
];
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
// The composer is the kit's (web/kits): its root carries data-aicl=composer; the fx PromptComposer stub uses data-fx-*.
const C = {
  root: '[data-aicl=composer], [data-fx-component=prompt-composer]',
  input: '[data-aicl=composer-input], [data-fx-component=prompt-composer] textarea',
  stop: '[data-aicl=composer-submit][data-role=stop], [data-fx-part=stop]',
  ready: '[data-aicl=composer][data-state=ready], [data-fx-component=prompt-composer][data-status=ready]',
  done: '[data-aicl=composer][data-state=ready], [data-aicl=composer][data-state=error], [data-fx-component=prompt-composer][data-status=ready], [data-fx-component=prompt-composer][data-status=error]',
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
const kitRoot = (id) => p.locator(`[data-kit="${id}"].app-root`);

await p.goto(`${WEB}/#/agent`);
await p.waitForSelector('.agent-page', { timeout: 30000 });

for (const kit of KITS) {
  await check(`${kit.id}: switch kit via ⌘K`, async () => {
    await palette(`Switch kit: ${kit.label}`);
    await kitRoot(kit.id).waitFor({ timeout: 5000 });
    const nav = await p.locator('.shell-topbar').getAttribute('data-nav');
    const sidebar = await p.locator('.agent-sidebar').count();
    const wantTop = kit.id === 'cofounder';
    if ((nav === 'topbar') !== wantTop) throw new Error(`nav is ${nav}`);
    if (Boolean(sidebar) === wantTop) throw new Error(`sidebar present=${sidebar}`);
    return `nav ${nav}`;
  });

  await check(`${kit.id}: new session from the hero`, async () => {
    await palette(kit.session);
    const hero = p.locator('.hero');
    await hero.waitFor({ timeout: 10000 });
    const title = (await hero.locator('.hero-title').textContent())?.trim();
    if (title !== kit.hero) throw new Error(`hero title "${title}"`);
    await hero.locator(C.root).first().waitFor();
    await hero.locator('.hero-starters').waitFor();
    // Labels follow the kit vocabulary.
    if (kit.id !== 'cofounder') {
      const label = await p.locator('.agent-sidebar').getAttribute('aria-label');
      if (label !== { aicl: 'Chats', devin: 'Sessions', manus: 'Tasks', lovable: 'Projects' }[kit.id]) throw new Error(`sidebar label ${label}`);
    }
    await p.waitForTimeout(1800); // let the ambience settle for the screenshot
    await shot(`${kit.id}-1-hero`);
    return title;
  });

  await check(`${kit.id}: ask, approve bash, work panel (${kit.panel}) live, reply`, async () => {
    const input = p.locator('.hero').locator(C.input).first();
    await input.fill(PROMPT);
    await input.press('Enter');
    const convo = p.locator('.conversation');
    await convo.locator('[data-aicl=message][data-role=user]').waitFor({ timeout: 15000 });

    // The panel opens by itself, as this kit's type.
    const panel = p.locator('aside[aria-label="Work panel"]');
    await panel.waitFor({ timeout: 60000 });
    if ((await panel.getAttribute('data-panel')) !== kit.panel) throw new Error(`panel type ${await panel.getAttribute('data-panel')}`);

    // The approval card (bash is gated); approve it.
    const approval = convo.locator('[data-hitl=approval]').last();
    await approval.waitFor({ timeout: 120000 });
    await shot(`${kit.id}-2-approval`);
    await approval.getByRole('button', { name: 'Approve' }).click();

    // Live: the terminal output shows up in the panel.
    if (kit.panel === 'tabs' || kit.panel === 'preview') {
      await panel.getByRole('tab', { name: 'Terminal' }).waitFor({ timeout: 5000 });
      await panel.getByRole('tab', { name: 'Terminal' }).click();
      await panel.locator('[data-pane=terminal]').getByText('hello', { exact: false }).first().waitFor({ timeout: 60000 });
    } else if (kit.panel === 'computer') {
      await panel.locator('.wp-computer').waitFor({ timeout: 10000 });
      if (!/computer/.test((await panel.locator('.wp-title').textContent()) ?? '')) throw new Error('title is not "<agent>\'s computer"');
    } else if (kit.panel === 'board') {
      await panel.locator('[data-pane=board], .wp-timeline').first().waitFor({ timeout: 60000 });
    }
    await p.waitForTimeout(600);
    await shot(`${kit.id}-3-working`);

    // The reply arrives.
    await convo.locator(C.ready).first().waitFor({ timeout: 300000 });
    const reply = await convo.locator('[data-aicl=message][data-role=assistant]').last().innerText();
    if (!/done/i.test(reply)) throw new Error(`reply was: ${reply.slice(0, 120)}`);

    // After the run, the panel kept the evidence.
    if (kit.panel === 'tabs') {
      await panel.getByRole('tab', { name: 'Plan' }).click();
      await panel.locator('[data-fx-component=AnimatedPlan]').waitFor({ timeout: 10000 });
      const done = await panel.locator('[data-fx-component=AnimatedPlan]').getAttribute('data-total');
      if (!Number(done)) throw new Error('empty plan');
      await panel.getByRole('tab', { name: 'Files' }).click();
      await panel.locator('[data-entry="notes.md"]').waitFor({ timeout: 10000 });
      await panel.locator('[data-entry="notes.md"]').click();
      await panel.locator('[data-pane=file-content]').getByText('ship the app').waitFor({ timeout: 10000 });
    } else if (kit.panel === 'computer') {
      // Scrub back to the bash step: its terminal output is there.
      const range = panel.getByRole('slider', { name: 'Step' });
      await range.focus();
      await p.keyboard.press('Home');
      let seen = false;
      for (let i = 0; i < 8 && !seen; i++) {
        seen = (await panel.locator('[data-pane=terminal]').count()) > 0 && /hello/.test(await panel.locator('[data-pane=terminal]').innerText());
        if (!seen) await p.keyboard.press('ArrowRight');
      }
      if (!seen) throw new Error('the scrubber never showed the bash step');
      await panel.getByRole('button', { name: /live/i }).click();
    } else if (kit.panel === 'board') {
      await panel.locator('[data-pane=board] [data-column=done] .wp-card').first().waitFor({ timeout: 10000 });
      if (!(await panel.locator('.wp-timeline li', { hasText: 'bash' }).count())) throw new Error('timeline lacks the bash action');
    }
    await shot(`${kit.id}-4-done`);
    return `panel ${kit.panel}`;
  });
}

await check('⌘N starts a session; the sidebar list manages it (search, rename, delete)', async () => {
  await palette('Switch kit: AICL');
  const before = await p.locator('.s-row').count();
  await p.keyboard.press(`${MOD}+n`);
  await p.locator('.hero').waitFor({ timeout: 10000 });
  await p.waitForFunction((n) => document.querySelectorAll('.s-row').length > n, before, { timeout: 10000 });
  const row = p.locator('.s-row[data-active]');
  await row.hover();
  await row.getByRole('button', { name: /^Rename/ }).click();
  const rename = p.getByRole('textbox', { name: 'Rename chat' });
  await rename.fill('Otter research');
  await rename.press('Enter');
  await p.locator('.s-row', { hasText: 'Otter research' }).waitFor({ timeout: 5000 });
  await p.getByRole('searchbox', { name: 'Search chats' }).fill('otter');
  if ((await p.locator('.s-row').count()) !== 1) throw new Error('search did not filter');
  await p.getByRole('searchbox', { name: 'Search chats' }).fill('');
  const target = p.locator('.s-row', { hasText: 'Otter research' });
  await target.hover();
  await target.getByRole('button', { name: /^Delete/ }).click();
  await p.getByRole('alertdialog').getByRole('button', { name: /delete/i }).click();
  await p.locator('.s-row', { hasText: 'Otter research' }).waitFor({ state: 'detached', timeout: 5000 });
});

await check('⌘/ shows shortcuts; settings dialog switches kit and appearance', async () => {
  await p.keyboard.press(`${MOD}+/`);
  await p.getByRole('dialog', { name: 'Keyboard shortcuts' }).waitFor({ timeout: 5000 });
  await p.keyboard.press('Escape');
  await p.getByRole('dialog', { name: 'Keyboard shortcuts' }).waitFor({ state: 'detached', timeout: 5000 });
  await p.getByRole('button', { name: 'Settings' }).click();
  const dlg = p.getByRole('dialog', { name: 'Settings' });
  await dlg.waitFor({ timeout: 5000 });
  await dlg.getByRole('radio', { name: /Devin-like/ }).click();
  await kitRoot('devin').waitFor({ timeout: 5000 });
  await dlg.getByRole('radio', { name: 'Dark' }).click();
  await p.waitForFunction(() => document.querySelector('.app-root')?.getAttribute('data-theme') === 'dark', null, { timeout: 5000 });
  await shot('settings-dark');
  await dlg.getByRole('radio', { name: 'Kit default' }).click();
  await p.keyboard.press('Escape');
});

await check('model picker lists models; the switch persists across reload', async () => {
  const { models } = await (await fetch(`${API}/api/models`)).json();
  if (!models.length) throw new Error('no models');
  await palette('Switch kit: AICL');
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
  const again = p.getByRole('dialog', { name: 'Settings' }).getByRole('combobox', { name: 'Model' });
  await p.waitForFunction((want) => document.querySelector('select[aria-label=Model]')?.value === want, next, { timeout: 10000 });
  await p.keyboard.press('Escape');
  return `${options.length} models; ${current} -> ${next} survived reload`;
});

await check('reload keeps kit and session', async () => {
  await palette('Switch kit: Manus-like');
  const first = p.locator('.s-row').filter({ hasText: 'Make a 2-step plan' }).first();
  await first.locator('.s-open').click();
  await p.locator('.conversation [data-aicl=message]').first().waitFor({ timeout: 10000 });
  const title = await p.locator('.agent-thread-header h1').textContent();
  await p.reload();
  await kitRoot('manus').waitFor({ timeout: 10000 });
  await p.locator('.conversation [data-aicl=message]').first().waitFor({ timeout: 15000 });
  const after = await p.locator('.agent-thread-header h1').textContent();
  if (title !== after) throw new Error(`session changed: ${title} -> ${after}`);
  return `${after}`;
});

await check('Esc stops a running turn', async () => {
  await palette('Switch kit: AICL');
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

await check('canvas tab stays usable under a kit; the dock renders through the kit', async () => {
  await palette('Switch kit: Devin-like');
  await p.locator('[data-tab="canvas"]').click();
  await p.waitForFunction(() => window.__aiclEditor, null, { timeout: 30000 });
  const dock = p.getByRole('complementary', { name: 'Agent chat' });
  await dock.locator(C.root).first().waitFor({ timeout: 10000 });
  if (!(await dock.getByRole('button', { name: 'New session' }).count())) throw new Error('dock "New" button lacks the kit vocabulary');
  const n = await p.evaluate(() => {
    const e = window.__aiclEditor;
    e.createShape({ type: 'note', x: 40, y: 40 });
    return e.getCurrentPageShapes().length;
  });
  if (n < 1) throw new Error('could not draw');
  await shot('canvas-under-kit');
});

await check('no page errors', async () => {
  if (errors.length) throw new Error(JSON.stringify(errors.slice(0, 3)));
});

await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
