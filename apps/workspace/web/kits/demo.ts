/**
 * One scripted conversation (user ask → thinking → read + grep → plan → bash → streamed reply),
 * as a pure function of elapsed milliseconds, so every kit can replay the identical run.
 */
import type { Message, ToolCallPart } from '@aicl/core';
import type { TerminalState } from '../agentic/liveData.ts';

export const SCRIPT_END = 15500;
export const SCRIPT_SESSION = 'kits-demo';
export const BASH_ID = 'demo-bash';

const REPLY =
  'Tests pass: the **3 checks** in `notes.md` are covered and the suite is green.\n\n- Fixed the stale cache read in `store.ts`\n- Added a regression test\n- Nothing else changed\n\nWant me to open the pull request?';

const OUTPUT = ['> aicl@0.0.0 test', '> node --test', '✔ cache returns fresh values (4ms)', '✔ store survives reconnect (11ms)', '✔ notes.md checklist (2ms)', 'ℹ tests 3  pass 3  fail 0'];

const tool = (id: string, name: string, args: unknown, status: ToolCallPart['status']): ToolCallPart => ({ type: 'tool-call', toolCallId: id, name, args, status });
const stat = (t: number, start: number, end: number): ToolCallPart['status'] => (t < start ? 'pending' : t < end ? 'running' : 'success');

export function scriptedAt(t: number, origin: number): { messages: Message[]; status: 'ready' | 'submitted' | 'streaming'; streamingId?: string; terminals: Record<string, TerminalState> } {
  const user: Message = { id: 'u1', role: 'user', createdAt: origin, parts: [{ type: 'text', text: 'Fix the failing cache test, and tell me when the suite is green.' }] };
  const terminals: Record<string, TerminalState> = {};
  if (t < 1200) return { messages: [user], status: 'submitted', terminals };

  const parts: Message['parts'] = [];
  const thinking = t < 2600;
  parts.push({ type: 'reasoning', text: 'The failing test reads the cache after a reconnect. I should look at notes.md and the store before changing anything.', ...(thinking ? {} : { durationMs: 1400 }) });
  if (t >= 2600) parts.push(tool('demo-read', 'read', { path: 'notes.md' }, stat(t, 2600, 3400)));
  if (t >= 3400) parts.push(tool('demo-grep', 'grep', { pattern: 'readCache' }, stat(t, 3400, 4200)));
  if (t >= 4200) {
    const step = (at: number) => (t < at ? 'pending' : t < at + 1600 ? 'running' : 'done');
    parts.push(
      tool(
        'demo-plan',
        'plan_update',
        {
          title: 'Fix the cache test',
          steps: [
            { id: 'a', label: 'Find the stale read', status: 'done' },
            { id: 'b', label: 'Patch the store', status: step(4600) },
            { id: 'c', label: 'Run the suite', status: step(6200) },
          ],
        },
        'success',
      ),
    );
  }
  if (t >= 5000) {
    const end = 9000;
    parts.push(tool(BASH_ID, 'bash', { command: 'npm test' }, stat(t, 5000, end)));
    const shown = Math.max(0, Math.min(OUTPUT.length, Math.floor((t - 5400) / 600)));
    terminals[BASH_ID] = { toolCallId: BASH_ID, command: 'npm test', lines: OUTPUT.slice(0, shown), partial: '', done: t >= end, ...(t >= end ? { exitCode: 0 } : {}) };
  }
  if (t >= 9600) {
    const chars = Math.min(REPLY.length, Math.floor((t - 9600) / 28));
    parts.push({ type: 'text', text: REPLY.slice(0, chars) });
  }
  const done = t >= SCRIPT_END - 200 && parts.some((p) => p.type === 'text' && p.text === REPLY);
  const assistant: Message = { id: 'a1', role: 'assistant', createdAt: origin + 1200, parts };
  return { messages: [user, assistant], status: done ? 'ready' : 'streaming', ...(done ? {} : { streamingId: 'a1' }), terminals };
}
