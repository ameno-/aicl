// Browser checks for ?view=canvas. Start `npm run dev` first.
import { chromium } from 'playwright-core';

const PAGE = 'http://127.0.0.1:5179/?view=canvas';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

let failed = 0;
const check = async (name, fn) => {
  try {
    const result = await fn();
    if (result === false) throw new Error('returned false');
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.log(`FAIL ${name} — ${error.message.split('\n')[0]}`);
  }
};

await page.goto(PAGE);
await page.getByRole('heading', { name: 'Canvas' }).waitFor();

const frame = page.locator('.canvas-frame');

await check('starter frame places the alert, the plan, the card, the tabs, and the empty state', async () => {
  await frame.getByText('Needs you').waitFor();
  await frame.getByText('Ship the frame').waitFor();
  await frame.getByText('Three steps, one of them done.').waitFor();
  await frame.getByRole('tab', { name: 'Files' }).waitFor();
  await frame.getByText('No sessions yet').waitFor();
  const code = await page.locator('.canvas-code code').innerText();
  if (!code.includes('Alert') || !code.includes('PlanChecklist') || !code.includes('Empty')) {
    throw new Error('jsx missing a starter primitive');
  }
});

await check('a prompt places what it names and refuses the rest', async () => {
  await page.locator('#canvas-prompt').fill('warning alert and a tooltip, plus a popover');
  await page.getByRole('button', { name: 'Place on the frame' }).click();
  await frame.getByText('Needs you').waitFor();
  await frame.locator('[data-canvas-input="tooltip"]').waitFor();
  await page.getByText('Not an input yet: Popover.').waitFor();
  const inputs = await page.locator('[data-canvas-input]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-canvas-input')));
  if (inputs.join(',') !== 'alert,tooltip') throw new Error(`inputs ${inputs.join(',')}`);
});

await check('the palette adds a primitive and the jsx names it', async () => {
  await page.getByRole('button', { name: 'Badges' }).click();
  await page.locator('[data-canvas-input="badges"]').waitFor();
  const code = await page.locator('.canvas-code code').innerText();
  if (!code.includes('Badge')) throw new Error('jsx missing Badge');
});

await check('clearing the prompt empties the frame', async () => {
  await page.locator('#canvas-prompt').fill('');
  await page.getByRole('button', { name: 'Place on the frame' }).click();
  if ((await page.locator('[data-canvas-input]').count()) !== 0) throw new Error('frame still has inputs');
  await page.getByText('The frame is empty.').waitFor();
});

await check('no page errors', async () => {
  if (errors.length) throw new Error(errors.join(' | '));
});

await browser.close();
if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nALL PASSED');
