import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createApplets, isAppletId } from './applets.ts';
import { createRelay } from './relay.ts';

async function fixture() {
  const workspace = await mkdtemp(path.join(tmpdir(), 'aicl-applets-'));
  const dir = path.join(workspace, '.aicl', 'applets');
  await mkdir(dir, { recursive: true });
  const relay = createRelay();
  const events: unknown[] = [];
  relay.broadcast = (payload: unknown) => void events.push(payload);
  const applets = createApplets({ workspace, relay });
  return { workspace, dir, applets, events, done: () => applets.dispose() };
}

test('applet ids are restricted to [a-z0-9-]', () => {
  for (const ok of ['notes', 'a-b-1', '9']) assert.ok(isAppletId(ok), ok);
  for (const bad of ['', '../x', 'a/b', 'A', '_shared', 'a.b', 'a b', 'x'.repeat(65), 7]) assert.ok(!isAppletId(bad), String(bad));
});

test('bundles an applet: host imports, shared module, rpc stub, config', async () => {
  const { dir, applets, done } = await fixture();
  await writeFile(path.join(dir, '_util.ts'), `export const double = (n: number) => n * 2;\n`);
  await writeFile(
    path.join(dir, 'demo.server.ts'),
    `export async function stats(name: string) { return { name, n: 3 }; }\nexport const answer = () => 42;\n`,
  );
  await writeFile(
    path.join(dir, 'demo.tsx'),
    `import { useState } from 'react';
import { Box } from 'lucide-react';
import { Markdown } from '@aicl/react/markdown';
import { sendMessage } from 'aicl';
import { stats } from './demo.server';
import { double } from './_util';
export const config = { title: 'Demo', kind: 'view', icon: 'box', colSpan: 2, rowSpan: 9 };
export default function Demo() {
  const [n] = useState(double(2));
  void stats; void Markdown; void sendMessage;
  return <div><Box />{n}</div>;
}
`,
  );
  const result = await applets.build('demo');
  assert.ok(result.ok, JSON.stringify(result));
  if (!result.ok) return;
  assert.equal(result.applet.title, 'Demo');
  assert.equal(result.applet.kind, 'view');
  assert.equal(result.applet.icon, 'box');
  assert.equal(result.applet.colSpan, 2);
  assert.equal(result.applet.rowSpan, 4, 'spans clamp to 4');
  assert.ok(result.applet.hasServer);

  const code = await readFile(path.join(dir, '..', '.build', 'demo.js'), 'utf8');
  assert.match(code, /__AICL_HOST__/);
  assert.doesNotMatch(code, /from ["']react["']/, 'react must come from the host');
  assert.match(code, /rpc\("demo", "stats"|"stats"/);
  assert.match(code, /jsxRuntime/);
  assert.ok(!code.includes('node_modules/react/'), 'react is not bundled');
  assert.match(code, /double|\* 2/);
  done();
});

test('build errors come back with file:line and recover once fixed', async () => {
  const { dir, applets, done } = await fixture();
  await writeFile(path.join(dir, 'bad.tsx'), `export default function Bad() {\n  return <div>;\n}\n`);
  const bad = await applets.build('bad');
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.errors[0]!, /bad\.tsx:\d+:\d+/);
  assert.equal((await applets.list()).find((a) => a.id === 'bad')?.error?.includes('bad.tsx'), true);

  await writeFile(path.join(dir, 'bad.tsx'), `export default function Bad() { return <div />; }\n`);
  const fixed = await applets.build('bad');
  assert.ok(fixed.ok);

  await writeFile(path.join(dir, 'nodefault.tsx'), `export const x = 1;\n`);
  const nd = await applets.build('nodefault');
  assert.equal(nd.ok, false);
  done();
});

test('rebuilds when an imported shared module changes, and not otherwise', async () => {
  const { dir, applets, events, done } = await fixture();
  await writeFile(path.join(dir, '_v.ts'), `export const v = 'one';\n`);
  await writeFile(path.join(dir, 'ver.tsx'), `import { v } from './_v';\nexport default () => <b>{v}</b>;\n`);
  const first = await applets.build('ver');
  const again = await applets.build('ver');
  assert.ok(first.ok && again.ok);
  if (!first.ok || !again.ok) return;
  assert.equal(first.applet.builtAt, again.applet.builtAt, 'unchanged sources are not rebuilt');
  await new Promise((r) => setTimeout(r, 20));
  await writeFile(path.join(dir, '_v.ts'), `export const v = 'two!';\n`);
  const third = await applets.build('ver');
  assert.ok(third.ok);
  if (third.ok) assert.notEqual(third.applet.builtAt, first.applet.builtAt);
  assert.ok(events.some((e) => (e as { type: string }).type === 'applet'));
  done();
});

test('rpc round-trip, errors, timeouts of bad input, and path safety', async () => {
  const { workspace, dir, applets, done } = await fixture();
  await writeFile(path.join(workspace, 'notes.md'), 'one two\nthree\n');
  await writeFile(
    path.join(dir, 'files.server.ts'),
    `import { readFile } from 'node:fs/promises';
export async function count(file: string) {
  console.log('noise on stdout');
  const text = await readFile(file, 'utf8');
  return { lines: text.split('\\n').filter(Boolean).length, cwd: process.cwd() };
}
export function boom() { throw new Error('kaput'); }
export const notFn = 5;
`,
  );
  const ok = await applets.rpc('files', 'count', ['notes.md']);
  assert.ok('result' in ok, JSON.stringify(ok));
  if ('result' in ok) {
    const r = ok.result as { lines: number; cwd: string };
    assert.equal(r.lines, 2);
    assert.match(r.cwd, /aicl-applets-/);
  }
  const boom = await applets.rpc('files', 'boom', []);
  assert.ok('error' in boom && /kaput/.test(boom.error));
  assert.ok('error' in (await applets.rpc('files', 'notFn', [])));
  assert.ok('error' in (await applets.rpc('files', 'missing', [])));
  assert.ok('error' in (await applets.rpc('../files', 'count', [])));
  assert.ok('error' in (await applets.rpc('nope', 'count', [])));
  assert.ok('error' in (await applets.rpc('files', '__proto__', [])));
  done();
});

test('routes: workspace config defaults and round-trip; invalid ids rejected', async () => {
  const { workspace, applets, done } = await fixture();
  // GET default
  const get = applets.routes['GET /api/workspace']!;
  let out = '';
  await get({} as never, { writeHead() {}, end: (p: string) => void (out = p) } as never, { url: new URL('http://x'), params: {} });
  assert.deepEqual(JSON.parse(out), { name: path.basename(workspace), overview: [] });
  const buildRoute = applets.routes['POST /api/applets/:id/build']!;
  let status = 0;
  await buildRoute({} as never, { writeHead: (s: number) => void (status = s), end() {} } as never, { url: new URL('http://x'), params: { id: '../etc' } });
  assert.equal(status, 422);
  done();
});
