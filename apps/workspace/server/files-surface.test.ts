import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BrowseError, listDir } from './browse.ts';
import { readDoc, saveDoc, SaveConflict } from './surfaces/files/docs.ts';
import { fuzzyScore, listWorkspaceFiles, searchPaths } from './surfaces/files/search.ts';

function fixture(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'aicl-files-'));
  const put = (rel: string, text = 'x\n') => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  };
  put('src/app.ts', 'export function add(a: number, b: number) {\n  return a + b;\n}\n');
  put('src/apple/pie.ts');
  put('README.md');
  put('.env.local');
  put('.aicl/notes.md');
  put('.aicl/sessions/s1.jsonl');
  put('node_modules/pkg/index.js');
  put('dist/out.js');
  put('.git/HEAD');
  return root;
}

test('tree ignores vendor/build/vcs and session logs; dotfiles are opt-in', async () => {
  const root = fixture();
  const top = (await listDir(root, '', { tree: { dotfiles: false } })).entries.map((e) => e.name);
  assert.deepEqual(top, ['src', 'README.md']);
  const withDots = (await listDir(root, '', { tree: { dotfiles: true } })).entries.map((e) => e.name);
  assert.deepEqual(withDots, ['.aicl', 'src', '.env.local', 'README.md']);
  const aicl = (await listDir(root, '.aicl', { tree: { dotfiles: true } })).entries.map((e) => e.name);
  assert.deepEqual(aicl, ['notes.md']);
});

test('search index skips ignored files; ranking puts the basename match first', async () => {
  const root = fixture();
  const all = await listWorkspaceFiles(root);
  assert.deepEqual(all, ['README.md', 'src/app.ts', 'src/apple/pie.ts']);
  assert.equal(searchPaths(all, 'app')[0], 'src/app.ts');
  assert.equal(searchPaths(all, 'pie')[0], 'src/apple/pie.ts');
  assert.deepEqual(searchPaths(all, 'zzz'), []);
  assert.ok(fuzzyScore('sap', 'src/app.ts') > 0);
  assert.equal(fuzzyScore('xyz', 'src/app.ts'), -1);
});

test('save: writes when baseHash matches, 409-style conflict otherwise', async () => {
  const root = fixture();
  const doc = await readDoc(root, 'src/app.ts');
  assert.equal(doc.language, 'ts');
  assert.equal(doc.lines, 3);
  const saved = await saveDoc(root, 'src/app.ts', 'export const x = 1;\n', doc.hash);
  assert.equal(readFileSync(path.join(root, 'src/app.ts'), 'utf8'), 'export const x = 1;\n');
  assert.notEqual(saved.hash, doc.hash);
  // A second save from the stale hash must not clobber.
  await assert.rejects(
    () => saveDoc(root, 'src/app.ts', 'stale\n', doc.hash),
    (e: unknown) => e instanceof SaveConflict && e.current.text === 'export const x = 1;\n',
  );
  assert.equal(readFileSync(path.join(root, 'src/app.ts'), 'utf8'), 'export const x = 1;\n');
});

test('paths are confined to the workspace (.. and symlink escapes)', async () => {
  const root = fixture();
  const outside = mkdtempSync(path.join(os.tmpdir(), 'aicl-outside-'));
  writeFileSync(path.join(outside, 'secret.txt'), 'secret');
  symlinkSync(outside, path.join(root, 'link'));
  symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'src/secret.txt'));
  const forbidden = (e: unknown) => e instanceof BrowseError && e.status === 403;
  await assert.rejects(() => readDoc(root, '../' + path.basename(outside) + '/secret.txt'), forbidden);
  await assert.rejects(() => readDoc(root, 'link/secret.txt'), forbidden);
  await assert.rejects(() => readDoc(root, 'src/secret.txt'), forbidden);
  await assert.rejects(() => saveDoc(root, 'link/secret.txt', 'pwn', 'x'), forbidden);
  await assert.rejects(() => listDir(root, 'link', { tree: { dotfiles: false } }), forbidden);
  assert.equal(readFileSync(path.join(outside, 'secret.txt'), 'utf8'), 'secret');
  // Symlinks are not indexed for quick-open.
  assert.ok(!(await listWorkspaceFiles(root)).some((p) => p.includes('secret')));
});
