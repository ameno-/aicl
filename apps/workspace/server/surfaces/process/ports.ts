/**
 * Listening-port detection for the process surface: hints from what a command
 * prints, and the authoritative answer from lsof for its process tree.
 */
import { execFile } from 'node:child_process';

const LOCAL_URL = /https?:\/\/(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-f:]*\]):(\d{2,5})\b/gi;
const LISTENING = /\b(?:listening|serving|running|started|ready)\b[^\n]*?\b(?:on|at)\b[^\n\d]*?(?:port\s+|:)(\d{2,5})\b/gi;
const PORT_WORD = /\b(?:listening|serving)[^\n]*?\bport\s+(\d{2,5})\b/gi;

const ANSI = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[@-Z\\-_=>])/g;

/** Ports a command's output says it listens on, in first-seen order. */
export function parsePorts(output: string): number[] {
  const text = output.replace(ANSI, '');
  const found: number[] = [];
  for (const re of [LOCAL_URL, LISTENING, PORT_WORD]) {
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const port = Number(m[1]);
      if (port > 0 && port <= 65535 && !found.includes(port)) found.push(port);
    }
  }
  return found;
}

/** Ports from `lsof -nP -iTCP -sTCP:LISTEN -Fpn` output, filtered to `pids`. */
export function parseLsof(output: string, pids?: Set<number>): number[] {
  const ports: number[] = [];
  let pid = 0;
  for (const line of output.split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1));
    else if (line.startsWith('n') && (!pids || pids.has(pid))) {
      const m = /:(\d+)$/.exec(line.slice(1));
      if (m && !ports.includes(Number(m[1]))) ports.push(Number(m[1]));
    }
  }
  return ports.sort((a, b) => a - b);
}

const run = (cmd: string, args: string[]): Promise<string | undefined> =>
  new Promise((resolve) => {
    execFile(cmd, args, { timeout: 4000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      // lsof exits 1 when nothing matches: that is an answer, not a failure.
      if (error && !stdout && (error as { code?: unknown }).code !== 1) return resolve(undefined);
      resolve(stdout);
    });
  });

/** `root` and every descendant, from `ps -axo pid=,ppid=`. */
export function treeOf(root: number, ps: string): Set<number> {
  const kids = new Map<number, number[]>();
  for (const line of ps.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)/.exec(line);
    if (m) kids.set(Number(m[2]), [...(kids.get(Number(m[2])) ?? []), Number(m[1])]);
  }
  const seen = new Set<number>([root]);
  const queue = [root];
  for (let pid = queue.shift(); pid !== undefined; pid = queue.shift()) {
    for (const k of kids.get(pid) ?? []) {
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(k);
      }
    }
  }
  return seen;
}

/** Ports the process tree under `root` listens on; undefined when lsof/ps are unavailable. */
export async function listeningPorts(root: number): Promise<number[] | undefined> {
  const [ps, lsof] = await Promise.all([run('ps', ['-axo', 'pid=,ppid=']), run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpn'])]);
  if (ps === undefined || lsof === undefined) return undefined;
  return parseLsof(lsof, treeOf(root, ps));
}
