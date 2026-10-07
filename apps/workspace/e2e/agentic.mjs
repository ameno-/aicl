// Wave 2 integration: questions, approvals, live terminal, agent cards, canvas graph.
//
// Runs against a live `npm run dev` with a real model, and CLEARS the canvas
// of the workspace that server points at. Point AICL_WORKSPACE at a throwaway
// folder, then: `node e2e/agentic.mjs --clears-canvas`.
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
const ready = (scope, timeout = 300000) =>
  scope.locator('[data-aicl=composer][data-state=ready], [data-aicl=composer][data-state=error]').first().waitFor({ timeout });
const send = async (scope, text) => {
  await scope.locator('[data-aicl=composer-input]').first().fill(text);
  await scope.locator('[data-aicl=composer-submit]').first().click();
  await scope.locator('[data-aicl=composer-submit][data-role=stop]').first().waitFor({ timeout: 15000 });
};
/** The agent's own words in its last message, without tool cards. */
const lastReply = (scope) =>
  scope
    .locator('[data-aicl=message][data-role=assistant]')
    .last()
    .evaluate((el) => {
      const copy = el.cloneNode(true);
      copy.querySelectorAll('[data-hitl], [data-aicl=tool-call], [data-live]').forEach((n) => n.remove());
      return copy.textContent.trim();
    });
const open = async () => {
  await p.waitForFunction(() => window.__aiclEditor, null, { timeout: 30000 });
  await p.waitForTimeout(800);
};

await p.goto(`${WEB}/`);
await p.waitForTimeout(3000); // let Vite finish any dependency re-optimisation reload
await p.reload();
await open();
await p.evaluate(() => {
  const ed = window.__aiclEditor;
  ed.deleteShapes([...ed.getCurrentPageShapeIds()]);
});

await check('ask_user: the question card takes the answer, and it survives a reload', async () => {
  await send(dock(), 'Use ask_user to ask me which color theme I prefer, with options Light, Dark and System. Then reply with my choice in one word.');
  const card = dock().locator('[data-hitl=question]').last();
  await card.waitFor({ timeout: 120000 });
  await card.getByRole('button', { name: /^Dark/ }).click();
  await ready(dock());
  const reply = await lastReply(dock());
  if (!/dark/i.test(reply)) throw new Error(`reply: ${reply}`);
  await p.reload();
  await open();
  const answered = dock().locator('[data-hitl=answered]', { hasText: 'You chose: Dark' });
  await answered.last().waitFor({ timeout: 15000 });
  return `reply "${reply.slice(0, 40)}", "You chose: Dark" after reload`;
});

await check('bash waits for approval, then streams into a live terminal', async () => {
  await send(dock(), 'Run `for i in 1 2 3; do echo tick $i; sleep 1; done` with bash, then say done.');
  const approval = dock().locator('[data-hitl=approval]').last();
  await approval.waitFor({ timeout: 120000 });
  await shot('approval');
  await approval.getByRole('button', { name: 'Approve' }).click();
  // Sample the terminal while it runs: lines must arrive over time, not all at once.
  const seen = new Set();
  const term = dock().locator('[data-live=terminal]').last();
  for (let i = 0; i < 40; i++) {
    const text = (await term.textContent().catch(() => '')) ?? '';
    seen.add((text.match(/tick \d/g) ?? []).length);
    if (/tick 3/.test(text)) break;
    await p.waitForTimeout(250);
  }
  await ready(dock());
  const text = (await term.textContent()) ?? '';
  if (!/tick 3/.test(text)) throw new Error(`terminal: ${text.slice(0, 80)}`);
  if (seen.size < 3) throw new Error(`output did not stream (tick counts seen: ${[...seen]})`);
  if (!/exit 0/.test(text)) throw new Error('no exit status');
  return `tick counts seen while running: ${[...seen].join(',')}`;
});

await check('an agent card has its own session, and its plan renders in the card', async () => {
  await p.evaluate(() => {
    const ed = window.__aiclEditor;
    ed.createShape({
      type: 'aicl-component',
      x: 0,
      y: 0,
      props: { w: 380, h: 460, component: 'agent', title: 'Ops', props: { name: 'Ops', role: 'Do exactly what is asked. Be terse.' } },
    });
    ed.selectAll();
    ed.zoomToSelection({ animation: { duration: 0 } });
    ed.selectNone();
  });
  const card = p.locator('.aicl-card', { has: p.locator('.aicl-agent-head') });
  await card.locator('[data-aicl=composer-input]').waitFor({ timeout: 15000 });
  await send(card, "Call plan_update with the title 'Card plan' and two steps, 'alpha step' and 'beta step', both done. Then reply: ok.");
  await ready(card);
  await card.locator('[data-live=plan]', { hasText: 'alpha step' }).waitFor({ timeout: 10000 });
  const inDock = await dock().locator('[data-live=plan]', { hasText: 'alpha step' }).count();
  if (inDock) throw new Error("the card's plan leaked into the dock");
  const sessionId = await p.evaluate(
    () => window.__aiclEditor.getCurrentPageShapes().find((s) => s.props.component === 'agent')?.props.props.sessionId,
  );
  if (!sessionId || sessionId === 'main') throw new Error(`card session: ${sessionId}`);
  await shot('agent-card');
  return `card session ${sessionId}`;
});

await check('canvas graph: near and contains edges reach the server, far shapes stay apart', async () => {
  await p.evaluate(() => {
    const ed = window.__aiclEditor;
    const note = (id, x, y, text) => ed.createShape({ id: `shape:${id}`, type: 'note', x, y, props: { richText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } } });
    note('g-a', 2000, 0, 'alpha');
    note('g-b', 2260, 0, 'beta');
    note('g-far', 6000, 3000, 'far away');
  });
  let graph;
  for (let i = 0; i < 20; i++) {
    await p.waitForTimeout(250);
    graph = await (await fetch(`${API}/api/graph`)).json();
    if (graph?.nodes?.some((n) => n.id === 'g-far')) break;
  }
  const near = graph.edges.filter((e) => e.kind === 'near' && [e.from, e.to].includes('g-a') && [e.from, e.to].includes('g-b'));
  if (near.length !== 1) throw new Error(`near edges a↔b: ${near.length}`);
  const far = graph.edges.filter((e) => [e.from, e.to].includes('g-far'));
  if (far.length) throw new Error(`far note has edges: ${JSON.stringify(far)}`);
  const focused = await (await fetch(`${API}/api/graph?focus=g-a&depth=1`)).json();
  const ids = focused.nodes.map((n) => n.id).sort().join(',');
  if (ids !== 'g-a,g-b') throw new Error(`neighbourhood of g-a: ${ids}`);
  return `${graph.nodes.length} nodes, ${graph.edges.length} edges; g-a neighbourhood ${ids}`;
});

await check('no page errors', async () => {
  if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
});

await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
