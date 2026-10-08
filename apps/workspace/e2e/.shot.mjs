import { chromium } from 'playwright-core';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ headless: false });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto(url); await p.waitForTimeout(3500);
await p.screenshot({ path: out });
console.log(JSON.stringify({ errors: errors.slice(0, 4) }));
await b.close();
