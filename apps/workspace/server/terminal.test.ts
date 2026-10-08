import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createTerminalManager, stripAnsi } from './surfaces/pty.ts';

const workspace = () => mkdtempSync(path.join(tmpdir(), 'aicl-term-'));
// A bare sh keeps the tests independent of the user's zsh startup files.
const mgr = (ws: string, extra: Partial<Parameters<typeof createTerminalManager>[0]> = {}) =>
  createTerminalManager({ workspace: ws, shell: '/bin/sh', ...extra });

test('terminal_run: output, exit code, sentinel hidden', async () => {
  const m = mgr(workspace());
  try {
    const { id } = m.open({ title: 'agent' });
    await m.ready(id);
    const ok = await m.run(id, 'echo hello; echo world');
    assert.equal(ok.exitCode, 0);
    assert.equal(ok.output, 'hello\nworld');
    assert.ok(!ok.output.includes('__AICL'));
    const bad = await m.run(id, 'echo oops; exit_code_test() { return 7; }; exit_code_test');
    assert.equal(bad.exitCode, 7);
    assert.equal(bad.output, 'oops');
    // The user sees the same shell state: cwd and variables persist between runs.
    await m.run(id, 'cd /tmp && FOO=bar');
    assert.equal((await m.run(id, 'echo $FOO; pwd -P')).output, `bar\n${realpathSync('/tmp')}`);
  } finally {
    m.dispose();
  }
});

test('terminal_run: timeout returns partial output and keeps the command running', async () => {
  const m = mgr(workspace());
  try {
    const { id } = m.open();
    await m.ready(id);
    const r = await m.run(id, 'echo start; sleep 3', { timeoutMs: 1000 });
    assert.equal(r.timedOut, true);
    assert.equal(r.exitCode, null);
    assert.match(r.output, /start/);
  } finally {
    m.dispose();
  }
});

test('terminal_read returns recent output; user input shows up too', async () => {
  const m = mgr(workspace());
  try {
    const { id } = m.open();
    await m.ready(id);
    m.write(id, 'echo typed-by-user\r');
    await new Promise((r) => setTimeout(r, 500));
    assert.match(m.read(id, 20)!, /typed-by-user/);
    assert.equal(m.read('nope'), undefined);
  } finally {
    m.dispose();
  }
});

test('scrollback is capped by lines and bytes', async () => {
  const m = mgr(workspace(), { maxLines: 50, maxBytes: 100_000 });
  try {
    const { id } = m.open();
    await m.ready(id);
    const r = await m.run(id, 'i=0; while [ $i -lt 300 ]; do echo line-$i; i=$((i+1)); done', { maxChars: 100_000 });
    assert.equal(r.exitCode, 0);
    const text = stripAnsi(m.scrollback(id)!);
    const lines = text.split('\n');
    assert.ok(lines.length <= 52, `kept ${lines.length} lines`);
    assert.ok(text.includes('line-299'));
    assert.ok(!text.includes('line-10\n'));
  } finally {
    m.dispose();
  }
  const small = mgr(workspace(), { maxLines: 100_000, maxBytes: 2000 });
  try {
    const { id } = small.open();
    await small.ready(id);
    await small.run(id, 'i=0; while [ $i -lt 400 ]; do echo padding-padding-$i; i=$((i+1)); done', { maxChars: 100_000 });
    assert.ok(small.scrollback(id)!.length <= 2000);
  } finally {
    small.dispose();
  }
});

test('scrollback persists to .aicl/terminals and reloads in a new manager', async () => {
  const ws = workspace();
  const a = mgr(ws);
  const { id } = a.open();
  await a.ready(id);
  await a.run(id, 'echo remembered-output');
  a.dispose(); // flushes the log and kills the pty
  const file = path.join(ws, '.aicl', 'terminals', `${id}.log`);
  assert.ok(existsSync(file));
  assert.match(readFileSync(file, 'utf8'), /remembered-output/);
  const b = mgr(ws);
  assert.match(b.scrollback(id)!, /remembered-output/);
  assert.equal(b.scrollback('t-missing'), undefined);
  await b.close(id); // closing on purpose forgets the log
  assert.ok(!existsSync(file));
  b.dispose();
});

test('close kills the pty and attach replays then streams', async () => {
  const closed: string[] = [];
  const m = mgr(workspace(), { onClosed: (id) => closed.push(id) });
  const { id } = m.open();
  await m.ready(id);
  await m.run(id, 'echo before-attach');
  let replay = '';
  let live = '';
  const detach = m.attach(id, { replay: (d) => (replay = d), output: (d) => (live += d), exit() {} })!;
  assert.match(replay, /before-attach/);
  await m.run(id, 'echo after-attach');
  assert.match(live, /after-attach/);
  detach();
  await m.close(id);
  assert.deepEqual(closed, [id]);
  assert.equal(m.get(id), undefined);
  m.dispose();
});
