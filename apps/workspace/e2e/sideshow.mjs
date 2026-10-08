// Integration: a sideshow surface card on the canvas (preview iframe, comments, buttons).
// Needs a live `npm run dev` with a published card: E2E_API, E2E_WEB, E2E_CARD; --shots=<dir> saves a screenshot.
import { chromium } from 'playwright-core';

const API = process.env.E2E_API ?? 'http://127.0.0.1:5180';
const WEB = process.env.E2E_WEB ?? 'http://localhost:5181';
const CARD = process.env.E2E_CARD;
const SHOTS = process.argv.find((a) => a.startsWith('--shots='))?.slice(8);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/409|Failed to load resource/.test(m.text()) && errors.push(m.text()));
await p.goto(WEB);
await p.waitForTimeout(3000);
const add = await fetch(`${API}/api/tools/scratch_add`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ params: { shapes: [{ kind: 'component', component: 'surface', props: { kind: 'sideshow', id: CARD }, x: 100, y: 100, w: 560, h: 460 }] } }),
});
console.log('add', (await add.text()).slice(0, 200));
await p.waitForTimeout(3000);
const card = p.locator('[data-surface=sideshow]').first();
await card.waitFor({ timeout: 10000 });
console.log('PASS card rendered');
console.log('comments text', (await card.innerText()).replace(/\s+/g, ' ').slice(0, 200));
const frame = card.frameLocator('iframe');
console.log('preview', (await frame.locator('body').innerText()).slice(0, 80));
if (SHOTS) await p.screenshot({ path: `${SHOTS}/sideshow.png` });
console.log(errors.length ? `FAIL page errors: ${errors.join(' | ')}` : 'PASS no page errors');
await b.close();
