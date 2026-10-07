import assert from 'node:assert/strict';
import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { resolveAllowedFile } from './files.ts';

async function fixture() {
  const base = await mkdtemp(path.join(os.tmpdir(), 'aicl-files-'));
  const root = path.join(base, 'root');
  const outside = path.join(base, 'outside');
  await mkdir(path.join(root, 'sub'), { recursive: true });
  await mkdir(outside);
  await writeFile(path.join(root, 'sub', 'a.png'), 'png');
  await writeFile(path.join(root, 'notes.txt'), 'hi');
  await writeFile(path.join(outside, 'secret.png'), 'png');
  await symlink(path.join(outside, 'secret.png'), path.join(root, 'link.png'));
  return { base, root, outside };
}

test('serves an image inside a root (relative and absolute)', async () => {
  const { root } = await fixture();
  const rel = await resolveAllowedFile([root], 'sub/a.png');
  assert.equal(rel.ok && rel.mime, 'image/png');
  const abs = await resolveAllowedFile([root], path.join(root, 'sub', 'a.png'));
  assert.equal(abs.ok, true);
});

test('rejects traversal, outside absolute paths and symlink escapes', async () => {
  const { root, outside } = await fixture();
  for (const p of ['../outside/secret.png', path.join(outside, 'secret.png'), 'link.png']) {
    const r = await resolveAllowedFile([root], p);
    assert.equal(r.ok, false, p);
    if (!r.ok) assert.equal(r.status, 403, p);
  }
});

test('non-image is 415, missing is 404', async () => {
  const { root } = await fixture();
  const txt = await resolveAllowedFile([root], 'notes.txt');
  assert.deepEqual(txt, { ok: false, status: 415 });
  const missing = await resolveAllowedFile([root], 'nope.png');
  assert.deepEqual(missing, { ok: false, status: 404 });
});
