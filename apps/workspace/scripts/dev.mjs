// Runs the agent server and the Vite dev server together; Ctrl-C stops both.
import { spawn } from 'node:child_process';

const procs = [
  spawn('npm', ['run', 'server'], { stdio: 'inherit' }),
  spawn('npm', ['run', 'web'], { stdio: 'inherit' }),
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
