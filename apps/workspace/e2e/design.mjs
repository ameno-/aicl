// Design-canvas integration against a live `npm run dev` (:5181) and a real model.
// CLEARS the canvas of the workspace the server points at: use a throwaway
// AICL_WORKSPACE and run `node e2e/design.mjs --clears-canvas`.
import { chromium } from 'playwright-core';

// Targets the dev servers on 5180/5181; E2E_API / E2E_WEB point it at another instance.
const API = process.env.E2E_API ?? 'http://127.0.0.1:5180';
const WEB = process.env.E2E_WEB ?? 'http://localhost:5181';

if (!process.argv.includes('--clears-canvas')) {
  console.error('Refusing to run: this test clears the canvas. Use a throwaway AICL_WORKSPACE and pass --clears-canvas.');
  process.exit(2);
}

const SHOTS = process.argv.find((a) => a.startsWith('--shots='))?.slice(8);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1680, height: 1050 } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: WEB });
const p = await ctx.newPage();
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
const shot = async (name) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png` });
const dock = p.getByRole('complementary', { name: 'Agent chat' });
const screens = () =>
  p.evaluate(() =>
    window.__aiclEditor
      .getCurrentPageShapes()
      .filter((s) => s.type === 'aicl-component' && s.props.component === 'screen')
      .map((s) => ({ id: s.id, spec: s.props.props })),
  );
const fit = () => p.evaluate(() => { window.__aiclEditor.zoomToFit({ animation: { duration: 0 } }); });
async function ask(text) {
  await dock.locator('[data-aicl=composer-input]').fill(text);
  await p.keyboard.press('Enter');
  await dock.locator('[data-aicl=composer-submit][data-role=stop]').waitFor({ timeout: 20000 });
  await dock.locator('[data-aicl=composer][data-state=ready], [data-aicl=composer][data-state=error]').waitFor({ timeout: 420000 });
  const state = await dock.locator('[data-aicl=composer]').getAttribute('data-state');
  if (state !== 'ready') throw new Error(`agent ended in ${state}: ${(await p.locator('[data-aicl=toast]').allTextContents()).join(' ')}`);
  const steps = await dock.locator('[data-aicl=tool-call]').allTextContents();
  return steps;
}

await p.goto(`${WEB}/`);
await p.waitForTimeout(3000);
await p.reload();
await p.waitForFunction(() => window.__aiclEditor, null, { timeout: 30000 });
await p.evaluate(() => { const ed = window.__aiclEditor; ed.deleteShapes([...ed.getCurrentPageShapeIds()]); });
await p.waitForTimeout(500);

await check('insert a screen from the menu: the sample renders with no unknown elements', async () => {
  await p.getByRole('button', { name: /Components/ }).click();
  await p.locator('.insert-menu').getByRole('menuitem', { name: /^Screen/ }).click();
  await p.waitForTimeout(800);
  await fit();
  const unknown = await p.locator('.aicl-screen').getByText(/Unknown element/).count();
  if (unknown) throw new Error(`${unknown} unknown`);
  const types = await p.locator('.aicl-screen [data-ui-type]').evaluateAll((els) => [...new Set(els.map((e) => e.dataset.uiType))].length);
  await shot('1-sample');
  return `${types} element types rendered`;
});

await check('toolbar: preset, dark mode, frame persist into the spec', async () => {
  const bar = p.locator('.aicl-screen').first();
  const selects = bar.locator('select');
  const n = await selects.count();
  for (let i = 0; i < n; i++) {
    const opts = await selects.nth(i).locator('option').allTextContents();
    if (opts.some((o) => /Lovable/i.test(o))) await selects.nth(i).selectOption({ label: opts.find((o) => /Lovable/i.test(o)) });
  }
  await p.waitForTimeout(300);
  const [s] = await screens();
  if (s.spec.theme.preset !== 'lovable') throw new Error(`preset ${s.spec.theme.preset}`);
  // back to default for the next checks
  for (let i = 0; i < n; i++) {
    const opts = await selects.nth(i).locator('option').allTextContents();
    if (opts.some((o) => /AICL/.test(o))) await selects.nth(i).selectOption({ label: opts.find((o) => /AICL/.test(o)) });
  }
  return 'lovable applied and reverted';
});

await check('agent creates a new mobile screen from a brief', async () => {
  const steps = await ask(
    'Create a new mobile chat screen for a travel assistant called "Trip planner": a header, one user message asking for a 3-day Lisbon itinerary, an assistant reply with a short plan (3 steps), suggestion chips, and a composer. Use the manus preset. Place it to the right of the existing screen.',
  );
  const all = await screens();
  const trip = all.find((s) => /trip/i.test(s.spec.name));
  if (!trip) throw new Error(`no Trip screen; steps ${JSON.stringify(steps)}`);
  if (trip.spec.frame !== 'mobile' || trip.spec.theme.preset !== 'manus') throw new Error(`frame ${trip.spec.frame} preset ${trip.spec.theme.preset}`);
  await fit();
  await p.waitForTimeout(500);
  await shot('2-trip');
  return `steps: ${steps.join(' | ')}`;
});

await check('select an element in a screen, then "make this…" edits exactly that element', async () => {
  const [sample] = (await screens()).filter((s) => !/trip/i.test(s.spec.name));
  await p.evaluate((id) => { const ed = window.__aiclEditor; ed.select(id); ed.zoomToSelection({ animation: { duration: 0 } }); ed.selectNone(); }, sample.id);
  await p.waitForTimeout(400);
  const composer = p.locator(`.aicl-screen [data-ui-id="composer"]`).first();
  await composer.click();
  await dock.getByText(/Editing/).waitFor({ timeout: 5000 });
  const steps = await ask('Make this a hero-style composer with suggestion chips "Write tests" and "Explain the fix".');
  const after = (await screens()).find((s) => s.id === sample.id);
  const find = (n, id) => (n.id === id ? n : (n.children ?? []).map((c) => find(c, id)).find(Boolean));
  const c = find(after.spec.root, 'composer');
  const props = c?.props ?? {};
  const ok = props.variant === 'hero' || (Array.isArray(props.chips) && props.chips.length >= 2);
  if (!ok) throw new Error(`composer props ${JSON.stringify(props)}; steps ${steps.join(' | ')}`);
  await shot('3-selected-edit');
  return `composer ${JSON.stringify(props)}`;
});

await check('restyle a screen by name', async () => {
  const steps = await ask('Restyle the "Agent thread" screen in dark mode with a violet accent (#7c3aed) and rounder corners.');
  const s = (await screens()).find((x) => x.spec.name === 'Agent thread');
  const o = s?.spec.theme.overrides ?? {};
  if (o.mode !== 'dark' || !/7c3aed/i.test(String(o.accent))) throw new Error(`theme ${JSON.stringify(s?.spec.theme)}; steps ${steps.join(' | ')}`);
  await fit();
  await p.waitForTimeout(500);
  await shot('4-restyled');
  return JSON.stringify(s.spec.theme);
});

await check('reference screenshot → recreated as an editable screen', async () => {
  const before = (await screens()).length;
  const steps = await ask(
    'Find a Devin chat screen with a session list in the references, place it on the canvas, look at just that image, and recreate it as an editable desktop screen named "Devin recreation" next to it using the devin preset.',
  );
  const images = await p.evaluate(() => window.__aiclEditor.getCurrentPageShapes().filter((s) => s.type === 'image').length);
  const rec = (await screens()).find((s) => /devin/i.test(s.spec.name));
  if (!images || !rec || (await screens()).length <= before) throw new Error(`images ${images}, recreation ${!!rec}; steps ${steps.join(' | ')}`);
  const count = (n) => 1 + (n.children ?? []).reduce((a, c) => a + count(c), 0);
  await fit();
  await p.waitForTimeout(800);
  await shot('5-reference');
  return `image + screen with ${count(rec.spec.root)} nodes, preset ${rec.spec.theme.preset}`;
});

await check('copy code from a screen toolbar yields a React module using @aicl/react', async () => {
  const [s] = await screens();
  await p.evaluate((id) => { const ed = window.__aiclEditor; ed.select(id); ed.zoomToSelection({ animation: { duration: 0 } }); ed.selectNone(); }, s.id);
  await p.waitForTimeout(300);
  // Target this screen's own card: other screens may be culled off-screen.
  await p.locator(`[data-shape-id="${s.id}"] .aicl-screen`).getByRole('button', { name: /Copy code/i }).click();
  const code = await p.evaluate(() => navigator.clipboard.readText());
  if (!/from '@aicl\/react'/.test(code) || !/export default function/.test(code)) throw new Error(code.slice(0, 120));
  return `${code.split('\n').length} lines`;
});

await check('everything persists across reload', async () => {
  const before = (await screens()).map((s) => s.spec.name).sort();
  await p.reload();
  await p.waitForFunction(() => window.__aiclEditor, null, { timeout: 30000 });
  await p.waitForTimeout(1500);
  const after = (await screens()).map((s) => s.spec.name).sort();
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`${before} -> ${after}`);
  return after.join(', ');
});

await check('no page errors', async () => {
  if (errors.length) throw new Error(JSON.stringify(errors.slice(0, 3)));
});

await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
