// Browser checks for ?view=components. Start `npm run dev` first, then `npm run e2e`.
// Uses an installed Playwright Chromium (`npx playwright install chromium`).
import { chromium } from 'playwright-core';

const PAGE = 'http://localhost:5179/?view=components';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(PAGE);

let failed = 0;
const check = async (name, fn) => {
  try {
    const r = await fn();
    if (r === false) throw new Error('returned false');
    console.log(`PASS ${name}${typeof r === 'string' ? ` — ${r}` : ''}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name} — ${e.message.split('\n')[0]}`);
  }
};
const eq = (a, b, what) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
};
const focused = () =>
  page.evaluate(() => {
    const a = document.activeElement;
    return { tag: a.tagName, text: (a.textContent || a.value || '').trim().slice(0, 30), inDialog: !!a.closest('[role=dialog],[role=alertdialog]') };
  });
const btn = (name) => page.getByRole('button', { name, exact: true });

// ── Dialog ──────────────────────────────────────────────────────────────
await check('dialog: Enter opens, focus moves to first field, background inert', async () => {
  await btn('Open dialog').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor();
  const f = await focused();
  eq([f.tag, f.inDialog], ['INPUT', true], 'focus');
  eq(await page.evaluate(() => document.querySelector('#root').hasAttribute('inert')), true, 'root inert');
});
await check('dialog: Tab and Shift+Tab stay trapped', async () => {
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
  eq((await focused()).inDialog, true, 'after 5 tabs');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+Tab');
  eq((await focused()).inDialog, true, 'after 5 shift-tabs');
});
await check('dialog: Escape closes and returns focus to the trigger', async () => {
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  eq((await focused()).text, 'Open dialog', 'focus');
  eq(await page.locator('#overlays .note').textContent(), 'Last dismiss: escape', 'reason');
  eq(await page.evaluate(() => document.querySelector('#root').hasAttribute('inert')), false, 'inert cleared');
});
await check('dialog: scrim click dismisses with reason scrim', async () => {
  await btn('Open dialog').click();
  await page.mouse.click(20, 20);
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  eq(await page.locator('#overlays .note').textContent(), 'Last dismiss: scrim', 'reason');
});

// ── AlertDialog ─────────────────────────────────────────────────────────
await check('alert dialog: initial focus on Cancel, scrim does nothing', async () => {
  await btn('Delete session…').click();
  await page.getByRole('alertdialog').waitFor();
  eq((await focused()).text, 'Cancel', 'focus');
  await page.mouse.click(20, 20);
  eq(await page.getByRole('alertdialog').count(), 1, 'still open');
});
await check('alert dialog: typed confirmation gates Delete; confirm goes loading then closes', async () => {
  const confirm = page.locator('[data-aicl=alert-dialog-confirm]');
  eq(await confirm.isDisabled(), true, 'disabled before typing');
  await page.locator('[data-aicl=alert-dialog-confirmation] input').fill('delet');
  eq(await confirm.isDisabled(), true, 'disabled on partial');
  await page.locator('[data-aicl=alert-dialog-confirmation] input').fill('delete');
  eq(await confirm.isDisabled(), false, 'enabled on match');
  await confirm.click();
  eq(await confirm.getAttribute('aria-busy'), 'true', 'busy');
  eq(await page.locator('[data-aicl=alert-dialog-cancel]').isDisabled(), true, 'cancel locked while confirming');
  await page.getByRole('alertdialog').waitFor({ state: 'detached' });
  eq(await page.locator('#overlays .note').textContent(), 'Last dismiss: confirmed', 'result');
});

// ── Drawer ──────────────────────────────────────────────────────────────
await check('drawer: opens on the right; swipe right dismisses with reason swipe', async () => {
  await btn('Open drawer').click();
  const drawer = page.locator('[data-aicl=drawer]');
  await drawer.waitFor();
  eq(await drawer.getAttribute('data-side'), 'right', 'side');
  const box = await drawer.boundingBox();
  await page.mouse.move(box.x + 40, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 200, { steps: 4 });
  eq(await drawer.getAttribute('data-state'), 'dragging', 'dragging state');
  await page.mouse.move(box.x + box.width * 0.6, box.y + 200, { steps: 4 });
  await page.mouse.up();
  await drawer.waitFor({ state: 'detached' });
  eq(await page.locator('#overlays .note').textContent(), 'Last dismiss: swipe', 'reason');
});

