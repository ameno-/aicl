import { useEffect, useState } from 'react';
import { CodeBlock, LiveTerminal, RollingNumber, StatusIsland, type IslandStatus } from '@aicl/fx';
import type { Story } from '../types.ts';

function useTick(ms: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((c) => c + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

function Counters() {
  const n = useTick(900);
  const tokens = 1200 + n * 347;
  return (
    <dl className="grid grid-cols-3 gap-2 text-sm">
      <div><dt className="text-xs text-faint">Tokens</dt><dd className="font-medium"><RollingNumber value={tokens} /></dd></div>
      <div><dt className="text-xs text-faint">Cost</dt><dd className="font-medium">$<RollingNumber value={tokens * 0.00003} precision={3} format={(v) => v.toFixed(3)} /></dd></div>
      <div><dt className="text-xs text-faint">Elapsed</dt><dd className="font-medium"><RollingNumber value={n} />s</dd></div>
    </dl>
  );
}

const OUT = [
  '> aicl-workspace@0.0.0 test',
  '> vitest run',
  ' ✓ shared/graph.test.ts (12)',
  ' ✓ web/chatStore.test.ts (9)',
  ' ✓ server/sessions.test.ts (14)',
  ' Test Files  3 passed (3)',
  '      Tests  35 passed (35)',
];

function StreamingTerminal() {
  const n = useTick(700);
  // One line per tick, a short pause with the exit badge, then loop.
  const phase = n % (OUT.length + 4);
  const shown = OUT.slice(0, Math.min(phase, OUT.length));
  const finished = phase >= OUT.length + 1;
  return <LiveTerminal command="npm test" lines={shown} running={!finished} {...(finished ? { exitCode: 0 } : {})} />;
}

const ORDER: IslandStatus[] = ['idle', 'thinking', 'working', 'waiting', 'error', 'done'];
const DETAIL: Partial<Record<IslandStatus, string>> = { working: 'editing 3 files', waiting: 'approve command' };

function CyclingIsland() {
  const n = useTick(1600);
  const status = ORDER[n % ORDER.length]!;
  const detail = DETAIL[status];
  return <StatusIsland status={status} {...(detail ? { detail } : {})} />;
}

const SNIPPET = `export function useStream(url: string) {
  const [text, setText] = useState('');
  useEffect(() => {
    const es = new EventSource(url);
    es.onmessage = (e) => setText((t) => t + e.data);
    return () => es.close();
  }, [url]);
  return text;
}`;

export default [
  {
    group: 'Status',
    title: 'RollingNumber',
    note: 'Spring-rolled counters for tokens, cost and elapsed time.',
    states: { live: () => <Counters /> },
  },
  {
    group: 'Status',
    title: 'LiveTerminal',
    note: 'New lines slide in, cursor blinks while running, exit badge when finished.',
    states: {
      streaming: () => <StreamingTerminal />,
      ok: () => <LiveTerminal command="npm run build" lines={['built in 1.2s']} running={false} exitCode={0} />,
      failed: () => <LiveTerminal command="npm test" lines={['FAIL web/chatStore.test.ts', '  expected 2, got 1']} running={false} exitCode={1} />,
    },
  },
  {
    group: 'Status',
    title: 'StatusIsland',
    note: 'Dynamic-island pill that morphs between idle, thinking, working, waiting, error and done.',
    states: {
      cycling: () => <CyclingIsland />,
      error: () => <StatusIsland status="error" detail="rate limited" />,
      done: () => <StatusIsland status="done" label="Merged" />,
    },
  },
  {
    group: 'Streaming',
    title: 'CodeBlock',
    note: 'Code with filename header and an animated copy button.',
    states: {
      ts: () => <CodeBlock code={SNIPPET} language="ts" filename="useStream.ts" />,
      bare: () => <CodeBlock code="npm install && npm run build" language="bash" />,
    },
  },
] satisfies Story[];
