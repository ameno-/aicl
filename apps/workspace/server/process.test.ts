import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
// @ts-expect-error plain ESM scripts without types
import { parseSurfaceUri, surfaceUri, toMcpResources, toMcpResult, toMcpTools } from '../bin/aicl-mcp.mjs';
// @ts-expect-error plain ESM script without types
import { plan, surfaceOpenRequest } from '../bin/aicl.mjs';
import { toolRoutes } from './canvas-tools.ts';
import { createHitl } from './hitl.ts';
import { matchRoute } from './http.ts';
import { createTerminalManager, stripAnsi } from './surfaces/pty.ts';
import { createProcessManager, type ProcessInfo } from './surfaces/process/manager.ts';
import { parseLsof, parsePorts, treeOf } from './surfaces/process/ports.ts';

const workspace = () => mkdtempSync(path.join(tmpdir(), 'aicl-proc-'));
const until = async (check: () => boolean, ms = 8000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 50));
  }
};

/* ── port detection ───────────────────────────────────────────────── */

test('parsePorts reads common dev-server output', () => {
  assert.deepEqual(parsePorts('  VITE v6.0.0  ready in 300 ms\n\n  \u001b[32m➜\u001b[39m  Local:   http://localhost:5173/\n  Network: http://192.168.1.4:5173/'), [5173]);
  assert.deepEqual(parsePorts('Starting up http-server, serving ./\nAvailable on:\n  http://127.0.0.1:8080\n  http://192.168.1.4:8080'), [8080]);
  assert.deepEqual(parsePorts('Serving HTTP on :: port 8000 (http://[::]:8000/) ...'), [8000]);
  assert.deepEqual(parsePorts('INFO: Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)'), [8001]);
  assert.deepEqual(parsePorts('server listening on port 3000'), [3000]);
  assert.deepEqual(parsePorts('Listening on :4000'), [4000]);
  assert.deepEqual(parsePorts('Local: http://localhost:3000\nlistening on 3000\nAPI http://localhost:3001'), [3000, 3001]);
});

test('parsePorts ignores text that is not a local listener', () => {
  assert.deepEqual(parsePorts('fetching https://registry.npmjs.org/left-pad\ncompiled 3 modules in 1200 ms\nport 99999999'), []);
  assert.deepEqual(parsePorts(''), []);
});

test('parseLsof keeps only the process tree, treeOf walks children', () => {
  const lsof = 'p100\nn*:3000\nn[::1]:3000\np200\nn127.0.0.1:9229\np300\nn*:5173\n';
  assert.deepEqual(parseLsof(lsof), [3000, 5173, 9229]);
  assert.deepEqual(parseLsof(lsof, new Set([100, 300])), [3000, 5173]);
  const ps = '  1     0\n 100     1\n 101   100\n 102   101\n 300     1\n';
  assert.deepEqual([...treeOf(100, ps)].sort(), [100, 101, 102]);
});

/* ── process lifecycle ────────────────────────────────────────────── */

test('process manager: start, output, exit code', async () => {
  const seen: ProcessInfo[] = [];
  const m = createProcessManager({ workspace: workspace(), onChange: (i) => seen.push(i), detect: async () => [] });
  try {
    const p = m.start({ command: 'echo hello; echo oops >&2; exit 3', name: 'quick' });
    assert.equal(p.status, 'running');
    await until(() => m.get(p.id)?.status === 'exited');
    const done = m.get(p.id)!;
    assert.equal(done.exitCode, 3);
    assert.equal(done.name, 'quick');
    assert.match(m.logs(p.id)!, /hello/);
    assert.match(m.logs(p.id)!, /oops/);
    assert.ok(seen.some((i) => i.status === 'running') && seen.at(-1)!.status === 'exited');
  } finally {
    m.dispose();
  }
});

test('process manager: stop ends the whole tree and restart starts it again', async () => {
  const m = createProcessManager({ workspace: workspace(), detect: async () => [] });
  try {
    const p = m.start({ command: 'sleep 60 & sleep 60; wait' });
    await new Promise((r) => setTimeout(r, 200));
    const stopped = await m.stop(p.id, 1000);
    assert.equal(stopped?.status, 'exited');
    assert.equal(stopped?.stopped, true);
    const again = await m.restart(p.id);
    assert.equal(again?.status, 'running');
    assert.ok(again!.startedAt >= p.startedAt);
    await m.stop(p.id, 1000);
    await m.close(p.id);
    assert.equal(m.get(p.id), undefined);
  } finally {
    m.dispose();
  }
});

