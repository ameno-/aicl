import assert from 'node:assert/strict';
import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { BrowseError, listDir, readText } from './browse.ts';
import { findModel, listModels } from './models.ts';
import { createSessionHub, SessionError, type AgentLike } from './sessions.ts';

const model = (provider: string, id: string, name = id) => ({ provider, id, name });
const runtime = {
  getAvailable: async () => [model('a', 'one', 'One'), model('a', 'two', 'Two'), model('b', 'solo', 'Solo'), model('c', 'other')],
  getModel: (provider: string, id: string) => [model('a', 'one'), model('b', 'solo')].find((m) => m.provider === provider && m.id === id),
};

test('listModels: the default model leads, its provider follows, in-use models stay; all=true returns everything', async () => {
  const narrow = await listModels({ runtime: runtime as never, current: 'a/two', inUse: ['b/solo'] });
  assert.deepEqual(narrow.map((m) => m.id), ['a/two', 'b/solo', 'a/one']);
  assert.equal((await listModels({ runtime: runtime as never, current: 'a/two', all: true })).length, 4);
  assert.deepEqual((await listModels({ runtime: runtime as never, current: null })).map((m) => m.id), []);
});

test('findModel splits provider/id on the first slash only', () => {
  assert.equal(findModel(runtime as never, 'a/one')?.id, 'one');
  assert.equal(findModel(runtime as never, 'nope'), undefined);
  assert.equal(findModel(runtime as never, '/one'), undefined);
});

test('hub.setModel switches the live agent, persists, and reaches createAgent on reload; refuses unknown models and busy sessions', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'aicl-models-'));
  const set: unknown[] = [];
  const created: Array<string | undefined> = [];
  const make = (): AgentLike => ({
    messages: [],
    isStreaming: false,
    subscribe: () => () => undefined,
    prompt: async () => undefined,
    abort: async () => undefined,
    setModel: async (m: unknown) => void set.push(m),
  });
  const options = {
    dir,
    createAgent: async (_file: string | undefined, m?: string) => (created.push(m), make()),
    resolveModel: (key: string) => (key === 'a/one' ? { provider: 'a', id: 'one' } : undefined),
  };
  const hub = await createSessionHub(options);
  const s = await hub.create({});
  const info = await hub.setModel(s.id, 'a/one');
  assert.equal(info.model, 'a/one');
  assert.deepEqual(set, [{ provider: 'a', id: 'one' }]);
  assert.deepEqual(hub.modelsInUse(), ['a/one']);
  await assert.rejects(hub.setModel(s.id, 'x/y'), (e) => e instanceof SessionError && e.status === 400);
  hub.reserve(s.id);
  await assert.rejects(hub.setModel(s.id, 'a/one'), (e) => e instanceof SessionError && e.status === 409);
  await hub.flush();

  // A fresh hub (a restart) remembers the choice and builds the agent with it.
  const again = await createSessionHub(options);
  assert.equal(again.get(s.id)?.model, 'a/one');
  await again.agent(s.id);
  assert.equal(created.at(-1), 'a/one');
});

test('browse: lists and reads inside the workspace, refuses escapes and binaries', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'aicl-browse-'));
  const outside = await mkdtemp(path.join(tmpdir(), 'aicl-outside-'));
  await writeFile(path.join(root, 'notes.md'), '# hi');
  await mkdir(path.join(root, 'src'));
  await mkdir(path.join(root, 'node_modules'));
  await writeFile(path.join(root, 'src', 'a.ts'), 'export {}');
  await writeFile(path.join(root, 'bin.dat'), Buffer.from([1, 0, 2]));
  await writeFile(path.join(outside, 'secret.txt'), 'nope');
  await symlink(outside, path.join(root, 'escape'));

  const top = await listDir(root, '');
  assert.deepEqual(top.entries.map((e) => e.name), ['escape', 'src', 'bin.dat', 'notes.md']); // folders first, node_modules hidden
  assert.equal((await listDir(root, 'src')).entries[0]!.path, 'src/a.ts');
  assert.equal((await readText(root, 'notes.md')).text, '# hi');
  assert.equal((await readText(root, path.join(root, 'notes.md'))).path, 'notes.md'); // absolute paths inside are fine
  await assert.rejects(readText(root, 'escape/secret.txt'), (e) => e instanceof BrowseError && e.status === 403);
  await assert.rejects(readText(root, '../x'), (e) => e instanceof BrowseError && (e.status === 403 || e.status === 404));
  await assert.rejects(readText(root, 'bin.dat'), (e) => e instanceof BrowseError && e.status === 415);
  await assert.rejects(listDir(root, 'missing'), (e) => e instanceof BrowseError && e.status === 404);
});
