import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { formatCanvasContext } from '../shared/canvas-context-format.ts';
import type { ScratchOp, ScratchResult } from '../shared/scratch.ts';
import { matchRoute } from './http.ts';
import { createCanvasTools, toolRoutes } from './canvas-tools.ts';
// @ts-expect-error plain ESM script without types
import { main, parseArgs, plan } from '../bin/aicl.mjs';

const echo = defineTool({
  name: 'echo',
  label: 'Echo',
  description: 'Echoes.',
  parameters: Type.Object({ msg: Type.String() }),
  async execute(_id, params) {
    return { content: [{ type: 'text' as const, text: `got ${params.msg}` }], details: {} };
  },
});
const boom = defineTool({
  name: 'boom',
  label: 'Boom',
  description: 'Fails.',
  parameters: Type.Object({}),
  async execute() {
    throw new Error('kaput');
  },
});

async function withServer(tools: ToolDefinition[], run: (base: string) => Promise<void>) {
  const table = toolRoutes(tools, { broadcast() {} });
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const hit = matchRoute([table], req.method ?? 'GET', url.pathname);
    if (!hit) return void res.writeHead(404).end();
    await hit.handler(req, res, { url, params: hit.params });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as { port: number };
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test('arrange and focus ops are typed and relayed', async () => {
  const sent: ScratchOp[] = [];
  const relay = {
    async request(op: ScratchOp): Promise<ScratchResult> {
      sent.push(op);
      return { op: op.op as 'arrange', ids: ['a', 'b'] };
    },
    broadcast() {},
  };
  const { tools } = createCanvasTools({ relay: relay as never });
  assert.deepEqual(tools.map((t) => t.name), ['canvas_arrange', 'canvas_focus']);
  await (tools[0]!.execute as Function)('1', { ids: ['a', 'b'], mode: 'stack-horizontal', gap: 10 });
  await (tools[1]!.execute as Function)('2', { ids: ['a'] });
  await (tools[1]!.execute as Function)('3', { bounds: { x: 0, y: 0, w: 10, h: 10 } });
  assert.deepEqual(sent[0], { op: 'arrange', ids: ['a', 'b'], mode: 'stack-horizontal', gap: 10 });
  assert.deepEqual(sent[1], { op: 'focus', ids: ['a'] });
  assert.deepEqual(sent[2], { op: 'focus', bounds: { x: 0, y: 0, w: 10, h: 10 } });
});

test('tools API lists and runs tools', async () => {
  await withServer([echo, boom], async (base) => {
    const list = (await (await fetch(`${base}/api/tools`)).json()) as { name: string; parameters: { properties: object } }[];
    assert.deepEqual(list.map((t) => t.name), ['echo', 'boom']);
    assert.ok('msg' in list[0]!.parameters.properties);

    const ok = await fetch(`${base}/api/tools/echo`, { method: 'POST', body: JSON.stringify({ params: { msg: 'hi' } }) });
    assert.deepEqual(await ok.json(), { content: [{ type: 'text', text: 'got hi' }] });

    const bad = await fetch(`${base}/api/tools/boom`, { method: 'POST', body: '{}' });
    assert.deepEqual(await bad.json(), { error: 'kaput' });

    const missing = await fetch(`${base}/api/tools/nope`, { method: 'POST', body: '{}' });
    assert.equal(missing.status, 404);
  });
});

test('CLI arg parsing and planning', () => {
  const parsed = parseArgs(['--url', 'http://h:1', 'view', '--ids=a,b', '--json']);
  assert.equal(parsed.command, 'view');
  assert.equal(parsed.flags.url, 'http://h:1');
  assert.equal(parsed.flags.json, true);
  assert.deepEqual(plan('view', [], parsed.flags), { tool: 'scratch_view', params: { ids: ['a', 'b'] } });
  assert.deepEqual(plan('call', ['x', '{"a":1}'], {}), { tool: 'x', params: { a: 1 } });
  assert.deepEqual(plan('add', ['[{"kind":"note"}]'], {}), { tool: 'scratch_add', params: { shapes: [{ kind: 'note' }] } });
  assert.throws(() => plan('call', ['x', '{bad'], {}), /valid JSON/);
  assert.throws(() => parseArgs(['--nope']), /Unknown flag/);
});

test('CLI talks to the tools API', async () => {
  await withServer([echo, boom], async (base) => {
    const lines: string[] = [];
    await main(['--url', base, 'call', 'echo', '{"msg":"yo"}'], (s: string) => lines.push(s));
    assert.deepEqual(lines, ['got yo']);
    lines.length = 0;
    await main(['--url', base, 'tools'], (s: string) => lines.push(s));
    assert.match(lines[0]!, /^echo\(msg\)/);
    await assert.rejects(main(['--url', base, 'call', 'boom'], () => {}), /kaput/);
  });
});

test('formatCanvasContext renders every field', () => {
  const text = formatCanvasContext({
    selectedShapes: ['a', 'b'],
    uiSelection: { shapeId: 'shape:s1', nodeId: 'n3' },
    viewport: { x: 10.4, y: 20, w: 1000, h: 600 },
    recentActions: ['created note n-3', 'moved screen s1 to (420, 80)'],
    route: { tab: 'canvas' },
  });
  assert.equal(
    text,
    [
      'selected: a, b',
      'ui-selection: screen s1, element n3',
      'viewport: x 10, y 20, 1000x600 (page coordinates the user is looking at)',
      'recent user actions (oldest first):\n- created note n-3\n- moved screen s1 to (420, 80)',
      'route: aicl:/canvas',
    ].join('\n'),
  );
  assert.equal(formatCanvasContext({ selectedShapes: [], uiSelection: null }), '');
  assert.equal(formatCanvasContext(undefined), '');
});