// ── Toasts ──────────────────────────────────────────────────────────────
await check('toasts: polite status, assertive actionable error, hover pauses, action works', async () => {
  await btn('Success toast').click();
  await btn('Error with action').click();
  const region = page.locator('[data-aicl=toast-region]');
  eq(await region.getAttribute('data-count'), '2', 'count');
  eq(await page.locator('[data-aicl=toast][data-variant=success]').getAttribute('role'), 'status', 'success role');
  eq(await page.locator('[data-aicl=toast][data-variant=error]').getAttribute('role'), 'alert', 'error role');
  await page.locator('[data-aicl=toast][data-variant=success]').hover();
  eq(await page.locator('[data-aicl=toast][data-variant=success]').getAttribute('data-state'), 'paused', 'paused');
  await page.getByRole('button', { name: 'Retry', exact: true }).last().click();
  await page.locator('[data-aicl=toast]', { hasText: 'Retrying' }).waitFor();
  await page.mouse.move(10, 10);
});

// ── Select ──────────────────────────────────────────────────────────────
await check('select: keyboard opens on selected, skips disabled, typeahead, Enter commits', async () => {
  const trigger = page.locator('[data-aicl=select-trigger]');
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  eq(await trigger.getAttribute('aria-expanded'), 'true', 'open');
  const active = () => page.locator('[data-aicl=select-listbox] [data-active] [data-aicl=select-option-label]').textContent();
  eq(await active(), 'Sonnet 5.5', 'opens on selected');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  eq(await active(), 'Opus 5.5', 'wraps past disabled Legacy');
  await page.keyboard.press('h');
  eq(await active(), 'Haiku 4.5', 'typeahead');
  await page.keyboard.press('Enter');
  eq(await trigger.textContent(), 'Haiku 4.5', 'committed');
  eq(await trigger.getAttribute('aria-expanded'), 'false', 'closed');
});
await check('select: click outside closes', async () => {
  await page.locator('[data-aicl=select-trigger]').click();
  await page.mouse.click(1000, 50);
  eq(await page.locator('[data-aicl=select-trigger]').getAttribute('aria-expanded'), 'false', 'closed');
});

// ── Switch + Segmented ──────────────────────────────────────────────────
await check('switch: Space toggles; failing toggle rolls back with error state', async () => {
  const sw = page.getByRole('switch', { name: 'Stream reasoning' });
  await sw.focus();
  await page.keyboard.press('Space');
  eq(await sw.getAttribute('aria-checked'), 'false', 'toggled off');
  const flaky = page.getByRole('switch', { name: /Optimistic/ });
  await flaky.click();
  eq(await flaky.getAttribute('aria-checked'), 'true', 'optimistic on');
  await page.waitForTimeout(900);
  eq([await flaky.getAttribute('aria-checked'), await flaky.getAttribute('data-save-state')], ['false', 'error'], 'rolled back');
});
await check('segmented: arrows move and select, one tab stop', async () => {
  const group = page.getByRole('radiogroup', { name: 'Layout' });
  await group.getByRole('radio', { name: 'List' }).focus();
  await page.keyboard.press('ArrowRight');
  eq(await group.getByRole('radio', { checked: true }).textContent(), 'Grid', 'selected');
  eq((await focused()).text, 'Grid', 'focus followed');
  await page.keyboard.press('End');
  eq(await group.getByRole('radio', { checked: true }).textContent(), 'Board', 'End');
  eq(await group.locator('[tabindex="0"]').count(), 1, 'one tab stop');
});

