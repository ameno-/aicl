// Browser checks for the composed workspace at /. Start `npm run dev` first.
import { chromium } from 'playwright-core';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://localhost:5179/');

let failed = 0;
const check = async (name, fn) => {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name} — ${e.message.split('\n')[0]}`);
  }
};
const eq = (a, b, what) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
};

await check('history renders: user bubble right, plan with rollup', async () => {
  const user = page.locator('[data-aicl=message][data-role=user]').first();
  const column = page.locator('[data-aicl=message-row]').first();
  const [u, c] = [await user.boundingBox(), await column.boundingBox()];
  eq(Math.round(u.x + u.width), Math.round(c.x + c.width), 'bubble flush right');
  eq(await page.locator('[data-aicl=plan-checklist]').getAttribute('data-progress'), '2/4', 'plan');
});
await check('a turn streams: submitted → streaming (stop shown) → idle with an artifact', async () => {
  await page.locator('[data-aicl=composer-input]').fill('the double submit bug');
  await page.keyboard.press('Enter');
  await page.locator('[data-aicl=composer-submit][data-role=stop]').waitFor();
  await page.locator('[data-aicl=tool-call][data-status=running]').first().waitFor();
  await page.locator('[data-aicl=composer-submit][data-role=send]').waitFor({ timeout: 20000 });
  eq(await page.locator('[data-aicl=transcript]').getAttribute('data-status'), 'idle', 'status');
  eq(await page.locator('[data-aicl=artifact-card]').count(), 1, 'artifact');
});
await check('artifact Open shows the work pane; tabs switch; close hides it', async () => {
  await page.getByRole('button', { name: /Open diff artifact/ }).click();
  const pane = page.getByRole('complementary', { name: 'Work pane' });
  await pane.waitFor();
  await pane.getByRole('radio', { name: 'Terminal' }).click();
  await pane.locator('[data-aicl=terminal-output]').waitFor();
  await pane.getByRole('button', { name: 'Close pane' }).click();
  eq(await pane.count(), 0, 'closed');
});
await check('stop mid-turn keeps partial output', async () => {
  await page.locator('[data-aicl=composer-input]').fill('again');
  await page.keyboard.press('Enter');
  await page.locator('[data-aicl=tool-call][data-status=running]').last().waitFor();
  await page.locator('[data-aicl=composer-submit][data-role=stop]').click();
  eq(await page.locator('[data-aicl=transcript]').getAttribute('data-status'), 'aborted', 'status');
  eq(await page.locator('[data-aicl=status-line]').last().textContent(), 'Stopped working', 'status line');
});
await check('model switch toasts; settings dialog switches theme to dark', async () => {
  await page.getByRole('combobox', { name: 'Model' }).click();
  await page.getByRole('option', { name: 'Haiku 4.5' }).click();
  await page.locator('[data-aicl=toast]', { hasText: 'Model switched' }).waitFor();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('dialog').getByRole('radio', { name: 'Dark' }).click();
  eq(await page.evaluate(() => document.documentElement.dataset.theme), 'dark', 'theme');
  eq(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(22, 22, 22)', 'dark bg applied');
  await page.keyboard.press('Escape');
});
await check('session delete goes through the alert dialog', async () => {
  const row = page.locator('[data-aicl=session-item]', { hasText: 'Migrate to tldraw 5' });
  await row.hover();
  await row.getByRole('button', { name: /^Delete/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await page.locator('[data-aicl=toast]', { hasText: 'Session deleted' }).waitFor();
  eq(await page.locator('[data-aicl=session-item]', { hasText: 'Migrate to tldraw 5' }).count(), 0, 'removed');
});
await check('no page errors', async () => eq(errors, [], 'errors'));

await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
