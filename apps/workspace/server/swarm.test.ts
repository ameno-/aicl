import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { MAX_AGENT_DEPTH, MAX_CONCURRENT_CHILDREN, type SwarmEvent } from '../shared/swarm.ts';
import { createSessionHub, stepLabel, type AgentLike } from './sessions.ts';
import { createSwarmLogic } from './swarm.ts';
import { layoutRun, statusOf } from './swarm/canvas.ts';

/** Agents whose prompt() stays open until the test finishes it, keyed by the task text. */
function setup(dir: string) {
  const open = new Map<string, { finish(reply: string): void; agent: AgentLike & { aborted: boolean; steered: string[] } }>();
  const createAgent = async (): Promise<AgentLike> => {
    const listeners = new Set<(e: unknown) => void>();
    const history: unknown[] = [];
    const emit = (e: unknown) => [...listeners].forEach((l) => l(e));
    const agent: AgentLike & { aborted: boolean; steered: string[] } = {
      messages: history,
      isStreaming: false,
      aborted: false,
      steered: [],
      subscribe(l) {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      async prompt(text) {
        const key = text.split('\n\n<canvas-context>')[0]!;
        history.push({ role: 'user', content: [{ type: 'text', text }] });
        emit({ type: 'agent_start' });
        emit({ type: 'tool_execution_start', toolName: 'read', args: { path: 'a.ts' } });
        await new Promise<void>((resolve) => {
          open.set(key, {
            agent,
            finish(reply) {
              history.push({ role: 'assistant', content: [{ type: 'text', text: reply }] });
              emit({ type: 'message_end', message: { role: 'assistant', usage: { input: 100, output: 20, cost: { total: 0.01 } } } });
              open.delete(key);
              resolve();
            },
          });
          agent.abort = async () => {
            agent.aborted = true;
            open.delete(key);
            resolve();
          };
        });
      },
      abort: async () => {},
      async steer(text) {
        agent.steered.push(text);
      },
    };
    return agent;
  };
  return { open, createAgent };
}

async function build() {
  const dir = await mkdtemp(path.join(tmpdir(), 'aicl-swarm-'));
  const fake = setup(dir);
  const hub = await createSessionHub({ dir, createAgent: fake.createAgent });
  const events: SwarmEvent[] = [];
  const logic = createSwarmLogic({ hub: () => hub, emit: (e) => events.push(e) });
  return { dir, hub, logic, events, ...fake };
}

const tick = () => new Promise((r) => setTimeout(r, 20));
const spawnParams = (name: string, task = `do ${name}`) => ({ name, role: `role of ${name}`, task, wait: false });

test('lineage, role, task and usage persist across a hub reload', async () => {
  const { dir, hub, logic, open } = await build();
  const text = await logic.spawn('main', spawnParams('Pro'));
  const id = /id (\w+)/.exec(text)![1]!;
  await tick();
  open.get('do Pro')!.finish('pro reply');
  await logic.wait('main', [id]);
  await hub.flush();

  const again = await createSessionHub({ dir, createAgent: setup(dir).createAgent });
  const child = again.get(id)!;
  assert.equal(child.parentId, 'main');
  assert.equal(child.rootId, 'main');
  assert.equal(child.spawnedBy, 'agent');
  assert.equal(child.role, 'role of Pro');
  assert.equal(child.task, 'do Pro');
  assert.equal(child.kind, 'node');
  assert.deepEqual(child.usage, { inputTokens: 100, outputTokens: 20, costUsd: 0.01 });
  assert.ok(child.startedAt && child.finishedAt);
  assert.deepEqual(again.children('main').map((c) => c.id), [id]);
});

test('usage sums over assistant messages and currentStep follows the tool call', async () => {
  const { hub, logic, open } = await build();
  const id = /id (\w+)/.exec(await logic.spawn('main', spawnParams('A')))![1]!;
  await tick();
  assert.equal(hub.get(id)!.status, 'running');
  assert.equal(hub.get(id)!.currentStep, 'read: a.ts');
  open.get('do A')!.finish('one');
  await logic.wait('main', [id]);
  // a second run on the same session adds to the first
  assert.equal(await logic.message('main', id, 'again'), 'started');
  await tick();
  open.get('again')!.finish('two');
  await logic.wait('main', [id]);
  assert.deepEqual(hub.get(id)!.usage, { inputTokens: 200, outputTokens: 40, costUsd: 0.02 });
  assert.equal(hub.get(id)!.currentStep, undefined);
  assert.equal(stepLabel('bash', { command: 'npm   test' }), 'bash: npm test');
});

test('fan-out runs in parallel and agent_wait joins them all', async () => {
  const { hub, logic, open, events } = await build();
  const ids: string[] = [];
  for (const n of ['Pro', 'Con', 'Data']) ids.push(/id (\w+)/.exec(await logic.spawn('main', spawnParams(n)))![1]!);
  await tick();
  assert.equal(ids.filter((id) => hub.isBusy(id)).length, 3, 'all three run at once');
  const waiting = logic.wait('main', ids);
  open.get('do Con')!.finish('against');
  open.get('do Pro')!.finish('for');
  let done = false;
  void waiting.then(() => (done = true));
  await tick();
  assert.equal(done, false, 'still waiting for Data');
  open.get('do Data')!.finish('3 stats');
  const out = await waiting;
  for (const piece of ['[Pro]', 'for', '[Con]', 'against', '[Data]', '3 stats']) assert.ok(out.includes(piece), piece);
  assert.deepEqual(events.map((e) => e.type), ['spawn', 'spawn', 'spawn', 'result', 'result', 'result']);
});

test('spawn with wait returns the reply', async () => {
  const { logic, open } = await build();
  const pending = logic.spawn('main', { name: 'Solo', role: 'r', task: 'solo task' });
  await tick();
  open.get('solo task')!.finish('solo reply');
  assert.match(await pending, /\[Solo\].*done:\nsolo reply/s);
});

test('depth and concurrency limits give clear errors', async () => {
  const { hub, logic, open } = await build();
  // depth: main -> d1 -> d2 -> d3; d3 may not spawn
  let parent = 'main';
  for (let d = 1; d <= MAX_AGENT_DEPTH; d++) {
    const id = /id (\w+)/.exec(await logic.spawn(parent, spawnParams(`d${d}`)))![1]!;
    parent = id;
  }
  await assert.rejects(logic.spawn(parent, spawnParams('too deep')), /Depth limit/);
  for (const k of [...open.keys()]) open.get(k)!.finish('x');
  await tick();

  // concurrency: 3 are done; fill up to the limit under main, the next one fails
  const fresh = await build();
  for (let i = 0; i < MAX_CONCURRENT_CHILDREN; i++) await fresh.logic.spawn('main', spawnParams(`c${i}`));
  await tick();
  await assert.rejects(fresh.logic.spawn('main', spawnParams('one more')), /Too many sub-agents running \(6 of 6\)/);
  // a finished child frees a slot
  fresh.open.get('do c0')!.finish('ok');
  await tick();
  await fresh.logic.spawn('main', spawnParams('now fits'));
});

test('stopping a root stops its running children, and wait reports them stopped', async () => {
  const { hub, logic, open, events } = await build();
  // the root itself is running a turn
  hub.reserve('main');
  const rootRun = (async () => {
    for await (const _ of hub.run('main', 'root turn', new AbortController().signal)) void _;
  })();
  await tick();
  const a = /id (\w+)/.exec(await logic.spawn('main', spawnParams('A')))![1]!;
  const b = /id (\w+)/.exec(await logic.spawn('main', spawnParams('B')))![1]!;
  await tick();
  open.get('do B')!.finish('B done');
  await tick();
  assert.equal(hub.isBusy(a), true);

  await hub.stop('main');
  await rootRun;
  const out = await logic.wait('main', [a, b]);
  assert.match(out, /\[A\].*stopped/);
  assert.match(out, /\[B\].*done:\nB done/s);
  assert.equal(hub.get(a)!.stopped, true);
  assert.equal(hub.get(b)!.stopped, undefined);
  assert.ok(events.some((e) => e.type === 'result' && e.status === 'stopped'));
});

test('agent_stop and agent_message only reach your own sub-agents; messages steer or restart', async () => {
  const { hub, logic, open } = await build();
  const a = /id (\w+)/.exec(await logic.spawn('main', spawnParams('A')))![1]!;
  const other = await hub.create({ title: 'Other' });
  await tick();
  await assert.rejects(logic.stop('main', other.id), /not one of your sub-agents/);
  await assert.rejects(logic.message('main', other.id, 'hi'), /not one of your sub-agents/);
  assert.equal(await logic.message('main', a, 'focus on X'), 'steered');
  assert.deepEqual(((await hub.agent(a)) as unknown as { steered: string[] }).steered, ['focus on X']);
  await logic.stop('main', a);
  const out = await logic.wait('main', [a]);
  assert.match(out, /stopped/);
  assert.equal(open.size, 0);
  assert.match(logic.status('main'), /- A \(\w+\) \[stopped/);
});

test('layoutRun lays children out as a tree under the root', () => {
  const t = 10_000;
  const base = { updatedAt: t, status: 'idle' as const, kind: 'node' as const };
  const root = { ...base, id: 'main', title: 'Main', createdAt: 0, kind: 'chat' as const, startedAt: t };
  const kid = (id: string, parentId: string, createdAt: number) => ({ ...base, id, title: id, parentId, rootId: 'main', createdAt, task: `task ${id}` });
  const run = layoutRun(root, [kid('a', 'main', t), kid('b', 'main', t + 1), kid('a1', 'a', t + 2), kid('old', 'main', 5)], true);
  assert.equal(run.create, true);
  assert.equal(run.frameId, 'run-main-10000');
  assert.deepEqual(run.nodes.map((n) => n.id), ['rt-main', 'ag-a', 'ag-a1', 'ag-b']);
  const at = Object.fromEntries(run.nodes.map((n) => [n.id, n]));
  assert.equal(at['ag-a']!.parent, 'rt-main');
  assert.equal(at['ag-a1']!.parent, 'ag-a');
  assert.ok(at['ag-a1']!.y > at['ag-a']!.y && at['ag-a']!.y > at['rt-main']!.y);
  assert.ok(at['ag-b']!.x > at['ag-a']!.x);
  assert.equal(at['ag-a']!.label, undefined, 'arrows stay unlabelled so side-by-side labels cannot overlap');
  assert.match(at['ag-a']!.role ?? '', /task a/);
  assert.equal(statusOf({ ...root, status: 'running' }), 'running');
});

test('agents view tree and aggregates', async () => {
  const { buildRows, aggregate, formatElapsed } = await import('../web/swarm/tree.ts');
  const s = (id: string, extra: object = {}) => ({ id, title: id, createdAt: 1, updatedAt: 1, status: 'idle' as const, kind: 'node' as const, ...extra });
  const list = [s('solo', { updatedAt: 9 }), s('main', { status: 'running' }), s('a', { parentId: 'main', usage: { inputTokens: 5, outputTokens: 2, costUsd: 0.5 } }), s('b', { parentId: 'a', createdAt: 3 })];
  assert.deepEqual(buildRows(list).map((r) => `${r.session.id}:${r.depth}`), ['main:0', 'a:1', 'b:2', 'solo:0']);
  const t = aggregate(list);
  assert.deepEqual([t.running, t.agents, t.total, t.inputTokens, t.costUsd], [1, 2, 4, 5, 0.5]);
  assert.equal(formatElapsed(65_000), '1m 05s');
});
