import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseDiff } from './surfaces/git/parse.ts';
import { parsePrRef } from './surfaces/git/review.ts';
import { createGitService, GitError } from './surfaces/git/service.ts';

const yes = async () => ({ approved: true });
const no = async () => ({ approved: false, note: 'nope' });

function repo(branch = 'work') {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'aicl-git-'));
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  mkdirSync(path.join(dir, 'src'));
  writeFileSync(path.join(dir, 'src/math.ts'), 'export const add = (a: number, b: number) => a + b;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  if (branch !== 'main') git('checkout', '-q', '-b', branch);
  return { dir, git };
}

test('parseDiff: modify, add, delete, rename, binary, no newline', () => {
  const text = [
    'diff --git a/src/a.ts b/src/a.ts',
    'index 111..222 100644',
    '--- a/src/a.ts',
    '+++ b/src/a.ts',
    '@@ -1,3 +1,4 @@ function f()',
    ' one',
    '-two',
    '+TWO',
    '+three',
    ' four',
    '@@ -10 +11 @@',
    '-x',
    '\\ No newline at end of file',
    '+y',
    'diff --git a/new.txt b/new.txt',
    'new file mode 100644',
    'index 0000000..333',
    '--- /dev/null',
    '+++ b/new.txt',
    '@@ -0,0 +1 @@',
    '+hello',
    'diff --git a/gone.txt b/gone.txt',
    'deleted file mode 100644',
    'index 444..0000000',
    '--- a/gone.txt',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-bye',
    'diff --git a/old name.md b/new name.md',
    'similarity index 90%',
    'rename from old name.md',
    'rename to new name.md',
    'diff --git a/img.png b/img.png',
    'index 1..2 100644',
    'Binary files a/img.png and b/img.png differ',
    '',
  ].join('\n');
  const files = parseDiff(text);
  assert.deepEqual(files.map((f) => [f.path, f.status]), [
    ['src/a.ts', 'modified'],
    ['new.txt', 'added'],
    ['gone.txt', 'deleted'],
    ['new name.md', 'renamed'],
    ['img.png', 'modified'],
  ]);
  const [a, added, gone, renamed, bin] = files;
  assert.equal(a!.hunks.length, 2);
  assert.equal(a!.additions, 3);
  assert.equal(a!.deletions, 2);
  assert.equal(a!.hunks[0]!.section, 'function f()');
  assert.deepEqual(a!.hunks[0]!.lines.map((l) => [l.type, l.oldLine, l.newLine]), [
    ['context', 1, 1],
    ['del', 2, undefined],
    ['add', undefined, 2],
    ['add', undefined, 3],
    ['context', 3, 4],
  ]);
  assert.equal(a!.hunks[1]!.oldLines, 1);
  assert.equal(a!.hunks[1]!.lines[0]!.noNewline, true);
  assert.equal(added!.hunks[0]!.lines[0]!.newLine, 1);
  assert.equal(gone!.path, 'gone.txt');
  assert.equal(renamed!.oldPath, 'old name.md');
  assert.equal(renamed!.hunks.length, 0);
  assert.equal(bin!.binary, true);
});

test('parsePrRef understands numbers, owner/repo#n and URLs', () => {
  assert.deepEqual(parsePrRef('12'), { number: 12 });
  assert.deepEqual(parsePrRef('#12', 'a/b'), { repo: 'a/b', number: 12 });
  assert.deepEqual(parsePrRef('ameno-/aicl#3'), { repo: 'ameno-/aicl', number: 3 });
  assert.deepEqual(parsePrRef('https://github.com/ameno-/aicl/pull/7'), { repo: 'ameno-/aicl', number: 7 });
  assert.throws(() => parsePrRef('nope'), GitError);
});

test('per-turn snapshot diff shows exactly what changed, incl. untracked, not .aicl', async () => {
  const { dir } = repo();
  const svc = createGitService(dir);
  writeFileSync(path.join(dir, 'src/math.ts'), 'export const add = (a: number, b: number) => a + b;\nexport const keep = 1;\n'); // before the turn
  const start = await svc.snapshot();
  assert.ok(start);
  writeFileSync(path.join(dir, 'src/math.ts'), 'export const add = (a: number, b: number) => a + b;\nexport const keep = 1;\nexport const multiply = (a: number, b: number) => a * b;\n');
  writeFileSync(path.join(dir, 'notes.md'), 'hi\n');
  mkdirSync(path.join(dir, '.aicl'));
  writeFileSync(path.join(dir, '.aicl/state.json'), '{}');
  const data = await svc.diff({ mode: 'turn', from: start, label: 'Changes in this turn' });
  assert.deepEqual(data.files.map((f) => f.path).sort(), ['notes.md', 'src/math.ts']);
  const math = data.files.find((f) => f.path === 'src/math.ts')!;
  assert.equal(math.additions, 1);
  assert.equal(math.deletions, 0);
  assert.match(math.hunks[0]!.lines.find((l) => l.type === 'add')!.content, /multiply/);
  const end = await svc.snapshot();
  assert.deepEqual((await svc.diff({ mode: 'turn', from: end!, to: end!, label: '' })).files, []);
});

