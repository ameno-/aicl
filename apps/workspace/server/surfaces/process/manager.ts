/**
 * Process manager: long-running commands (dev servers, watchers) run in their
 * own process group with output captured. No HTTP or Pi here, so it is
 * testable alone.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { listeningPorts, parsePorts } from './ports.ts';

export const LOG_MAX_BYTES = 256 * 1024;

export interface ProcessInfo {
  id: string;
  name: string;
  command: string;
  cwd: string;
  pid?: number;
  ports: number[];
  status: 'running' | 'exited';
  exitCode?: number | null;
  /** Set when the process was stopped on purpose (Stop, close, server exit). */
  stopped?: boolean;
  startedAt: number;
  endedAt?: number;
}

interface Proc {
  info: ProcessInfo;
  child: ChildProcess | null;
  log: string;
  hinted: number[];
  listening: number[];
  poll: NodeJS.Timeout | null;
}

export interface ProcessManagerOptions {
  workspace: string;
  pollMs?: number;
  /** Replace lsof (tests). */
  detect?(pid: number): Promise<number[] | undefined>;
  onChange?(info: ProcessInfo): void;
  onClosed?(id: string): void;
}

const sameList = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

export function createProcessManager(options: ProcessManagerOptions) {
  const procs = new Map<string, Proc>();
  const detect = options.detect ?? listeningPorts;
  const pollMs = options.pollMs ?? 1500;

  const emit = (p: Proc) => options.onChange?.({ ...p.info, ports: [...p.info.ports] });

  const mergePorts = (p: Proc): boolean => {
    const next = p.info.status === 'exited' ? [] : [...new Set([...p.listening, ...p.hinted])].sort((a, b) => a - b);
    if (sameList(next, p.info.ports)) return false;
    p.info.ports = next;
    return true;
  };

  const refresh = async (p: Proc): Promise<void> => {
    const pid = p.info.pid;
    if (pid === undefined || p.info.status !== 'running') return;
    const found = await detect(pid);
    if (p.info.status !== 'running') return;
    if (found) p.listening = found;
    if (mergePorts(p)) emit(p);
  };

  const spawnInto = (p: Proc): void => {
    const child = spawn('/bin/sh', ['-c', p.info.command], {
      cwd: p.info.cwd,
      detached: true, // own process group, so stop reaches the whole tree
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1', FORCE_COLOR: '0', NO_COLOR: '1', BROWSER: 'none' } as Record<string, string>,
    });
    p.child = child;
    p.log = '';
    p.hinted = [];
    p.listening = [];
    p.info = { ...p.info, pid: child.pid, ports: [], status: 'running', startedAt: Date.now() };
    delete p.info.exitCode;
    delete p.info.endedAt;
    delete p.info.stopped;
    const onData = (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      p.log += text;
      if (p.log.length > LOG_MAX_BYTES) p.log = p.log.slice(p.log.length - LOG_MAX_BYTES);
      const ports = parsePorts(text);
      if (ports.length) {
        for (const port of ports) if (!p.hinted.includes(port)) p.hinted.push(port);
        if (mergePorts(p)) emit(p);
        void refresh(p);
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('error', (error) => {
      p.log += `\n[failed to start: ${error.message}]\n`;
    });
    child.on('close', (code, signal) => {
      if (p.child !== child) return; // replaced by a restart
      if (p.poll) clearInterval(p.poll);
      p.poll = null;
      p.info.status = 'exited';
      p.info.exitCode = code ?? (signal ? 128 : null);
      p.info.endedAt = Date.now();
      mergePorts(p);
      emit(p);
    });
    p.poll = setInterval(() => void refresh(p), pollMs);
    p.poll.unref();
    emit(p);
  };

  function start(opts: { command: string; name?: string; cwd?: string; id?: string }): ProcessInfo {
    const command = opts.command.trim();
    if (!command) throw new Error('command is required');
    const id = opts.id ?? `p-${randomBytes(4).toString('hex')}`;
    const p: Proc = {
      info: {
        id,
        name: opts.name?.trim() || command.split(/\s+/).slice(0, 3).join(' '),
        command,
        cwd: path.resolve(options.workspace, opts.cwd ?? '.'),
        ports: [],
        status: 'running',
        startedAt: Date.now(),
      },
      child: null,
      log: '',
      hinted: [],
      listening: [],
      poll: null,
    };
    procs.set(id, p);
    spawnInto(p);
    return { ...p.info };
  }

  const killGroup = (p: Proc, signal: NodeJS.Signals) => {
    const pid = p.info.pid;
    if (pid === undefined) return;
    try {
      process.kill(-pid, signal);
    } catch {
      try {
        process.kill(pid, signal);
      } catch {
        /* already gone */
      }
    }
  };

  /** SIGTERM the group, SIGKILL after `graceMs`; resolves once it exited. */
  async function stop(id: string, graceMs = 3000): Promise<ProcessInfo | undefined> {
    const p = procs.get(id);
    if (!p) return undefined;
    if (p.info.status === 'running') {
      p.info.stopped = true;
      const exited = new Promise<void>((resolve) => {
        const child = p.child;
        if (!child) return resolve();
        child.once('close', () => resolve());
      });
      killGroup(p, 'SIGTERM');
      const timer = setTimeout(() => killGroup(p, 'SIGKILL'), graceMs);
      await Promise.race([exited, new Promise((r) => setTimeout(r, graceMs + 2000))]);
      clearTimeout(timer);
    }
    return { ...p.info };
  }

  async function restart(id: string): Promise<ProcessInfo | undefined> {
    const p = procs.get(id);
    if (!p) return undefined;
    await stop(id);
    spawnInto(p);
    return { ...p.info };
  }

  async function close(id: string): Promise<void> {
    await stop(id);
    const p = procs.get(id);
    if (p?.poll) clearInterval(p.poll);
    procs.delete(id);
    options.onClosed?.(id);
  }

  /** Last `lines` lines of output. */
  function logs(id: string, lines = 100): string | undefined {
    const p = procs.get(id);
    if (!p) return undefined;
    return p.log
      .split('\n')
      .slice(-Math.max(1, lines) - 1)
      .join('\n')
      .trimEnd();
  }

  /** Resolves once a port shows up, the process exits, or `ms` passes. */
  async function waitForPort(id: string, ms: number): Promise<ProcessInfo | undefined> {
    const p = procs.get(id);
    if (!p) return undefined;
    const end = Date.now() + ms;
    while (Date.now() < end && p.info.status === 'running' && p.info.ports.length === 0) {
      await new Promise((r) => setTimeout(r, 200));
      await refresh(p);
    }
    return { ...p.info };
  }

  /** Synchronous kill of every group (server exit). */
  function dispose(): void {
    for (const p of procs.values()) {
      if (p.poll) clearInterval(p.poll);
      if (p.info.status === 'running') killGroup(p, 'SIGKILL');
    }
    procs.clear();
  }

  return {
    start,
    stop,
    restart,
    close,
    logs,
    waitForPort,
    dispose,
    get: (id: string) => (procs.has(id) ? { ...procs.get(id)!.info } : undefined),
    list: () => [...procs.values()].map((p) => ({ ...p.info })),
    /** Resolve an id or name. */
    find(ref: string): ProcessInfo | undefined {
      const hit = procs.get(ref) ?? [...procs.values()].find((p) => p.info.name.toLowerCase() === ref.toLowerCase());
      return hit ? { ...hit.info } : undefined;
    },
  };
}

export type ProcessManager = ReturnType<typeof createProcessManager>;
