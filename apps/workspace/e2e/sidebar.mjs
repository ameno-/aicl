// AICL-46 chats sidebar: a tree of folders, pinned and archived chats, with a context menu,
// inline rename, new folders, search, and the Live / Connected resources below it.
// Runs against a live `npm run dev` (E2E_API / E2E_WEB); it creates and reorganises chats,
// so use a throwaway AICL_WORKSPACE and pass --scratch-workspace. No model calls.
import { chromium } from 'playwright-core';

const API = process.env.E2E_API ?? 'http://127.0.0.1:5180';
const WEB = process.env.E2E_WEB ?? 'http://localhost:5181';
if (!process.argv.includes('--scratch-workspace')) {
  console.error('Refusing to run: this test reorganises chats. Use a throwaway AICL_WORKSPACE and pass --scratch-workspace.');
  process.exit(2);
}
const SHOTS = process.argv.find((a) => a.startsWith('--shots='))?.slice(8);

const b = await chromium.launch({ headless: !process.argv.includes('--headed') });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/Failed to load resource|409/.test(m.text()) && errors.push(m.text()));
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
const shot = (name) => (SHOTS ? p.screenshot({ path: `${SHOTS}/${name}.png` }) : undefined);
const api = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', 'x-aicl-client': 'mcp:e2e-client' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return r.json();
};
const sessions = async () => (await api('GET', '/api/sessions')).sessions;
const until = async (fn, ms, what) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => false);
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out: ${what}`);
    await p.waitForTimeout(150);
  }
};

// Seed: two folders (one nested), chats in them, and one unfiled.
const tag = `e2e${Date.now() % 100000}`;
const mk = async (title, change) => {
  const { session } = await api('POST', '/api/sessions', { title: `${title} ${tag}` });
  if (change) await api('PATCH', `/api/sessions/${session.id}`, change);
  return session.id;
};
await api('POST', '/api/session-folders', { path: `Clients ${tag}/Acme` });
const plan = await mk('Plan', { folder: `Clients ${tag}` });
const brief = await mk('Brief', { folder: `Clients ${tag}/Acme` });
const loose = await mk('Loose');

const sidebar = () => p.locator('aside.agent-sidebar');
const row = (label) => sidebar().getByRole('treeitem', { name: label, exact: true });

await p.goto(`${WEB}/#/agent`);
await p.waitForSelector('.agent-page', { timeout: 30000 });

await check('folders, nested folders and chats render as a tree', async () => {
  await row(`Clients ${tag}`).waitFor({ timeout: 10000 });
  await row('Acme').first().waitFor({ timeout: 5000 }); // earlier runs may have their own Acme
  await row(`Brief ${tag}`).waitFor({ timeout: 5000 });
  await row(`Loose ${tag}`).waitFor({ timeout: 5000 });
  await shot('sidebar-tree');
});

await check('clicking a chat opens it', async () => {
  await row(`Loose ${tag}`).click();
  await until(async () => decodeURIComponent(await p.evaluate(() => location.hash)).includes(loose), 5000, 'route to the chat');
});

const menu = async (label) => {
  await row(label).click({ button: 'right' });
  const m = p.locator('.ct-menu');
  await m.waitFor({ timeout: 5000 });
  return m;
};

await check('Pin from the context menu moves the chat to Pinned', async () => {
  await (await menu(`Plan ${tag}`)).getByRole('menuitem', { name: 'Pin' }).click();
  await until(async () => (await sessions()).find((s) => s.id === plan)?.pinned, 5000, 'pinned on the server');
  await until(async () => (await sidebar().getByRole('treeitem', { name: 'Pinned' }).count()) > 0, 5000, 'Pinned section');
});

await check('Move to… files a chat into a folder', async () => {
  const m = await menu(`Loose ${tag}`);
  await m.getByRole('menuitem', { name: 'Move to…' }).click();
  await p.locator('.ct-menu').getByRole('menuitem', { name: `Clients ${tag}/Acme` }).click();
  await until(async () => (await sessions()).find((s) => s.id === loose)?.folder === `Clients ${tag}/Acme`, 5000, 'folder on the server');
  await p.waitForTimeout(400); // the tree re-renders with the move
});

await check('Archive puts it under Archived', async () => {
  await (await menu(`Brief ${tag}`)).getByRole('menuitem', { name: 'Archive' }).click();
  await until(async () => (await sessions()).find((s) => s.id === brief)?.archived, 5000, 'archived on the server');
  await until(async () => (await sidebar().getByRole('treeitem', { name: 'Archived' }).count()) > 0, 5000, 'Archived section');
});

await check('Rename from the menu edits the title inline', async () => {
  await (await menu(`Loose ${tag}`)).getByRole('menuitem', { name: 'Rename' }).click();
  const field = sidebar().getByRole('textbox', { name: 'Chat name' });
  await field.waitFor({ timeout: 5000 });
  await field.fill(`Renamed ${tag}`);
  await field.press('Enter');
  await until(async () => (await sessions()).find((s) => s.id === loose)?.title === `Renamed ${tag}`, 5000, 'title on the server');
});

await check('New folder from the header creates it', async () => {
  await sidebar().getByRole('button', { name: 'New folder' }).click();
  await p.getByRole('textbox', { name: 'New folder name' }).fill(`Ideas ${tag}`);
  await p.keyboard.press('Enter');
  await until(async () => (await api('GET', '/api/session-folders')).folders.includes(`Ideas ${tag}`), 5000, 'folder on the server');
  await row(`Ideas ${tag}`).waitFor({ timeout: 5000 });
});

await check('search narrows the tree', async () => {
  const search = sidebar().getByPlaceholder('Search…');
  await search.fill(`Renamed ${tag}`);
  await until(async () => (await row(`Renamed ${tag}`).count()) === 1 && (await row(`Plan ${tag}`).count()) === 0, 5000, 'filtered rows');
  await search.fill('');
});

await check('Live lists open surfaces; Connected lists MCP clients', async () => {
  await api('POST', '/api/surfaces/terminal', { title: `term ${tag}` });
  await sidebar().locator('.lr-row', { hasText: `term ${tag}` }).waitFor({ timeout: 5000 });
  await sidebar().getByRole('button', { name: /Connected/ }).click();
  await sidebar().locator('.lr-row', { hasText: 'e2e-client' }).waitFor({ timeout: 5000 });
  await shot('sidebar-live');
});

// Leave the workspace as we found it: the tree virtualises rows, so leftovers push later runs' rows off screen.
for (const s of await sessions()) if (s.title.endsWith(tag)) await api('DELETE', `/api/sessions/${s.id}`);
for (const f of [`Clients ${tag}`, `Ideas ${tag}`]) await api('DELETE', `/api/session-folders?path=${encodeURIComponent(f)}`);
for (const t of (await api('GET', '/api/surfaces')).surfaces) if (t.title === `term ${tag}`) await api('DELETE', `/api/surfaces/terminal/${t.id}`);

await check('no page errors', async () => {
  if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
});
await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
