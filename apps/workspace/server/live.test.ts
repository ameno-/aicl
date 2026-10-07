import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createLive, newText, MAX_TERMINAL_LINES } from './live.ts';
import type { FeatureContext } from './feature.ts';

async function setup() {
  const workspace = await mkdtemp(path.join(tmpdir(), 'aicl-live-'));
  const sent: any[] = [];
  const context = { workspace, relay: { broadcast: (p: unknown) => sent.push(p) } } as unknown as FeatureContext;
  const live = createLive(context);
  return { workspace, sent, live };
}

const run = (live: ReturnType<typeof createLive>, params: unknown) =>
  (live.tools[0] as any).execute('id', params, undefined, undefined, undefined);

const get = async (live: ReturnType<typeof createLive>, route: string, params: Record<string, string>) => {
  let body = '';
  const res = { writeHead() {}, end: (b: string) => (body = b) } as any;
  await live.routes[route]!({} as any, res, { url: new URL('http://x'), params });
  return JSON.parse(body);
};

test('plan_update replaces the plan, keeps ids stable by label, persists, broadcasts', async () => {
  const { workspace, sent, live } = await setup();
  await run(live, { title: 'T', steps: [{ label: 'a', status: 'running' }, { label: 'b', status: 'pending' }] });
  const first = (await get(live, 'GET /api/sessions/:id/plan', { id: 'main' })).plan;
  assert.equal(first.steps.length, 2);
  const [a, b] = first.steps;
  const result = await run(live, { steps: [{ label: 'b', status: 'pending' }, { label: 'a', status: 'done' }, { label: 'c', status: 'pending' }] });
  assert.match(result.content[0].text, /\[x\]/);
  const second = (await get(live, 'GET /api/sessions/:id/plan', { id: 'main' })).plan;
  assert.deepEqual(second.steps.map((s: any) => s.id).slice(0, 2), [b.id, a.id]);
  assert.equal(new Set(second.steps.map((s: any) => s.id)).size, 3);
  assert.equal(sent.filter((e) => e.type === 'plan').length, 2);
  const onDisk = JSON.parse(await readFile(path.join(workspace, '.aicl', 'plans', 'main.json'), 'utf8'));
  assert.equal(onDisk.steps.length, 3);
  // a fresh module (restart) reads it back
  const again = createLive({ workspace, relay: { broadcast() {} } } as unknown as FeatureContext);
  assert.equal((await get(again, 'GET /api/sessions/:id/plan', { id: 'main' })).plan.steps.length, 3);
});

test('newText diffs rolling snapshots', () => {
  assert.equal(newText('a\nb\n', 'a\nb\nc\n'), 'c\n');
  assert.equal(newText('', 'x'), 'x');
  assert.equal(newText('a\nb\nc\n', 'b\nc\nd\n'), 'd\n');
  assert.equal(newText('abc', ''), '');
});

test('bash events become terminal chunks with only new text', async () => {
  const { sent, live } = await setup();
  const ev = (e: object) => live.onAgentEvent!('s1', { toolName: 'bash', toolCallId: 't1', ...e });
  const part = (text: string) => ({ content: [{ type: 'text', text }] });
  ev({ type: 'tool_execution_start', args: { command: 'echo hi' } });
  ev({ type: 'tool_execution_update', partialResult: part('') });
  ev({ type: 'tool_execution_update', partialResult: part('tick 1\n') });
  ev({ type: 'tool_execution_update', partialResult: part('tick 1\ntick 2\n') });
  ev({ type: 'tool_execution_end', isError: false, result: part('tick 1\ntick 2\ntick 3') });
  const chunks = sent.filter((e) => e.type === 'terminal').map((e) => e.chunk);
  assert.deepEqual(chunks.map((c) => c.text), ['', 'tick 1\n', 'tick 2\n', 'tick 3']);
  assert.equal(chunks[0].command, 'echo hi');
  assert.equal(chunks.at(-1).done, true);
  assert.equal(chunks.at(-1).exitCode, 0);
  const t = await get(live, 'GET /api/sessions/:id/terminal/:toolId', { id: 's1', toolId: 'latest' });
  assert.deepEqual(t.lines, ['tick 1', 'tick 2', 'tick 3']);
  assert.equal(t.done, true);
});

test('failed command reports its exit code; non-bash events are ignored', async () => {
  const { sent, live } = await setup();
  live.onAgentEvent!('s1', { type: 'tool_execution_start', toolName: 'read', toolCallId: 'r' });
  live.onAgentEvent!('s1', { type: 'tool_execution_start', toolName: 'bash', toolCallId: 't' });
  live.onAgentEvent!('s1', {
    type: 'tool_execution_end',
    toolName: 'bash',
    toolCallId: 't',
    isError: true,
    result: { content: [{ type: 'text', text: 'oops\n\nCommand exited with code 3' }] },
  });
  const chunks = sent.map((e) => e.chunk);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[1].exitCode, 3);
  assert.equal(chunks[1].text, 'oops');
});

test('terminal keeps only the last lines', async () => {
  const { live } = await setup();
  const lines = Array.from({ length: MAX_TERMINAL_LINES + 50 }, (_, i) => `l${i}`);
  live.onAgentEvent!('s1', { type: 'tool_execution_start', toolName: 'bash', toolCallId: 't' });
  live.onAgentEvent!('s1', {
    type: 'tool_execution_update',
    toolName: 'bash',
    toolCallId: 't',
    partialResult: { content: [{ type: 'text', text: lines.join('\n') + '\n' }] },
  });
  const t = await get(live, 'GET /api/sessions/:id/terminal/:toolId', { id: 's1', toolId: 't' });
  assert.equal(t.lines.length, MAX_TERMINAL_LINES);
  assert.equal(t.lines.at(-1), `l${MAX_TERMINAL_LINES + 49}`);
  assert.equal(t.lines[0], 'l50');
});
