// Runs the agent server and the Vite dev server together; Ctrl-C stops both.
import { spawn } from 'node:child_process';

// The workspace agent's model for local development: MiniMax M3 (vision, 1M
// context) through OpenCode Go keeps runs cheap. Override with AICL_MODEL.
const DEFAULT_MODEL = 'opencode-go/minimax-m3';
const env = { ...process.env, AICL_MODEL: process.env.AICL_MODEL || DEFAULT_MODEL };

const procs = [
  spawn('npm', ['run', 'server'], { stdio: 'inherit', env }),
  spawn('npm', ['run', 'web'], { stdio: 'inherit', env }),
];
const stop = () => procs.forEach((p) => p.kill('SIGTERM'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) {
  p.on('exit', (code) => {
    stop();
    process.exitCode = code ?? 0;
  });
}
