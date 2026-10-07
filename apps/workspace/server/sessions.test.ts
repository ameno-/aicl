import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { StreamEvent } from '@aicl/core';
import {
  convertHistory,
  createSessionHub,
  previewOf,
  SessionError,
  stripCanvasContext,
  type AgentLike,
} from './sessions.ts';

const user = (text: string) => ({ role: 'user', content: [{ type: 'text', text }], timestamp: 1 });
const assistant = (...content: unknown[]) => ({ role: 'assistant', content, timestamp: 2 });

test('convertHistory maps text, reasoning and tool calls with status from results', () => {
  const messages = convertHistory(
    [
      user('draw a box\n\n<canvas-context>\nselected: a\n</canvas-context>'),
      assistant({ type: 'thinking', thinking: 'hmm' }, { type: 'toolCall', id: 't1', name: 'scratch_add', arguments: { id: 'a' } }),
      { role: 'toolResult', toolCallId: 't1', isError: false, content: [] },
      assistant({ type: 'toolCall', id: 't2', name: 'scratch_read', arguments: {} }),
      { role: 'toolResult', toolCallId: 't2', isError: true, content: [] },
      assistant({ type: 'text', text: 'Done.' }),
      user('thanks'),
    ],
    's',
  );

  assert.equal(messages.length, 3);
  assert.deepEqual(messages[0]!.parts, [{ type: 'text', text: 'draw a box' }]);
  // One prompt = one assistant message, like the live stream.
  const parts = messages[1]!.parts;
  assert.deepEqual(parts.map((p) => p.type), ['reasoning', 'tool-call', 'tool-call', 'text']);
  assert.equal((parts[1] as { status: string }).status, 'success');
  assert.equal((parts[2] as { status: string }).status, 'error');
  assert.equal(messages[2]!.role, 'user');
  assert.equal(new Set(messages.map((m) => m.id)).size, 3);
});

test('stripCanvasContext removes the hidden block only', () => {
  assert.equal(stripCanvasContext('hello\n\n<canvas-context>\ncontext (x):\nline\n</canvas-context>'), 'hello');
  assert.equal(stripCanvasContext('plain'), 'plain');
});

test('previewOf takes the last assistant text, trimmed', () => {
  assert.equal(previewOf([assistant({ type: 'text', text: 'first' }), assistant({ type: 'text', text: 'x'.repeat(200) })])?.length, 80);
  assert.equal(previewOf([user('q')]), undefined);
});

function fakeAgent(file: string | undefined, history: unknown[] = []): AgentLike & { prompts: string[] } {
  const listeners = new Set<(e: unknown) => void>();
  const prompts: string[] = [];
  const agent = {
    messages: history,
    isStreaming: false,
    sessionFile: file,
    prompts,
    subscribe(l: (e: unknown) => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    async prompt(text: string) {
      prompts.push(text);
      history.push(user(text), assistant({ type: 'text', text: `echo ${text}` }));
      for (const l of listeners) l({ type: 'agent_start' });
    },
    async abort() {},
  };
  return agent;
}

async function drain(gen: AsyncGenerator<StreamEvent>): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

test('hub persists its index, titles from the first message, and reloads', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'aicl-sessions-'));
  const seen: string[] = [];
  const agents = new Map<string, ReturnType<typeof fakeAgent>>();
  let n = 0;
  const make = () =>
    createSessionHub({
      dir,
      createAgent: async (file) => {
        const f = file ?? path.join(dir, `s${n++}.jsonl`);
        // Pi writes the transcript after the first reply; the hub only reopens files that exist.
        await writeFile(f, '');
        const a = agents.get(f) ?? fakeAgent(f);
        agents.set(f, a);
        return a;
      },
      onChange: (s) => seen.push(`${s.id}:${s.status}`),
    });

  const hub = await make();
  assert.deepEqual(hub.list().map((s) => s.id), ['main']);
  await assert.rejects(hub.remove('main'), SessionError);

  const created = await hub.create();
  assert.equal(created.title, 'New chat');

  hub.reserve(created.id);
  assert.throws(() => hub.reserve(created.id), (e) => e instanceof SessionError && e.status === 409);
  const events = await drain(hub.run(created.id, 'Reply with exactly: two\n\n<canvas-context>\nselected: a\n</canvas-context>', new AbortController().signal));
  assert.ok(events.some((e) => e.type === 'message-end'));
  assert.equal(hub.isBusy(created.id), false);
  assert.equal(hub.get(created.id)!.title, 'Reply with exactly: two');
  assert.equal(hub.get(created.id)!.status, 'idle');
  assert.equal(hub.get(created.id)!.preview, 'echo Reply with exactly: two\n\n<canvas-context>\nselected: a\n</canvas-context>'.replace(/\s+/g, ' '));
  assert.ok(seen.includes(`${created.id}:running`));

  await hub.rename(created.id, 'Mine');
  await hub.flush();

  const index = JSON.parse(await readFile(path.join(dir, 'index.json'), 'utf8')) as { sessions: Array<{ id: string; title: string; file?: string }> };
  const saved = index.sessions.find((s) => s.id === created.id)!;
  assert.equal(saved.title, 'Mine');
  assert.ok(saved.file?.endsWith('.jsonl'));

  // A second hub on the same directory sees the same sessions; history comes from the agent.
  const again = await make();
  assert.deepEqual(again.list().map((s) => s.id).sort(), ['main', created.id].sort());
  const history = await again.messages(created.id);
  assert.equal(history[0]!.parts[0]!.type, 'text');
  assert.equal((history[0]!.parts[0] as { text: string }).text, 'Reply with exactly: two');

  await again.remove(created.id);
  assert.deepEqual(again.list().map((s) => s.id), ['main']);
});

test('an errored run marks the session error', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'aicl-sessions-'));
  const hub = await createSessionHub({
    dir,
    createAgent: async () => ({
      ...fakeAgent(undefined),
      prompt: async () => {
        throw new Error('boom');
      },
    }),
  });
  hub.reserve('main');
  const events = await drain(hub.run('main', 'hi', new AbortController().signal));
  assert.ok(events.some((e) => e.type === 'error'));
  assert.equal(hub.get('main')!.status, 'error');
});
