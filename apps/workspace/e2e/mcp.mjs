// Integration: bin/aicl-mcp.mjs against a live workspace, using the MCP SDK client over stdio.
// A gated tool (terminal_run) must show an approval card in the AICL page; approving it returns the result.
// E2E_API / E2E_WEB point it at another instance; --shots=<dir> saves screenshots.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { chromium } from 'playwright-core';

const API = process.env.E2E_API ?? 'http://127.0.0.1:5180';
const WEB = process.env.E2E_WEB ?? 'http://localhost:5181';
const SHOTS = process.argv.find((a) => a.startsWith('--shots='))?.slice(8);

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

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`${WEB}/`);
await p.waitForTimeout(2500);

const client = new Client({ name: 'e2e', version: '0' });
await client.connect(new StdioClientTransport({ command: 'node', args: ['bin/aicl-mcp.mjs', '--url', API] }));
const text = (r) => r.content.map((c) => c.text ?? `[${c.type}]`).join('\n');

await check('lists every agent tool (>= 30, incl. terminal_run and browser_open)', async () => {
  const { tools } = await client.listTools();
  const names = new Set(tools.map((t) => t.name));
  if (tools.length < 30) throw new Error(`only ${tools.length} tools`);
  for (const n of ['terminal_run', 'browser_open', 'process_start', 'scratch_read']) if (!names.has(n)) throw new Error(`missing ${n}`);
  if (!tools.every((t) => t.inputSchema?.type === 'object')) throw new Error('a tool lacks an object schema');
  return `${tools.length} tools`;
});

await check('calls an ungated tool (scratch_read)', async () => {
  const r = await client.callTool({ name: 'scratch_read', arguments: {} });
  if (r.isError) throw new Error(text(r));
  return text(r).slice(0, 60);
});

await check('calls process_list and reads surfaces as resources', async () => {
  const r = await client.callTool({ name: 'process_list', arguments: {} });
  if (r.isError) throw new Error(text(r));
  const { resources } = await client.listResources();
  const first = resources[0];
  if (first) {
    const read = await client.readResource({ uri: first.uri });
    if (!read.contents[0]?.text) throw new Error('empty resource');
  }
  return `${resources.length} resources; ${text(r).slice(0, 40)}`;
});

await check('terminal_run needs approval in the UI, then returns its output', async () => {
  const call = client.callTool({ name: 'terminal_run', arguments: { command: 'echo mcp-says-hi' } }, undefined, { timeout: 120000 });
  let settled = false;
  call.then(() => (settled = true), () => (settled = true));
  const card = p.locator('[data-hitl=approval]').last();
  await card.waitFor({ timeout: 30000 });
  if (settled) throw new Error('the call returned before approval');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/mcp-approval.png` });
  await card.getByRole('button', { name: 'Approve' }).click();
  const r = await call;
  if (r.isError || !/mcp-says-hi/.test(text(r))) throw new Error(text(r).slice(0, 200));
  return text(r).split('\n')[0];
});

await check('a declined terminal_run comes back as an error and does not run', async () => {
  const call = client.callTool({ name: 'terminal_run', arguments: { command: 'echo must-not-run' } }, undefined, { timeout: 120000 });
  const card = p.locator('[data-hitl=approval]').last();
  await p.waitForFunction(async () => (await (await fetch('/api/hitl')).json()).pending.length > 0, null, { timeout: 30000 });
  await card.getByRole('button', { name: /Decline|Deny|Reject/ }).click();
  const r = await call;
  if (!r.isError || !/declined/.test(text(r))) throw new Error(text(r).slice(0, 200));
});

await check('no page errors', async () => {
  if (errors.length) throw new Error(errors[0]);
});

await client.close();
await b.close();
process.exit(failed ? 1 : 0);