// ── Sessions ────────────────────────────────────────────────────────────
await check('session list: keyboard moves active row, Enter selects, new session prepends', async () => {
  const list = page.locator('#session-list [role=listbox]').first();
  await list.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const active = await page.locator('#session-list [data-aicl=session-item][data-active] [data-aicl=session-title]').first().textContent();
  eq(active, 'Draft the Q4 roadmap', 'active');
  await page.keyboard.press('Enter');
  eq(await page.locator('#session-list .note').textContent(), 'Selected: s2', 'selected');
  await btn('+ New session').click();
  eq(await page.locator('#session-list [data-aicl=session-title]').first().textContent(), 'New session', 'prepended');
});
await check('session list: hover reveals row actions; action fires without selecting', async () => {
  const row = page.locator('#session-list [data-aicl=session-item]').nth(2);
  await row.hover();
  await page.waitForTimeout(300);
  eq(await row.locator('[data-aicl=session-actions]').evaluate((e) => getComputedStyle(e).opacity), '1', 'revealed');
  await row.getByRole('button', { name: /^Archive/ }).click();
  const note = await page.locator('#session-list .note').textContent();
  if (!note.startsWith('Selected: Archive →')) throw new Error(note);
  return note;
});
await check('session search: filters, arrows + Enter open, count announced', async () => {
  const input = page.getByRole('combobox', { name: 'Search sessions' });
  await input.fill('build');
  eq(await page.locator('[data-aicl=session-search-status]').textContent(), '1 result', 'announce');
  await page.keyboard.press('Enter');
  eq(await page.locator('#session-search .note').textContent(), 'Opened: Why is the build slow?', 'opened');
  await input.fill('zzz');
  eq(await page.locator('[data-aicl=session-search-empty]').count(), 1, 'empty state');
});
await check('sidebar nav: collapse keeps accessible names; navigate sets aria-current', async () => {
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await nav.getByRole('button', { name: 'Collapse sidebar' }).click();
  eq(await nav.getAttribute('data-state'), 'collapsed', 'collapsed');
  await nav.getByRole('button', { name: 'Library' }).click();
  eq(await nav.getByRole('button', { name: 'Library' }).getAttribute('aria-current'), 'page', 'current');
});

// ── Composer surface ────────────────────────────────────────────────────
await check('slash menu: filter, Enter inserts, Escape keeps text', async () => {
  const field = page.locator('#trigger-menus textarea');
  await field.click();
  await page.keyboard.type('/ex');
  eq(await page.locator('[data-trigger="/"]').getAttribute('data-state'), 'open', 'open');
  await page.keyboard.press('Enter');
  eq(await field.inputValue(), 'explain ', 'inserted');
  await page.keyboard.type('/');
  await page.keyboard.press('Escape');
  eq([await field.inputValue(), await page.locator('[data-trigger="/"]').getAttribute('data-state')], ['explain /', 'closed'], 'escape');
});
await check('mention menu: Tab inserts @label with a structured range', async () => {
  const field = page.locator('#trigger-menus textarea');
  await field.fill('');
  await page.keyboard.type('ping @al');
  await page.keyboard.press('Tab');
  eq(await field.inputValue(), 'ping @alexey ', 'inserted');
  const log = await page.locator('[data-testid=menu-log]').textContent();
  if (!log.includes('"range":[5,12]')) throw new Error(log);
});
await check('dropzone: picker accepts image, rejects wrong type', async () => {
  const input = page.locator('#dropzone input[type=file]');
  await input.setInputFiles({ name: 'diagram.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71]) });
  eq(await page.locator('#dropzone [data-aicl=attachment-chip]').count(), 1, 'chip added');
  await input.setInputFiles({ name: 'bad.exe', mimeType: 'application/octet-stream', buffer: Buffer.from([0]) });
  eq(await page.locator('#dropzone [data-aicl=attachment-dropzone]').getAttribute('data-reject'), 'type', 'rejected');
  await page.locator('#dropzone [data-aicl=attachment-remove]').click();
  eq(await page.locator('#dropzone [data-aicl=attachment-chip]').count(), 0, 'removed');
});

await check('no page errors', async () => {
  eq(errors, [], 'errors');
});

await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