test('not a git repository degrades gracefully', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'aicl-nogit-'));
  const svc = createGitService(dir);
  assert.equal((await svc.status()).repo, false);
  assert.equal((await svc.diff({ mode: 'working', label: 'w' })).error, 'not a git repository');
  assert.equal(await svc.snapshot(), null);
});

test('commit is refused on main and master without asking', async () => {
  const { dir } = repo('main');
  const svc = createGitService(dir);
  writeFileSync(path.join(dir, 'a.txt'), 'x\n');
  let asked = false;
  await assert.rejects(
    svc.commit('nope', true, async () => ((asked = true), { approved: true })),
    (e: GitError) => e.status === 403 && /Refusing to commit on main/.test(e.message),
  );
  assert.equal(asked, false);
});

test('commit on a branch needs staged changes and approval', async () => {
  const { dir, git } = repo('work');
  const svc = createGitService(dir);
  await assert.rejects(svc.commit('empty', false, yes), /nothing is staged/);
  writeFileSync(path.join(dir, 'a.txt'), 'x\n');
  await svc.stage('a.txt');
  assert.deepEqual(await svc.commit('add a', false, no), { declined: 'nope' });
  assert.equal(git('log', '--oneline').trim().split('\n').length, 1);
  const done = await svc.commit('add a', false, yes);
  assert.ok('sha' in done && done.branch === 'work');
  assert.match(git('log', '-1', '--format=%s'), /add a/);
});

test('stage and unstage a single hunk', async () => {
  const { dir, git } = repo();
  const lines = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`);
  writeFileSync(path.join(dir, 'big.txt'), `${lines.join('\n')}\n`);
  git('add', '-A');
  git('commit', '-q', '-m', 'big');
  const edited = [...lines];
  edited[1] = 'CHANGED top';
  edited[37] = 'CHANGED bottom';
  writeFileSync(path.join(dir, 'big.txt'), `${edited.join('\n')}\n`);
  const svc = createGitService(dir);
  const before = (await svc.diff({ mode: 'working', label: 'w' })).files[0]!;
  assert.equal(before.hunks.length, 2);
  await svc.stage('big.txt', before.hunks[1]!.header);
  const cached = git('diff', '--cached');
  assert.match(cached, /CHANGED bottom/);
  assert.doesNotMatch(cached, /CHANGED top/);
  assert.match(git('diff'), /CHANGED top/);
  await svc.unstage('big.txt', (await svc.diff({ mode: 'staged', label: 's' })).files[0]!.hunks[0]!.header);
  assert.equal(git('diff', '--cached').trim(), '');
});

test('discard asks first and restores the file', async () => {
  const { dir, git } = repo();
  const svc = createGitService(dir);
  writeFileSync(path.join(dir, 'src/math.ts'), 'changed\n');
  assert.deepEqual(await svc.discard('src/math.ts', undefined, no), { done: false, note: 'nope' });
  assert.match(git('diff'), /changed/);
  assert.deepEqual(await svc.discard('src/math.ts', undefined, yes), { done: true });
  assert.equal(git('diff').trim(), '');
});

test('status groups staged, unstaged and untracked; ref ranges diff', async () => {
  const { dir, git } = repo();
  const svc = createGitService(dir);
  writeFileSync(path.join(dir, 'src/math.ts'), 'changed\n');
  writeFileSync(path.join(dir, 'new.txt'), 'n\n');
  await svc.stage('src/math.ts');
  const s = await svc.status();
  assert.equal(s.branch, 'work');
  assert.deepEqual(s.staged.map((f) => f.path), ['src/math.ts']);
  assert.deepEqual(s.untracked.map((f) => f.path), ['new.txt']);
  git('commit', '-q', '-m', 'second');
  const range = await svc.diff(svc.specFor('main..work'));
  assert.deepEqual(range.files.map((f) => f.path), ['src/math.ts']);
  assert.throws(() => svc.specFor('--output=x'), GitError);
});
