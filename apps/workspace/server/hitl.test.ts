import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HitlRequest } from '../shared/agentic.ts';
import { createRegistry, describeAnswer, isFreeWrite, needsApproval, summarizeCall } from './hitl.ts';

const question = (id = 'q1'): Extract<HitlRequest, { kind: 'question' }> => ({
  kind: 'question',
  id,
  sessionId: 'main',
  question: 'Theme?',
  options: [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ],
  createdAt: 1,
});
const approval = (id = 'a1'): HitlRequest => ({ kind: 'approval', id, sessionId: 'main', tool: 'bash', summary: 'Run `ls`', input: {}, createdAt: 1 });

test('registry: pending, broadcast, and answer resolves the waiting promise', async () => {
  const events: unknown[] = [];
  const registry = createRegistry((e) => events.push(e));
  const waiting = registry.ask(question());
  assert.equal(registry.pending().length, 1);
  assert.equal(registry.answer('q1', { kind: 'question', optionIds: ['dark'] }), true);
  assert.deepEqual(await waiting, { kind: 'question', optionIds: ['dark'] });
  assert.equal(registry.pending().length, 0);
  assert.deepEqual(events.map((e) => (e as { type: string }).type), ['hitl', 'hitl-resolved']);
});

test('registry: answered requests are kept, seeded, and saved', async () => {
  const saved: unknown[] = [];
  const earlier = { request: approval('old'), answer: { kind: 'approval' as const, approved: true } };
  const registry = createRegistry(() => {}, { initial: [earlier], save: (list) => saved.push(list) });
  const waiting = registry.ask(question());
  registry.answer('q1', { kind: 'question', optionIds: ['dark'] });
  await waiting;
  assert.deepEqual(registry.resolved().map((r) => r.request.id), ['old', 'q1']);
  assert.equal(saved.length, 1);
});

test('registry: unknown ids and mismatched kinds are rejected', async () => {
  const registry = createRegistry(() => {});
  const waiting = registry.ask(approval());
  assert.equal(registry.answer('nope', { kind: 'approval', approved: true }), false);
  assert.equal(registry.answer('a1', { kind: 'question', optionIds: [] }), false);
  assert.equal(registry.pending().length, 1);
  registry.answer('a1', { kind: 'approval', approved: false, note: 'not now' });
  assert.deepEqual(await waiting, { kind: 'approval', approved: false, note: 'not now' });
  assert.equal(registry.answer('a1', { kind: 'approval', approved: true }), false);
});

test('registry: abort resolves as cancelled and broadcasts hitl-resolved', async () => {
  const events: Array<{ type: string }> = [];
  const registry = createRegistry((e) => events.push(e));
  const controller = new AbortController();
  const waiting = registry.ask(question(), controller.signal);
  controller.abort();
  assert.equal(await waiting, null);
  assert.equal(registry.pending().length, 0);
  assert.equal(events.at(-1)?.type, 'hitl-resolved');
  // Already-aborted signals cancel immediately.
  assert.equal(await registry.ask(question('q2'), controller.signal), null);
});

test('path rule: only .aicl/ is free', () => {
  const ws = '/tmp/ws';
  assert.equal(isFreeWrite(ws, '.aicl/applets/a.tsx'), true);
  assert.equal(isFreeWrite(ws, '/tmp/ws/.aicl/x.ts'), true);
  assert.equal(isFreeWrite(ws, 'notes/todo.md'), false);
  assert.equal(isFreeWrite(ws, '.aicl'), false);
  assert.equal(isFreeWrite(ws, '.aicl-evil/x'), false);
  assert.equal(isFreeWrite(ws, '.aicl/../src/a.ts'), false);
  assert.equal(isFreeWrite(ws, '/etc/passwd'), false);
  assert.equal(isFreeWrite(ws, ''), false);
});

test('needsApproval: bash always, write/edit outside .aicl/, reads never', () => {
  const ws = '/tmp/ws';
  assert.equal(needsApproval(ws, 'bash', { command: 'ls' }), true);
  assert.equal(needsApproval(ws, 'write', { path: 'a.ts', content: '' }), true);
  assert.equal(needsApproval(ws, 'write', { path: '.aicl/applets/a.tsx', content: '' }), false);
  assert.equal(needsApproval(ws, 'edit', { path: 'src/a.ts', edits: [] }), true);
  assert.equal(needsApproval(ws, 'read', { path: 'a.ts' }), false);
  assert.equal(needsApproval(ws, 'scratch_add', {}), false);
});

test('summaries and answer text', () => {
  assert.equal(summarizeCall('bash', { command: 'npm   test' }), 'Run `npm test`');
  assert.equal(summarizeCall('write', { path: 'src/app.ts', content: 'a\nb\nc\n' }), 'Write src/app.ts (3 lines)');
  assert.equal(summarizeCall('write', { path: 'x', content: 'one' }), 'Write x (1 line)');
  assert.equal(summarizeCall('edit', { path: 'x', edits: [{}, {}] }), 'Edit x (2 changes)');
  const q = question();
  assert.equal(describeAnswer(q, { kind: 'question', optionIds: ['dark'] }), 'The user chose: Dark.');
  assert.match(describeAnswer(q, { kind: 'question', optionIds: [], text: 'sepia' }), /sepia/);
  assert.match(describeAnswer(q, null), /dismissed/);
});
