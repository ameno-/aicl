/** Run an external CLI (git, gh, hunk) without a shell; never throws on a non-zero exit. */
import { execFile } from 'node:child_process';

export interface RunResult {
  stdout: string;
  stderr: string;
  /** Exit code; -1 when the program could not start (ENOENT). */
  code: number;
}

export function run(
  cmd: string,
  args: string[],
  options: { cwd: string; input?: string; env?: Record<string, string>; timeoutMs?: number },
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = execFile(
      cmd,
      args,
      {
        cwd: options.cwd,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1', ...options.env },
        maxBuffer: 128 * 1024 * 1024,
        timeout: options.timeoutMs ?? 60_000,
        encoding: 'utf8',
      },
      (error, stdout, stderr) => {
        const code = error ? (typeof (error as { code?: unknown }).code === 'number' ? ((error as { code: number }).code) : -1) : 0;
        resolve({ stdout: stdout ?? '', stderr: stderr ?? (error ? error.message : ''), code });
      },
    );
    if (options.input !== undefined) {
      child.stdin?.on('error', () => {});
      child.stdin?.end(options.input);
    }
  });
}

/** stdout, or throws with stderr as the message. */
export async function runOk(cmd: string, args: string[], options: Parameters<typeof run>[2]): Promise<string> {
  const r = await run(cmd, args, options);
  if (r.code !== 0) throw new Error((r.stderr || r.stdout || `${cmd} exited ${r.code}`).trim());
  return r.stdout;
}