test('process manager: ports come from output hints and clear on exit', async () => {
  const m = createProcessManager({ workspace: workspace(), detect: async () => [] });
  try {
    const p = m.start({ command: 'echo "  Local:   http://localhost:4321/"; sleep 60' });
    await until(() => (m.get(p.id)?.ports.length ?? 0) > 0);
    assert.deepEqual(m.get(p.id)!.ports, [4321]);
    await m.stop(p.id, 1000);
    assert.deepEqual(m.get(p.id)!.ports, []);
  } finally {
    m.dispose();
  }
});

test('process manager: lsof finds a real listening port of the child tree', async () => {
  const m = createProcessManager({ workspace: workspace(), pollMs: 200 });
  try {
    const script = "require('http').createServer().listen(0,'127.0.0.1',()=>{})";
    const p = m.start({ command: `node -e "${script}"` });
    const info = await m.waitForPort(p.id, 8000);
    assert.equal(info?.ports.length, 1, 'one port detected');
    assert.ok(info!.ports[0]! > 0);
    await m.stop(p.id, 1000);
  } finally {
    m.dispose();
  }
});

/* ── HTTP tool gate ───────────────────────────────────────────────── */

test('POST /api/tools/:name asks for approval before gated tools', async () => {
  const events: Array<{ type?: string; request?: { id: string; tool: string; sessionId: string } }> = [];
  const hitl = createHitl({ workspace: workspace(), relay: { broadcast: (e: never) => void events.push(e) } as never, hub: (() => null) as never });
  let ran = 0;
  const gated = defineTool({
    name: 'terminal_run',
    label: 'Run',
    description: 'Runs.',
    parameters: Type.Object({ command: Type.String() }),
    async execute() {
      ran++;
      return { content: [{ type: 'text' as const, text: 'ran' }], details: {} };
    },
  });
  const free = defineTool({
    name: 'free_tool',
    label: 'Free',
    description: 'No approval.',
    parameters: Type.Object({}),
    async execute() {
      return { content: [{ type: 'text' as const, text: 'free' }], details: {} };
    },
  });
  const table = toolRoutes([gated, free] as ToolDefinition[], { broadcast() {} });
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const hit = matchRoute([table, hitl.routes], req.method ?? 'GET', url.pathname);
    if (!hit) return void res.writeHead(404).end();
    await hit.handler(req, res, { url, params: hit.params });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const call = (name: string, params: unknown) =>
    fetch(`${base}/api/tools/${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ params }) }).then((r) => r.json() as Promise<{ content?: { text: string }[]; error?: string }>);
  const answer = (approved: boolean) =>
    fetch(`${base}/api/hitl/${events.find((e) => e.type === 'hitl')!.request!.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'approval', approved, note: approved ? undefined : 'no thanks' }) });
  try {
    assert.equal((await call('free_tool', {})).content?.[0]?.text, 'free');
    assert.equal(events.length, 0, 'ungated tools never ask');

    const declined = call('terminal_run', { command: 'ls' });
    await until(() => events.some((e) => e.type === 'hitl'));
    const request = events.find((e) => e.type === 'hitl')!.request!;
    assert.equal(request.tool, 'terminal_run');
    assert.equal(request.sessionId, 'main');
    assert.equal(ran, 0, 'nothing runs while the card is pending');
    await answer(false);
    assert.match((await declined).error ?? '', /declined: no thanks/);
    assert.equal(ran, 0);

    events.length = 0;
    const approved = call('terminal_run', { command: 'ls' });
    await until(() => events.some((e) => e.type === 'hitl'));
    await answer(true);
    assert.equal((await approved).content?.[0]?.text, 'ran');
    assert.equal(ran, 1);
  } finally {
    server.close();
  }
});

/* ── MCP mapping ──────────────────────────────────────────────────── */

test('MCP: tools, results and resources map from the HTTP API', () => {
  const tools = toMcpTools([
    { name: 'git_status', description: 'Status.', parameters: { type: 'object', properties: { path: { type: 'string' } } } },
    { name: 'odd', description: undefined, parameters: undefined },
  ]);
  assert.deepEqual(tools[0], { name: 'git_status', description: 'Status.', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } });
  assert.deepEqual(tools[1], { name: 'odd', description: '', inputSchema: { type: 'object', properties: {} } });

  assert.deepEqual(toMcpResult({ content: [{ type: 'text', text: 'hi' }, { type: 'image', data: 'AAA', mimeType: 'image/jpeg' }] }), {
    content: [{ type: 'text', text: 'hi' }, { type: 'image', data: 'AAA', mimeType: 'image/jpeg' }],
  });
  assert.deepEqual(toMcpResult({ error: 'The user declined: no' }), { isError: true, content: [{ type: 'text', text: 'The user declined: no' }] });

  const res = toMcpResources([{ kind: 'process', id: 'p-1', title: 'web', summary: 'running · :5173', status: 'busy' }]);
  assert.equal(res[0].uri, 'aicl://surface/process/p-1');
  assert.match(res[0].description, /:5173/);
  assert.deepEqual(parseSurfaceUri(surfaceUri({ kind: 'file', id: 'a b/c' })), { kind: 'file', id: 'a b/c' });
  assert.equal(parseSurfaceUri('http://nope'), null);
});

