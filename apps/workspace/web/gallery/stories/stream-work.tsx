import { useEffect, useState } from 'react';
import { AnimatedPlan, ToolCallCard, WorkSummary, type PlanStep, type ToolStatus } from '@aicl/fx';
import type { Story } from '../types.ts';

const ARGS = { path: 'packages/fx/src/index.ts', range: [1, 40] };
const RESULT = 'export { cn } from "./lib/cn.ts";\nexport { FxProvider } from "./lib/FxProvider.tsx";';

function useTick(ms: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((c) => c + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

function RunningWork() {
  const n = useTick(1000);
  return <WorkSummary running seconds={n} steps={<span>Read 3 files, ran the type check.</span>} />;
}

/** pending -> running -> success, then loops, so the icon morph is visible. */
function CyclingTool() {
  const n = useTick(1800);
  const seq: ToolStatus[] = ['pending', 'running', 'running', 'success'];
  const status = seq[n % seq.length]!;
  return (
    <ToolCallCard
      name="read_file"
      label="Read src/index.ts"
      status={status}
      args={ARGS}
      result={status === 'success' ? RESULT : undefined}
      durationMs={status === 'success' ? 1400 : undefined}
    />
  );
}

const PLAN: PlanStep[] = [
  { id: 'a', label: 'Read the failing test', status: 'pending' },
  { id: 'b', label: 'Find the cause in the store', status: 'pending' },
  { id: 'c', label: 'Patch and re-run the suite', status: 'pending' },
  { id: 'd', label: 'Open the pull request', status: 'pending' },
];

function ProgressingPlan() {
  const n = useTick(1500);
  const active = n % (PLAN.length + 2); // 0..5: after the last step a short pause, then reset
  const steps = PLAN.map((s, i) => ({
    ...s,
    status: i < active ? ('done' as const) : i === active ? ('running' as const) : ('pending' as const),
  }));
  return <AnimatedPlan steps={steps} />;
}

export default [
  {
    group: 'Status',
    title: 'WorkSummary',
    note: 'Collapsed "Worked for 11s" disclosure; running form is "Working… 7s".',
    states: {
      done: () => <WorkSummary seconds={11} steps={<span>Read 3 files, ran the type check, fixed 1 error.</span>} />,
      open: () => <WorkSummary seconds={11} defaultOpen steps={<span>Read 3 files, ran the type check, fixed 1 error.</span>} />,
      running: () => <RunningWork />,
    },
  },
  {
    group: 'Status',
    title: 'ToolCallCard',
    note: 'Compact tool row; border beam while running, status icon morphs, expands to args and result.',
    states: {
      cycling: () => <CyclingTool />,
      success: () => <ToolCallCard name="read_file" label="Read src/index.ts" status="success" args={ARGS} result={RESULT} durationMs={1400} defaultOpen />,
      error: () => <ToolCallCard name="run_tests" label="Run test suite" status="error" args={{ cmd: 'npm test' }} result="2 failed, 41 passed" durationMs={8200} />,
      cancelled: () => <ToolCallCard name="web_fetch" label="Fetch release notes" status="cancelled" />,
    },
  },
  {
    group: 'Status',
    title: 'AnimatedPlan',
    note: 'Checklist: boxes draw on completion, the running step shimmers, the fraction rolls.',
    states: {
      progressing: () => <ProgressingPlan />,
      static: () => (
        <AnimatedPlan
          title="Migration"
          steps={[
            { id: '1', label: 'Back up the database', status: 'done' },
            { id: '2', label: 'Apply schema changes', status: 'error' },
            { id: '3', label: 'Verify row counts', status: 'pending' },
          ]}
        />
      ),
    },
  },
] satisfies Story[];
