// Runs the agent server and the Vite dev server together; Ctrl-C stops both.
import { spawn } from 'node:child_process';

// The workspace agent's model for local development: GPT-6 Luna (cheap, vision,
// 1M context) through the agent proxy. Override with AICL_MODEL.
const DEFAULT_MODEL = 'ap-codex/gpt-6-luna';
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
