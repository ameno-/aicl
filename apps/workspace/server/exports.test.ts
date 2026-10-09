import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { SAMPLE_SCREEN } from '../shared/ui-spec.ts';
import { createExports } from './exports.ts';
import { matchRoute } from './http.ts';
import type { Relay } from './relay.ts';
// @ts-expect-error plain ESM script without types
import { plan } from '../bin/aicl.mjs';

function setup() {
  const workspace = mkdtempSync(path.join(tmpdir(), 'aicl-exports-ws-'));
  const relay = { request: async () => ({ op: 'ui_get', spec: SAMPLE_SCREEN }), broadcast() {} } as unknown as Relay;
  const feature = createExports({ workspace, relay, hub: () => { throw new Error('no hub'); } });
  const tool = feature.tools.find((t) => t.name === 'ui_export_project')!;
  const call = async (params: Record<string, unknown>) => {
    const result = await (tool.execute as unknown as (id: string, p: unknown, s?: AbortSignal, u?: unknown, ctx?: unknown) => Promise<{ content: { text: string }[] }>)('t1', params, undefined, undefined, {});
    return JSON.parse(result.content[0]!.text);
  };
  return { workspace, feature, call };
}

async function serve(routes: ReturnType<typeof createExports>['routes']) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const hit = matchRoute([routes], req.method ?? 'GET', url.pathname);
    if (!hit) return void res.writeHead(404).end();
    void hit.handler(req, res, { url, params: hit.params });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

test('ui_export_project exports a canvas screen to a downloadable zip', async () => {
  const { workspace, feature, call } = setup();
  const result = await call({ id: 'screen-1', target: 'react' });
  assert.equal(result.download, '/api/exports/agent-thread-react.zip');
  assert.ok(result.files.includes('src/App.tsx'));
  assert.ok(existsSync(path.join(workspace, '.aicl', 'exports', 'agent-thread-react.zip')));

  const { server, base } = await serve(feature.routes);
  try {
    const res = await fetch(`${base}${result.download}`);
    assert.equal(res.headers.get('content-type'), 'application/zip');
    const zipFile = path.join(workspace, 'dl.zip');
    writeFileSync(zipFile, Buffer.from(await res.arrayBuffer()));
    assert.match(execFileSync('unzip', ['-l', zipFile]).toString(), /src\/Chat\.tsx/);
    assert.equal((await fetch(`${base}/api/exports/..%2F..%2Fsecret.zip`)).status, 404);
  } finally {
    server.close();
  }
});

test('ui_export_project accepts a spec without a canvas', async () => {
  const { call } = setup();
  const result = await call({ spec: { ...SAMPLE_SCREEN, name: 'Headless' }, target: 'json' });
  assert.equal(result.download, '/api/exports/headless-json.zip');
  assert.deepEqual(result.files.sort(), ['README.md', 'catalog.json', 'messages.json', 'screen.json', 'theme.json']);
});

test('ui_export_project writes into the workspace only inside it, and only with approval', async () => {
  const { call } = setup();
  await assert.rejects(call({ id: 's', target: 'html', dir: '../outside' }), /inside the workspace/);
  // No approval registry in this test: the request is declined, nothing is written.
  await assert.rejects(call({ id: 's', target: 'html', dir: 'exported' }), /declined/);
});

test('POST /api/export returns a zip; bad targets and specs are 400', async () => {
  const { feature } = setup();
  const { server, base } = await serve(feature.routes);
  try {
    const targets = await (await fetch(`${base}/api/export/targets`)).json();
    assert.deepEqual(targets.targets.map((t: { id: string }) => t.id), ['react', 'react-tailwind', 'vue', 'svelte', 'html', 'json']);
    const ok = await fetch(`${base}/api/export`, { method: 'POST', body: JSON.stringify({ spec: SAMPLE_SCREEN, target: 'svelte' }) });
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('content-disposition') ?? '', /agent-thread-svelte\.zip/);
    assert.equal((await fetch(`${base}/api/export`, { method: 'POST', body: JSON.stringify({ spec: SAMPLE_SCREEN, target: 'angular' }) })).status, 400);
    assert.equal((await fetch(`${base}/api/export`, { method: 'POST', body: JSON.stringify({ spec: 42, target: 'react' }) })).status, 400);
  } finally {
    server.close();
  }
});

test('aicl export plans the tool call from a screen id or a spec file', () => {
  assert.deepEqual(plan('export', ['s1'], { target: 'vue' }), { tool: 'ui_export_project', params: { id: 's1', target: 'vue' }, download: true });
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'aicl-spec-')), 'screen.json');
  writeFileSync(file, JSON.stringify(SAMPLE_SCREEN));
  const step = plan('export', [file], { dir: 'out' });
  assert.equal(step.params.target, 'react');
  assert.equal(step.params.dir, 'out');
  assert.equal(step.params.spec.name, 'Agent thread');
  assert.throws(() => plan('export', [], {}), /usage: aicl export/);
});
