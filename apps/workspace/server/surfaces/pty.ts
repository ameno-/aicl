/**
 * Terminal manager: real ptys shared by the user (WebSocket) and the agent
 * (terminal_run / terminal_read). No HTTP or Pi here, so it is testable alone.
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import * as nodePty from 'node-pty';

export const DEFAULT_MAX_LINES = 5000;
export const DEFAULT_MAX_BYTES = 512 * 1024;
const PERSIST_DEBOUNCE_MS = 400;

const ANSI = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[@-Z\\-_=>]|\([A-Za-z0-9])/g;
export const stripAnsi = (s: string): string => s.replace(ANSI, '').replace(/\r/g, '');

export interface TerminalInfo {
  id: string;
  title: string;
  cwd: string;
  cols: number;
  rows: number;
  /** A terminal_run is in flight. */
  busy: boolean;
  exited: boolean;
  exitCode?: number;
  /** The last command run through terminal_run. */
  lastCommand?: string;
}

export interface TerminalListener {
  output(data: string): void;
  exit(code: number): void;
}

export interface RunResult {
  output: string;
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
}

interface Term {
  info: TerminalInfo;
  pty: nodePty.IPty;
  buf: string;
  lines: number;
  listeners: Set<TerminalListener>;
  persistTimer: NodeJS.Timeout | null;
  chain: Promise<unknown>;
  lastData: number;
  gotData: boolean;
  /** 'hooks': zsh/bash report command boundaries through invisible OSC marks; 'legacy': printf sentinels. */
  mode?: 'hooks' | 'legacy';
  setup?: Promise<void>;
  /** While the hook setup line runs its echo and prompt are held back from every view. */
  muted: boolean;
  mutedBuf: string;
  onReady?: () => void;
}

/** OSC 777 marks printed by the shell hooks. Terminals ignore unknown OSC, so users never see them. */
const MARK_B = '\u001b]777;aicl;B\u0007';
const MARK_READY = '\u001b]777;aicl;R\u0007';
const MARK_D = /\u001b\]777;aicl;D;(\d+)\u0007/;

/** The one-time (muted) line that installs the hooks, or undefined for shells we cannot hook. */
export function hookSetup(shell: string): string | undefined {
  const name = path.basename(shell);
  const mark = (c: string, arg = '') => `printf '\\033]777;aicl;${c}${arg}\\a'`;
  if (name === 'zsh')
    return ` setopt HIST_IGNORE_SPACE; PROMPT_EOL_MARK=''; __aicl_pre(){ ${mark('B')}; }; __aicl_post(){ printf '\\033]777;aicl;D;%s\\a' $?; }; preexec_functions+=(__aicl_pre); precmd_functions=(__aicl_post $precmd_functions); ${mark('R')}`;
  if (name === 'bash')
    return ` HISTCONTROL=ignoreboth; PS0=$'\\033]777;aicl;B\\a'; PROMPT_COMMAND='printf "\\033]777;aicl;D;%s\\a" $?'"\${PROMPT_COMMAND:+;$PROMPT_COMMAND}"; ${mark('R')}`;
  return undefined;
}

export interface TerminalManagerOptions {
  /** Workspace root: default cwd and where <root>/.aicl/terminals/<id>.log lives. */
  workspace: string;
  maxLines?: number;
  maxBytes?: number;
  shell?: string;
  onChange?(info: TerminalInfo): void;
  onClosed?(id: string): void;
}