test('aicl CLI plans process and surface commands', () => {
  assert.deepEqual(plan('process', ['start', 'npm', 'run', 'dev'], { name: 'web' }), { tool: 'process_start', params: { command: 'npm run dev', name: 'web' } });
  assert.deepEqual(plan('process', ['logs', 'p-1'], { lines: '20' }), { tool: 'process_logs', params: { id: 'p-1', lines: 20 } });
  assert.deepEqual(plan('process', ['stop', 'p-1'], {}), { tool: 'process_stop', params: { id: 'p-1' } });
  assert.throws(() => plan('process', ['start'], {}), /usage/);
  assert.deepEqual(surfaceOpenRequest('browser', 'http://localhost:5173'), ['/api/surfaces/browser', { url: 'http://localhost:5173' }]);
  assert.deepEqual(surfaceOpenRequest('file', 'src/a.ts:12'), ['/api/surfaces/file/open', { path: 'src/a.ts', line: 12 }]);
  assert.throws(() => surfaceOpenRequest('process', 'x'), /aicl process start/);
});

/* ── terminal sentinels stay hidden ───────────────────────────────── */

for (const shell of ['/bin/zsh', '/bin/bash']) {
  test(`terminal_run via ${path.basename(shell)}: marks are invisible and exit codes right`, { skip: !existsSync(shell) }, async () => {
    const m = createTerminalManager({ workspace: workspace(), shell });
    try {
      const { id } = m.open({ title: 'agent' });
      await m.ready(id);
      const ok = await m.run(id, 'echo hello; echo world');
      assert.equal(ok.exitCode, 0);
      assert.equal(ok.output, 'hello\nworld');
      const bad = await m.run(id, 'echo oops; (exit 7)');
      assert.equal(bad.exitCode, 7);
      assert.equal(bad.output, 'oops');
      assert.equal((await m.run(id, 'false')).exitCode, 1);
      assert.equal((await m.run(id, 'true')).exitCode, 0);
      const multi = await m.run(id, 'echo a\necho b');
      assert.equal(multi.output, 'a\nb');
      // State persists, like the user's own shell.
      await m.run(id, 'FOO=bar');
      assert.equal((await m.run(id, 'echo $FOO')).output, 'bar');

      const view = stripAnsi(m.scrollback(id)!);
      assert.ok(!view.includes('__AICL'), 'no legacy sentinels');
      assert.ok(!view.includes('777;aicl'), 'hook setup line and marks are not echoed');
      assert.ok(!view.includes('printf'), 'the setup line never reaches a view');
      assert.ok(view.includes('echo hello; echo world'), 'the command itself stays visible');
      assert.ok(!m.scrollback(id)!.includes('\u001b]777;aicl;R'), 'the ready mark is not forwarded');
    } finally {
      m.dispose();
    }
  });
}

test('spawned zsh terminals do not print the partial-line % mark', { skip: !existsSync('/bin/zsh') }, async () => {
  const m = createTerminalManager({ workspace: workspace(), shell: '/bin/zsh' });
  try {
    const { id } = m.open();
    await m.ready(id);
    m.write(id, 'printf partial\r');
    await until(() => stripAnsi(m.scrollback(id)!).includes('partial'));
    await new Promise((r) => setTimeout(r, 600));
    assert.ok(!/partial\s*%/.test(stripAnsi(m.scrollback(id)!)), 'no % marker after a line without a newline');
  } finally {
    m.dispose();
  }
});

test('agents view: unanswered trailing tool calls of a running session show as running', async () => {
  const { markUnfinished } = await import('../web/swarm/store.ts');
  const call = (id: string, status: string) => ({ type: 'tool-call', toolCallId: id, name: 'agent_wait', args: {}, argsText: '{}', status });
  const messages = [{ id: 'm1', role: 'assistant', parts: [{ type: 'text', text: 'hi' }, call('a', 'error'), call('b', 'success'), call('c', 'error')] }] as never;
  const out = markUnfinished(messages) as unknown as { parts: { status?: string }[] }[];
  assert.deepEqual(out[0]!.parts.slice(1).map((p) => p.status), ['error', 'success', 'running']);
  assert.equal(markUnfinished([] as never).length, 0);
});
