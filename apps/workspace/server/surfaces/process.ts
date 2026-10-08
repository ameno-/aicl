/**
 * Surface service: process (shared/surfaces.ts). Long-running commands (dev
 * servers, watchers) the agent starts and the user watches, stops and restarts.
 * Ports the process listens on are detected so they open in the browser surface.
 */
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { SurfaceInfo } from '../../shared/surfaces.ts';
import type { FeatureModule } from '../feature.ts';
import { json } from '../http.ts';
import { requestApproval } from '../hitl.ts';
import { sessionIdFromToolContext } from '../session-context.ts';
import type { SurfaceContext } from './context.ts';
import { createProcessManager, type ProcessInfo, type ProcessManager } from './process/manager.ts';

const PROMPT = `Processes:
- Start dev servers, watchers and anything else that never exits with process_start, NOT bash or terminal_run (those block until the command ends). It needs the user's approval, then runs in the background; the result lists the ports it listens on. Then check the app with the browser (browser_open on http://localhost:<port>). process_logs reads its output, process_list shows what runs, process_stop ends one. Show it on the canvas with the "surface" component: { kind: "process", id }.`;

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }], details: {} });

export function processSurfaceOf(info: ProcessInfo, owner: { openedBy: 'user' | 'agent'; sessionId?: string }): Omit<SurfaceInfo, 'createdAt' | 'updatedAt'> {
  const state =
    info.status === 'running'
      ? info.ports.length
        ? `running · ${info.ports.map((p) => `:${p}`).join(' ')}`
        : 'running'
      : `exited (${info.exitCode ?? '?'})`;
  return {
    kind: 'process',
    id: info.id,
    title: info.name,
    summary: state,
    status: info.status === 'running' ? 'busy' : info.exitCode && !info.stopped ? 'error' : 'done',
    openedBy: owner.openedBy,
    ...(owner.sessionId ? { sessionId: owner.sessionId } : {}),
    meta: {
      pid: info.pid,
      ports: info.ports,
      status: info.status,
      exitCode: info.exitCode ?? null,
      startedAt: info.startedAt,
      ...(info.endedAt ? { endedAt: info.endedAt } : {}),
      command: info.command,
      cwd: info.cwd,
    },
  };
}

const describe = (i: ProcessInfo) =>
  `${i.id} "${i.name}" ${i.status === 'running' ? 'running' : `exited (${i.exitCode ?? '?'})`}${i.ports.length ? ` ports ${i.ports.join(', ')}` : ''} — ${i.command}`;

export function createProcessSurface(context: SurfaceContext, injected?: { manager?: ProcessManager }): FeatureModule {
  const { surfaces } = context;
  const owners = new Map<string, { openedBy: 'user' | 'agent'; sessionId?: string }>();
  const manager =
    injected?.manager ??
    createProcessManager({
      workspace: context.workspace,
      onChange: (info) => surfaces.upsert(processSurfaceOf(info, owners.get(info.id) ?? { openedBy: 'user' })),
      onClosed: (id) => {
        owners.delete(id);
        surfaces.remove('process', id);
      },
    });

  surfaces.onClose('process', (id) => manager.close(id));
  // A dev server must not outlive the workspace that started it.
  process.once('exit', () => manager.dispose());
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      manager.dispose();
      process.exit(0);
    });
  }

  const resolve = (ref: string) => manager.find(ref);

  const start = defineTool({
    name: 'process_start',
    label: 'Start process',
    description:
      'Start a long-running command (dev server, watcher, anything that does not exit) in the background and return at once with its id and the ports it listens on. Needs the user\'s approval, like bash. Use this instead of bash/terminal_run for servers.',
    parameters: Type.Object({
      command: Type.String(),
      name: Type.Optional(Type.String({ description: 'Short label, e.g. "web dev server".' })),
      cwd: Type.Optional(Type.String({ description: 'Directory relative to the workspace (default: the workspace).' })),
    }),
    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      const sessionId = sessionIdFromToolContext(ctx);
      const flat = params.command.replace(/\s+/g, ' ').trim();
      const answer = await requestApproval(
        { sessionId, toolCallId, tool: 'process_start', summary: `Start \`${flat.length > 100 ? `${flat.slice(0, 99)}…` : flat}\` as a background process`, input: params },
        signal,
      );
      if (!answer.approved) return text(`The user declined: ${answer.note?.trim() || 'no reason given'}`);
      const id = `p-${Math.random().toString(16).slice(2, 10)}`;
      owners.set(id, { openedBy: 'agent', sessionId });
      const started = manager.start({ ...params, id });
      const info = (await manager.waitForPort(started.id, 5000)) ?? started;
      const tail = manager.logs(info.id, 15) ?? '';
      const head = info.status === 'exited' ? `Exited at once (code ${info.exitCode ?? '?'}).` : info.ports.length ? `Running, listening on port ${info.ports.join(', ')}.` : 'Running (no listening port detected yet; process_list shows ports once they appear).';
      return text(`${head} Process ${info.id}.\n${tail}`);
    },
  });

  const list = defineTool({
    name: 'process_list',
    label: 'List processes',
    description: 'List background processes started with process_start (id, status, ports, command).',
    parameters: Type.Object({}),
    async execute() {
      const all = manager.list();
      return text(all.length ? all.map(describe).join('\n') : 'No processes.');
    },
  });

  const stop = defineTool({
    name: 'process_stop',
    label: 'Stop process',
    description: 'Stop a background process (and its children) by id or name.',
    parameters: Type.Object({ id: Type.String({ description: 'Process id or name.' }) }),
    async execute(_id, params) {
      const found = resolve(params.id);
      if (!found) return text(`No process ${params.id}.`);
      const info = await manager.stop(found.id);
      return text(info ? `Stopped. ${describe(info)}` : `No process ${params.id}.`);
    },
  });

  const logs = defineTool({
    name: 'process_logs',
    label: 'Process logs',
    description: 'Read the most recent output of a background process.',
    parameters: Type.Object({
      id: Type.String({ description: 'Process id or name.' }),
      lines: Type.Optional(Type.Number({ description: 'Trailing lines (default 50, max 500).' })),
    }),
    async execute(_id, params) {
      const found = resolve(params.id);
      const out = found ? manager.logs(found.id, Math.min(params.lines ?? 50, 500)) : undefined;
      return text(out === undefined ? `No process ${params.id}.` : out || '(no output yet)');
    },
  });

  return {
    routes: {
      'GET /api/surfaces/process/:id/logs': (_req, res, { url, params }) => {
        const out = manager.logs(params['id']!, Math.min(Number(url.searchParams.get('lines') ?? 300) || 300, 2000));
        if (out === undefined) return json(res, 404, { message: 'no such process' });
        json(res, 200, { id: params['id'], data: out });
      },
      'POST /api/surfaces/process/:id/stop': async (_req, res, { params }) => {
        const info = await manager.stop(params['id']!);
        json(res, info ? 200 : 404, info ? { process: info } : { message: 'no such process' });
      },
      'POST /api/surfaces/process/:id/restart': async (_req, res, { params }) => {
        const info = await manager.restart(params['id']!);
        json(res, info ? 200 : 404, info ? { process: info } : { message: 'no such process' });
      },
    },
    tools: [start, list, stop, logs],
    prompt: PROMPT,
  };
}