export function createTerminalManager(options: TerminalManagerOptions) {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const dir = path.join(options.workspace, '.aicl', 'terminals');
  const logFile = (id: string) => path.join(dir, `${id}.log`);
  const terms = new Map<string, Term>();

  const persist = (t: Term) => {
    if (t.persistTimer) clearTimeout(t.persistTimer);
    t.persistTimer = null;
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(logFile(t.info.id), t.buf);
    } catch (cause) {
      console.error('terminal: could not persist scrollback', cause);
    }
  };

  const schedulePersist = (t: Term) => {
    if (t.persistTimer) return;
    t.persistTimer = setTimeout(() => persist(t), PERSIST_DEBOUNCE_MS);
    t.persistTimer.unref();
  };

  const append = (t: Term, data: string) => {
    t.buf += data;
    for (let i = data.indexOf('\n'); i >= 0; i = data.indexOf('\n', i + 1)) t.lines++;
    if (t.buf.length > maxBytes) {
      const cut = t.buf.indexOf('\n', t.buf.length - maxBytes);
      const drop = cut < 0 ? t.buf.length - maxBytes : cut + 1;
      t.lines -= countNewlines(t.buf, drop);
      t.buf = t.buf.slice(drop);
    }
    if (t.lines > maxLines) {
      let drop = 0;
      for (let n = t.lines - maxLines; n > 0; n--) drop = t.buf.indexOf('\n', drop) + 1;
      t.buf = t.buf.slice(drop);
      t.lines = maxLines;
    }
    schedulePersist(t);
  };

  const countNewlines = (s: string, upTo: number) => {
    let n = 0;
    for (let i = s.indexOf('\n'); i >= 0 && i < upTo; i = s.indexOf('\n', i + 1)) n++;
    return n;
  };

  const changed = (t: Term) => options.onChange?.({ ...t.info });

  function open(opts: { title?: string; cwd?: string; cols?: number; rows?: number; id?: string } = {}): TerminalInfo {
    const id = opts.id ?? `t-${randomBytes(4).toString('hex')}`;
    const cwd = path.resolve(options.workspace, opts.cwd ?? '.');
    const cols = opts.cols ?? 100;
    const rows = opts.rows ?? 28;
    const shell = options.shell ?? process.env['SHELL'] ?? '/bin/zsh';
    const pty = nodePty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', AICL_TERMINAL: id, PROMPT_EOL_MARK: '' } as Record<string, string>,
    });
    const t: Term = {
      info: { id, title: opts.title?.trim() || `terminal ${terms.size + 1}`, cwd, cols, rows, busy: false, exited: false },
      pty,
      buf: '',
      lines: 0,
      listeners: new Set(),
      persistTimer: null,
      chain: Promise.resolve(),
      lastData: 0,
      gotData: false,
      muted: false,
      mutedBuf: '',
    };
    terms.set(id, t);
    const deliver = (data: string) => {
      append(t, data);
      for (const l of [...t.listeners]) l.output(data);
    };
    pty.onData((data) => {
      t.lastData = Date.now();
      t.gotData = true;
      if (!t.muted) return deliver(data);
      t.mutedBuf += data;
      // Held back until the setup command finished AND its precmd mark arrived: the shell is then back at a prompt.
      const at = t.mutedBuf.indexOf(MARK_READY);
      if (at < 0) return;
      const after = t.mutedBuf.slice(at + MARK_READY.length);
      const d = MARK_D.exec(after);
      if (!d) return;
      const rest = after.slice(d.index + d[0].length);
      t.muted = false;
      t.mutedBuf = '';
      // The old prompt stays on screen while its replacement is redrawn on the same line.
      deliver(`\r\u001b[K${rest}`);
      t.onReady?.();
    });
    pty.onExit(({ exitCode }) => {
      t.info.exited = true;
      t.info.exitCode = exitCode;
      t.info.busy = false;
      if (terms.get(id) !== t) return; // closed on purpose: do not resurrect its log
      persist(t);
      for (const l of [...t.listeners]) l.exit(exitCode);
      changed(t);
    });
    changed(t);
    return { ...t.info };
  }

  const get = (id: string) => terms.get(id);

  /** Live buffer, or the persisted log of a terminal this process no longer holds. */
  function scrollback(id: string): string | undefined {
    const t = terms.get(id);
    if (t) return t.buf;
    try {
      return readFileSync(logFile(id), 'utf8');
    } catch {
      return undefined;
    }
  }

  /** Attach a listener; it first receives the replay so no output is missed or doubled. */
  function attach(id: string, listener: TerminalListener & { replay(data: string): void }): (() => void) | undefined {
    const t = terms.get(id);
    if (!t) return undefined;
    listener.replay(t.buf);
    if (t.info.exited) listener.exit(t.info.exitCode ?? 0);
    t.listeners.add(listener);
    return () => t.listeners.delete(listener);
  }

  function write(id: string, data: string): void {
    const t = terms.get(id);
    if (t && !t.info.exited) t.pty.write(data);
  }

  function resize(id: string, cols: number, rows: number): void {
    const t = terms.get(id);
    if (!t || t.info.exited || !(cols > 0) || !(rows > 0)) return;
    cols = Math.min(Math.floor(cols), 500);
    rows = Math.min(Math.floor(rows), 200);
    if (cols === t.info.cols && rows === t.info.rows) return;
    t.pty.resize(cols, rows);
    t.info.cols = cols;
    t.info.rows = rows;
  }

  function rename(id: string, title: string): void {
    const t = terms.get(id);
    if (!t) return;
    t.info.title = title;
    changed(t);
  }

  function list(): TerminalInfo[] {
    return [...terms.values()].map((t) => ({ ...t.info }));
  }

  /** Last `lines` lines of readable text. */
  function read(id: string, lines = 50): string | undefined {
    const text = scrollback(id);
    if (text === undefined) return undefined;
    const all = stripAnsi(text).split('\n');
    return all.slice(-Math.max(1, lines)).join('\n').trimEnd();
  }

  /** Resolves once the shell has printed its first prompt (output went quiet), or after `maxMs`. */
  async function ready(id: string, maxMs = 4000): Promise<void> {
    const t = terms.get(id);
    if (!t) return;
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      if (t.gotData && Date.now() - t.lastData > 250) return;
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  /**
   * Types `command` into the terminal so whoever watches sees it run, waits for
   * a sentinel carrying the exit code, and returns the output between markers.
   * Runs in one terminal are serialised.
   */
  function run(id: string, command: string, opts: { timeoutMs?: number; signal?: AbortSignal; maxChars?: number } = {}): Promise<RunResult> {
    const t = terms.get(id);
    if (!t) return Promise.reject(new Error(`no terminal ${id}`));
    if (t.info.exited) return Promise.reject(new Error(`terminal ${id} has exited`));
    const exec = () => execRun(t, command, opts);
    const result = t.chain.then(exec, exec);
    t.chain = result.catch(() => {});
    return result;
  }

  /** Installs the shell hooks once per terminal (muted, so nobody sees the setup); legacy printf sentinels when the shell is not hookable. */
  function ensureMode(t: Term): Promise<void> {
    t.setup ??= (async () => {
      const line = hookSetup(options.shell ?? process.env['SHELL'] ?? '/bin/zsh');
      if (!line) {
        t.mode = 'legacy';
        return;
      }
      await ready(t.info.id);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          t.muted = false;
          t.mutedBuf = '';
          t.mode = 'legacy';
          resolve();
        }, 4000);
        t.onReady = () => {
          clearTimeout(timer);
          t.mode = 'hooks';
          resolve();
        };
        t.muted = true;
        t.pty.write(`${line}\r`);
      });
    })();
    return t.setup;
  }

  async function execRun(t: Term, command: string, opts: { timeoutMs?: number; signal?: AbortSignal; maxChars?: number }): Promise<RunResult> {
    await ensureMode(t);
    const hooks = t.mode === 'hooks';
    const timeoutMs = Math.min(Math.max(opts.timeoutMs ?? 120_000, 1000), 600_000);
    const maxChars = opts.maxChars ?? 20_000;
    const nonce = randomBytes(5).toString('hex');
    const begin = `__AICL_B_${nonce}`;
    const done = hooks ? MARK_D : new RegExp(`__AICL_D_${nonce}_(\\d+)`);
    let raw = '';
    const listener: TerminalListener = {
      output: (d) => {
        raw += d;
        check();
      },
      exit: () => finish(null, false),
    };
    let finish!: (code: number | null, timedOut: boolean) => void;
    let check!: () => void;
    const outcome = new Promise<{ code: number | null; timedOut: boolean }>((resolve) => {
      let settled = false;
      finish = (code, timedOut) => {
        if (settled) return;
        settled = true;
        resolve({ code, timedOut });
      };
      check = () => {
        const m = done.exec(hooks ? raw : stripAnsi(raw));
        if (m) finish(Number(m[1]), false);
      };
    });
    const timer = setTimeout(() => finish(null, true), timeoutMs);
    const onAbort = () => finish(null, true);
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    t.listeners.add(listener);
    t.info.busy = true;
    t.info.lastCommand = command;
    changed(t);
    const oneLine = command.replace(/\s*\n\s*/g, '; ');
    // Hooks mode types just the command (a leading space keeps it out of history); legacy wraps it in visible sentinels.
    t.pty.write(hooks ? ` ${oneLine}\r` : `printf '\\n__AICL_B_%s\\n' ${nonce}; ${oneLine} ; printf '\\n__AICL_D_%s_%s\\n' ${nonce} $?\r`);
    const { code, timedOut } = await outcome;
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
    t.listeners.delete(listener);
    t.info.busy = false;
    changed(t);

    let text: string;
    if (hooks) {
      const bAt = raw.indexOf(MARK_B);
      const dAt = raw.search(done);
      if (bAt >= 0) text = stripAnsi(raw.slice(bAt + MARK_B.length, dAt >= 0 ? dAt : undefined));
      else {
        // No start mark (a parse error, or bash without PS0): skip the echoed command line.
        text = stripAnsi(raw.slice(0, dAt >= 0 ? dAt : undefined));
        const nl = text.indexOf('\n');
        text = nl >= 0 ? text.slice(nl + 1) : '';
      }
    } else {
      text = stripAnsi(raw);
      const b = text.indexOf(`${begin}\n`);
      if (b >= 0) text = text.slice(b + begin.length + 1);
      else {
        // The begin marker's echo never matched (shell died or timed out early): show what we have, minus the typed line.
        const nl = text.indexOf('\n');
        text = nl >= 0 ? text.slice(nl + 1) : '';
      }
      const d = text.search(done);
      if (d >= 0) text = text.slice(0, d);
    }
    text = text.replace(/^\n/, '').trimEnd();
    let truncated = false;
    if (text.length > maxChars) {
      text = `…${text.slice(-maxChars)}`;
      truncated = true;
    }
    return { output: text, exitCode: code, timedOut, truncated };
  }

  /** Kill the pty; `forget` also removes its persisted log (an explicit close by the user or agent). */
  async function close(id: string, forget = true): Promise<void> {
    const t = terms.get(id);
    if (t) {
      terms.delete(id);
      if (t.persistTimer) clearTimeout(t.persistTimer);
      for (const l of [...t.listeners]) l.exit(t.info.exitCode ?? 0);
      t.listeners.clear();
      try {
        t.pty.kill();
      } catch {
        /* already gone */
      }
    }
    if (forget) await unlink(logFile(id)).catch(() => {});
    options.onClosed?.(id);
  }

  /** Flush scrollback and kill every pty (process exit). Logs are kept. */
  function dispose(): void {
    for (const t of terms.values()) {
      persist(t);
      try {
        t.pty.kill();
      } catch {
        /* already gone */
      }
    }
    terms.clear();
  }

  return { open, get, list, scrollback, attach, write, resize, rename, read, ready, run, close, dispose };
}

export type TerminalManager = ReturnType<typeof createTerminalManager>;
