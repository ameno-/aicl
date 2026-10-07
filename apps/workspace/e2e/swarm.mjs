// AICL-40 multi-agent: spawn three sub-agents in parallel, watch them in the Agents view
// and on the canvas, stop one, steer one, get the synthesis, reload and see lineage persist.
//
// Runs against a live `npm run dev` with a real model and CLEARS the canvas of the workspace
// that server points at. Use a throwaway AICL_WORKSPACE:
//   E2E_API=http://127.0.0.1:5198 E2E_WEB=http://localhost:5199 node e2e/swarm.mjs --clears-canvas --shots=<dir>
import { chromium } from 'playwright-core';

const API = process.env.E2E_API ?? 'http://127.0.0.1:5180';
const WEB = process.env.E2E_WEB ?? 'http://localhost:5181';

if (!process.argv.includes('--clears-canvas')) {
  console.error('Refusing to run: this test clears the canvas. Use a throwaway AICL_WORKSPACE and pass --clears-canvas.');
  process.exit(2);
}
const SHOTS = process.argv.find((a) => a.startsWith('--shots='))?.slice(8);

const b = await chromium.launch(process.env.E2E_CHROME ? { executablePath: process.env.E2E_CHROME } : {});
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
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
const shot = (name) => (SHOTS ? p.screenshot({ path: `${SHOTS}/${name}.png` }) : undefined);
const dock = () => p.getByRole('complementary', { name: 'Agent chat' });
const rows = () => p.locator('[data-swarm=row][data-depth="1"]');
const sessions = async () => (await (await fetch(`${API}/api/sessions`)).json()).sessions;
const until = async (fn, timeout, what) => {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn().catch(() => false);
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out: ${what}`);
    await p.waitForTimeout(300);
  }
};

await p.goto(`${WEB}/`);
await p.waitForTimeout(3000);
await p.reload();
await p.waitForFunction(() => window.__aiclEditor, null, { timeout: 30000 });
await p.waitForTimeout(800);
await p.evaluate(() => window.__aiclEditor.deleteShapes([...window.__aiclEditor.getCurrentPageShapeIds()]));

// The dock chats with the main agent.
const input = dock().locator('[data-aicl=composer-input]').first();
await input.fill(
  "Spawn three agents in parallel (wait:false): 'Pro' argues for remote work, 'Con' argues against, 'Data' lists 3 statistics. Each should write about 150 words. Wait for all, then give me a 3-line synthesis.",
);
await dock().locator('[data-aicl=composer-submit]').first().click();

await p.goto(`${WEB}/#/agents`);
await check('Agents view shows 3 children under main', async () => {
  await until(async () => (await rows().count()) >= 3, 120000, '3 child rows');
  const names = await rows().locator('[data-swarm=name]').allTextContents();
  for (const n of ['Pro', 'Con', 'Data']) if (!names.includes(n)) throw new Error(`missing ${n}: ${names}`);
  return names.join(', ');
});
await check('children show a live current step and growing tokens', async () => {
  const seen = new Set();
  let usage = [];
  await until(async () => {
    for (const t of await rows().locator('[data-swarm=step][data-live]').allTextContents()) seen.add(t);
    usage = await rows().locator('[data-swarm=usage]').allTextContents();
    return seen.size >= 1 && usage.length >= 1;
  }, 90000, 'live step + usage');
  return `steps: ${[...seen].slice(0, 3).join(' | ')}; usage: ${usage.join(' | ')}`;
});
await shot('agents-running');

await check('canvas has a Run frame with 3 agent cards and arrows from main', async () => {
  await until(
    () =>
      p.evaluate(() => {
        const e = window.__aiclEditor;
        const shapes = e.getCurrentPageShapes();
        return shapes.some((s) => s.type === 'frame' && String(s.props.name).startsWith('Run:'));
      }),
    30000,
    'run frame',
  );
  await until(
    () =>
      p.evaluate(() => {
        const e = window.__aiclEditor;
        const shapes = e.getCurrentPageShapes();
        const cards = shapes.filter((s) => s.props?.component === 'agent' && s.props?.props?.sessionId);
        const arrows = shapes.filter((s) => s.type === 'arrow');
        return cards.length >= 3 && arrows.length >= 3;
      }),
    30000,
    '3 cards + 3 arrows',
  );
  return p.evaluate(() => {
    const shapes = window.__aiclEditor.getCurrentPageShapes();
    const arrows = shapes.filter((s) => s.type === 'arrow');
    return `arrows: ${arrows.map((a) => `${a.props.color}/${a.props.dash}`).join(', ')}`;
  });
});
await p.goto(`${WEB}/#/canvas`);
await p.waitForTimeout(1500);
await p.evaluate(() => {
  const e = window.__aiclEditor;
  const frame = e.getCurrentPageShapes().find((s) => s.type === 'frame');
  if (frame) e.zoomToBounds(e.getShapePageBounds(frame.id), { inset: 60 });
});
await p.waitForTimeout(800);
await shot('canvas-run-frame');

await p.goto(`${WEB}/#/agents`);
await check('stopping one child from the Agents view stops it, the root continues', async () => {
  const data = rows().filter({ hasText: 'Data' }).first();
  await data.click();
  const stop = p.locator('[data-swarm=stop]');
  await until(async () => !(await stop.isDisabled()), 20000, 'Data still running');
  await stop.click();
  await until(async () => (await data.getAttribute('data-state')) === 'stopped', 20000, 'Data stopped');
  const main = (await sessions()).find((s) => s.id === 'main');
  return `main status after stop: ${main.status}`;
});
await check('steering a child via the composer logs a message handoff', async () => {
  const pro = rows().filter({ hasText: 'Pro' }).first();
  await pro.click();
  const box = p.locator('[data-swarm=detail] [data-aicl=composer-input]').first();
  await box.fill('Please keep it under 100 words and say "ack steer".');
  await p.locator('[data-swarm=detail] [data-aicl=composer-submit]').first().click();
  await until(async () => (await p.locator('[data-swarm=log-item][data-type=message]').count()) >= 1, 15000, 'message log item');
  return 'message handoff logged';
});
await check('inbox pane and handoff log render', async () => {
  await p.locator('[data-swarm=inbox]').waitFor({ timeout: 5000 });
  const spawns = await p.locator('[data-swarm=log-item][data-type=spawn]').count();
  if (spawns < 3) throw new Error(`only ${spawns} spawn events`);
  return `${spawns} spawn events`;
});

await check('the root finishes with a synthesis', async () => {
  await until(async () => (await sessions()).find((s) => s.id === 'main').status === 'idle', 280000, 'main idle');
  await p.waitForTimeout(1500);
  const text = await (await fetch(`${API}/api/sessions/main/messages`)).json();
  const last = text.messages.filter((m) => m.role === 'assistant').at(-1);
  const reply = last.parts.filter((x) => x.type === 'text').map((x) => x.text).join('\n').trim();
  if (reply.length < 20) throw new Error('empty synthesis');
  return reply.replace(/\s+/g, ' ').slice(0, 160);
});
await shot('agents-done');

await p.reload();
await check('after reload lineage and usage persist', async () => {
  await until(async () => (await rows().count()) >= 3, 15000, 'rows after reload');
  const kids = (await sessions()).filter((s) => s.parentId === 'main');
  if (kids.length < 3) throw new Error(`${kids.length} children`);
  if (!kids.every((k) => k.usage && k.usage.inputTokens > 0 && k.role && k.task)) throw new Error('missing usage/role/task');
  const usageShown = await rows().locator('[data-swarm=usage]').count();
  if (usageShown < 3) throw new Error(`usage shown on ${usageShown} rows`);
  return kids.map((k) => `${k.title}:${k.usage.inputTokens + k.usage.outputTokens}tok`).join(', ');
});
await check('no page errors', async () => {
  if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
});

await b.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
