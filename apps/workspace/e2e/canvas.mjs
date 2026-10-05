// Integration: insert every component, use the canvas chat, let the agent place components, reload.
//
// Runs against a live `npm run dev` on :5181 with a real model, and CLEARS the
// canvas of the workspace that server points at. Point AICL_WORKSPACE at a
// throwaway folder, then: `npm run e2e -- --clears-canvas`.
import { chromium } from 'playwright-core';

if (!process.argv.includes('--clears-canvas')) {
  console.error('Refusing to run: this test clears the canvas. Use a throwaway AICL_WORKSPACE and pass --clears-canvas.');
  process.exit(2);
}

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
const t0 = Date.now();
p.on('framenavigated', (f) => f === p.mainFrame() && console.log(`  [nav ${((Date.now() - t0) / 1000).toFixed(1)}s] ${f.url()}`));
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
const cards = () => p.locator('.aicl-card');

await p.goto('http://localhost:5181/');
await p.waitForTimeout(3000); // let Vite finish any dependency re-optimisation reload
await p.reload();
await p.waitForFunction(() => window.__aiclEditor, null, { timeout: 30000 });
await p.waitForTimeout(800);
await p.evaluate(() => {
  const ed = window.__aiclEditor;
  ed.deleteShapes([...ed.getCurrentPageShapeIds()]);
});
await p.waitForTimeout(600);

const NAMES = ['Chat', 'Plan', 'Code', 'Terminal', 'Artifact', 'Conversation', 'Table', 'Metric'];
await check('insert menu places all 8 components', async () => {
  for (const name of NAMES) {
    await p.getByRole('button', { name: /Components/ }).click();
    await p.locator('.insert-menu').getByRole('menuitem', { name: new RegExp(`^${name}`) }).first().click();
    await p.waitForTimeout(250);
    // Spread them out: move the newest shape off-centre.
    await p.evaluate((i) => {
      const ed = window.__aiclEditor;
      if (!ed) return;
      const ids = [...ed.getSelectedShapeIds()];
      ed.updateShapes(ids.map((id) => ({ id, type: 'aicl-component', x: (i % 4) * 500, y: Math.floor(i / 4) * 560 })));
    }, NAMES.indexOf(name));
  }
  await p.evaluate(() => { window.__aiclEditor?.zoomToFit(); });
  await p.waitForTimeout(500);
  const n = await cards().count();
  if (n !== 8) throw new Error(`cards: ${n}`);
  const unknown = await p.locator('.aicl-card__notice').count();
  if (unknown) throw new Error(`${unknown} unknown`);
  });

await check('canvas chat window talks to the agent; dock shows the same thread', async () => {
  // tldraw culls off-screen shapes: bring the chat window into view first.
  await p.evaluate(() => {
    const ed = window.__aiclEditor;
    const chat = ed.getCurrentPageShapes().find((s) => s.type === 'aicl-component' && s.props.component === 'chat');
    ed.select(chat.id);
    ed.zoomToSelection({ animation: { duration: 0 } });
    ed.selectNone();
  });
  await p.waitForTimeout(400);
  const chatCard = cards().filter({ has: p.locator('[data-aicl=composer]') }).first();
  const field = chatCard.locator('[data-aicl=composer-input]');
  await field.click();
  await field.fill('Reply with exactly: pong');
  await p.keyboard.press('Enter');
  const dock = p.getByRole('complementary', { name: 'Agent chat' });
  await dock.locator('[data-aicl=message][data-role=user]', { hasText: 'Reply with exactly: pong' }).waitFor({ timeout: 10000 });
  await dock.locator('[data-aicl=composer][data-state=ready]').waitFor({ timeout: 180000 });
  const reply = await chatCard.locator('[data-aicl=message][data-role=assistant] [data-part=text]').last().textContent();
  if (!/pong/i.test(reply ?? '')) throw new Error(`reply: ${reply}`);
  return `canvas reply "${reply?.trim()}"`;
});

await check('agent places components on the canvas', async () => {
  const dock = p.getByRole('complementary', { name: 'Agent chat' });
  await dock.locator('[data-aicl=composer-input]').fill(
    'Below everything on the canvas, place a plan component for launching a beta (4 steps, first two done), a metric component for "Beta signups" = 128 trending up, and a table comparing 3 pricing tiers. Connect the plan to the table with an arrow.',
  );
  await p.keyboard.press('Enter');
  await dock.locator('[data-aicl=composer-submit][data-role=stop]').waitFor({ timeout: 15000 });
  await dock.locator('[data-aicl=composer][data-state=ready], [data-aicl=composer][data-state=error]').waitFor({ timeout: 300000 });
  const state = await dock.locator('[data-aicl=composer]').getAttribute('data-state');
  const steps = await dock.locator('[data-aicl=tool-call]').allTextContents();
  const n = await cards().count();
  await p.evaluate(() => { window.__aiclEditor?.zoomToFit(); });
  await p.waitForTimeout(600);
  if (state !== 'ready') throw new Error(`composer ${state}`);
  if (n < 11) throw new Error(`cards ${n}, steps ${JSON.stringify(steps)}`);
  return `${n} cards; steps: ${steps.slice(-4).join(' | ')}`;
});

await check('components and arrows persist across reload', async () => {
  const before = await cards().count();
  await p.reload();
  await p.waitForTimeout(2000);
  const after = await cards().count();
  if (after !== before) throw new Error(`${before} -> ${after}`);
  const arrows = await p.evaluate(() => window.__aiclEditor?.getCurrentPageShapes().filter((s) => s.type === 'arrow').length);
  return `${after} cards, ${arrows} arrows`;
});

await check('no page errors', async () => {
  if (errors.length) throw new Error(JSON.stringify(errors.slice(0, 3)));
});

await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
