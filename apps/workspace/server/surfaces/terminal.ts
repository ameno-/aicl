/**
 * Surface service: terminal (shared/surfaces.ts). Real ptys the user types in
 * (WebSocket /ws/terminal/:id) and the agent drives (terminal_open / _run /
 * _read), so both work in the same visible shell.
 */
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { WebSocketServer, type WebSocket } from 'ws';
import type { FeatureModule } from '../feature.ts';
import { json, readJson } from '../http.ts';
import { sessionIdFromToolContext } from '../session-context.ts';
import type { SurfaceInfo } from '../../shared/surfaces.ts';
import type { SurfaceContext } from './context.ts';
import { createTerminalManager, type TerminalInfo, type TerminalManager } from './pty.ts';

export const AGENT_TERMINAL = 'agent';

const PROMPT = `Terminals:
- terminal_run types a command into a real terminal the user can watch live (on the canvas and in the work panel), waits for it, and returns the output and exit code. Prefer it over bash for long-running, streaming or interactive-ish work the user should see (dev servers excepted: they never finish, start them and read with terminal_read). Without an id it uses a terminal named "${AGENT_TERMINAL}". Like bash, it needs the user's approval.
- terminal_open creates another terminal (e.g. one per server); terminal_read returns recent output of any terminal, including ones the user typed in. Show one on the canvas with the "surface" component: { kind: "terminal", id }.`;

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }], details: {} });

function surfaceOf(info: TerminalInfo, openedBy: 'user' | 'agent', sessionId?: string): Omit<SurfaceInfo, 'createdAt' | 'updatedAt'> {
  const state = info.exited ? `exited (${info.exitCode ?? 0})` : info.busy ? `running: ${info.lastCommand ?? ''}` : info.lastCommand ? `last: ${info.lastCommand}` : info.cwd;
  return {
    kind: 'terminal',
    id: info.id,
    title: info.title,
    summary: state.length > 120 ? `${state.slice(0, 119)}…` : state,
    status: info.exited ? (info.exitCode ? 'error' : 'done') : info.busy ? 'busy' : 'idle',
    openedBy,
    ...(sessionId ? { sessionId } : {}),
    meta: { cwd: info.cwd, cols: info.cols, rows: info.rows },
  };
}

const isLoopback = (host: string) => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host);

/** A cross-site page must not be able to open a shell: allow only same-host or loopback origins. */
export function originAllowed(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const o = new URL(origin);
    const host = (req.headers.host ?? '').replace(/:\d+$/, '');
    return o.hostname === host || isLoopback(o.hostname) || o.hostname === `[${host}]`;
  } catch {
    return false;
  }
}

export function createTerminalSurface(context: SurfaceContext, injected?: { manager?: TerminalManager }): FeatureModule {
  const { surfaces } = context;
  /** Who opened each terminal, so later updates keep the attribution. */
  const owners = new Map<string, { openedBy: 'user' | 'agent'; sessionId?: string }>();
  const manager =
    injected?.manager ??
    createTerminalManager({
      workspace: context.workspace,
      onChange: (info) => {
        const owner = owners.get(info.id) ?? { openedBy: 'user' as const };
        surfaces.upsert(surfaceOf(info, owner.openedBy, owner.sessionId));
      },
      onClosed: (id) => {
        owners.delete(id);
        surfaces.remove('terminal', id);
      },
    });

  const openTerminal = (opts: { title?: string; cwd?: string }, openedBy: 'user' | 'agent', sessionId?: string) => {
    // Register the owner before spawning: the manager announces the surface from its first change callback.
    const id = `t-${Math.random().toString(16).slice(2, 10)}`;
    owners.set(id, { openedBy, ...(sessionId ? { sessionId } : {}) });
    return manager.open({ ...opts, id });
  };

  surfaces.onClose('terminal', (id) => manager.close(id));
  process.once('exit', () => manager.dispose());

  const agentTerminal = (sessionId: string): string => {
    const existing = manager.list().find((t) => t.title === AGENT_TERMINAL && !t.exited);
    if (existing) return existing.id;
    return openTerminal({ title: AGENT_TERMINAL }, 'agent', sessionId).id;
  };

  /** A terminal by id, else by title (models often pass the name: "agent", "dev server"); "agent" is made on demand. */
  const resolveTerminal = (ref: string | undefined, sessionId: string): string | undefined => {
    if (!ref || ref === AGENT_TERMINAL) return agentTerminal(sessionId);
    if (manager.get(ref)) return ref;
    const byTitle = manager.list().find((t) => !t.exited && t.title.toLowerCase() === ref.toLowerCase());
    return byTitle?.id;
  };

  const terminalOpen = defineTool({
    name: 'terminal_open',
    label: 'Open terminal',
    description: 'Open a new shell terminal in the workspace, visible to the user. Returns its id for terminal_run / terminal_read and the canvas "surface" component.',
    parameters: Type.Object({ title: Type.Optional(Type.String({ description: 'Short name, e.g. "dev server".' })) }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const info = openTerminal({ ...(params.title ? { title: params.title } : {}) }, 'agent', sessionIdFromToolContext(ctx));
      return text(`Opened terminal "${info.title}" with id ${info.id} in ${info.cwd}.`);
    },
  });

  const terminalRun = defineTool({
    name: 'terminal_run',
    label: 'Run in terminal',
    description:
      'Type a shell command into a terminal the user can watch live, wait for it to finish, and return its output and exit code. Needs the user\'s approval, like bash. Default terminal: "agent" (created on demand).',
    parameters: Type.Object({
      id: Type.Optional(Type.String({ description: 'Terminal id or title (from terminal_open); default: the "agent" terminal.' })),
      command: Type.String(),
      timeoutMs: Type.Optional(Type.Number({ description: 'Give up waiting after this long (default 120000, max 600000). The command keeps running.' })),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      const sessionId = sessionIdFromToolContext(ctx);
      const wantsAgent = !params.id || params.id === AGENT_TERMINAL;
      const fresh = wantsAgent && !manager.list().some((t) => t.title === AGENT_TERMINAL && !t.exited);
      const id = resolveTerminal(params.id, sessionId);
      if (!id) return text(`No terminal "${params.id}". Use terminal_open first, or omit id to use the "agent" terminal.`);
      if (fresh) await manager.ready(id);
      const r = await manager.run(id, params.command, { timeoutMs: params.timeoutMs, signal });
      const head = r.timedOut
        ? `Still running after the wait (the command was not stopped; use terminal_read ${id} to follow it).`
        : `Exit code ${r.exitCode}.`;
      return text(`${head} Terminal ${id}.\n${r.truncated ? '(output truncated to the last part)\n' : ''}${r.output}`);
    },
  });

  const terminalRead = defineTool({
    name: 'terminal_read',
    label: 'Read terminal',
    description: 'Read the most recent output of a terminal (including what the user typed there).',
    parameters: Type.Object({ id: Type.String({ description: 'Terminal id or title.' }), lines: Type.Optional(Type.Number({ description: 'How many trailing lines (default 50, max 500).' })) }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const id = resolveTerminal(params.id, sessionIdFromToolContext(ctx)) ?? params.id;
      const out = manager.read(id, Math.min(params.lines ?? 50, 500));
      return text(out === undefined ? `No terminal ${params.id}.` : out || '(no output yet)');
    },
  });

  const wss = new WebSocketServer({ noServer: true });
  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const id = decodeURIComponent(new URL(req.url ?? '/', 'http://local').pathname.slice('/ws/terminal/'.length));
    if (!originAllowed(req) || !manager.get(id)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      const send = (frame: unknown) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(frame));
      };
      const detach = manager.attach(id, {
        replay: (data) => send({ t: 'replay', d: data }),
        output: (d) => send({ t: 'out', d }),
        exit: (code) => send({ t: 'exit', code }),
      });
      ws.on('message', (raw) => {
        try {
          const m = JSON.parse(String(raw)) as { t?: string; d?: unknown; cols?: unknown; rows?: unknown };
          if (m.t === 'in' && typeof m.d === 'string') manager.write(id, m.d);
          else if (m.t === 'resize') manager.resize(id, Number(m.cols), Number(m.rows));
        } catch {
          /* ignore malformed frames */
        }
      });
      ws.on('close', () => detach?.());
    });
  };

  return {
    routes: {
      'POST /api/surfaces/terminal': async (req, res) => {
        const body = await readJson<{ title?: string; cwd?: string }>(req);
        const info = openTerminal(
          { ...(body.title ? { title: String(body.title) } : {}), ...(body.cwd ? { cwd: String(body.cwd) } : {}) },
          'user',
        );
        json(res, 200, { surface: surfaces.get('terminal', info.id), terminal: info });
      },
      'GET /api/surfaces/terminal/:id/scrollback': (_req, res, { params }) => {
        const data = manager.scrollback(params['id']!);
        if (data === undefined) return json(res, 404, { message: 'no such terminal' });
        json(res, 200, { id: params['id'], data });
      },
    },
    tools: [terminalOpen, terminalRun, terminalRead],
    prompt: PROMPT,
    upgrades: { '/ws/terminal/': onUpgrade },
  };
}
