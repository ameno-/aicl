import { motion, useReducedMotionConfig } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn.ts';
import { AnimatedCheckbox } from '../../vendor/spell-ui/animated-checkbox.tsx';
import { ShimmerText } from '../../vendor/spell-ui/shimmer-text.tsx';
import { Spinner } from '../../vendor/spell-ui/spinner.tsx';
import { RollingNumber } from './RollingNumber.tsx';

export type PlanStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface PlanStep {
  id: string;
  label: string;
  status: PlanStepStatus;
}

export interface AnimatedPlanProps {
  steps: PlanStep[];
  title?: string;
  className?: string;
}

/** Agent plan checklist: boxes animate on completion, the running step shimmers, progress rolls. */
export function AnimatedPlan({ steps, title = 'Plan', className }: AnimatedPlanProps) {
  const reduced = useReducedMotionConfig() ?? false;
  const done = steps.filter((s) => s.status === 'done').length;
  const pct = steps.length ? (done / steps.length) * 100 : 0;
  return (
    <div
      data-fx-component="AnimatedPlan"
      data-done={done}
      data-total={steps.length}
      className={cn('flex flex-col gap-3 rounded-lg border border-border bg-card p-3 text-sm', className)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{title}</span>
        <span className="tabular-nums text-xs text-muted-foreground" aria-label={`${done} of ${steps.length} steps done`}>
          <RollingNumber value={done} /> / {steps.length}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduced ? 0 : 0.4, ease: 'easeOut' }}
        />
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((s) => (
          <li key={s.id} data-step={s.id} data-status={s.status} className="flex min-h-6 items-center gap-2">
            {s.status === 'running' ? (
              <>
                <span className="inline-flex size-[18px] items-center justify-center">
                  <Spinner size="sm" className="text-primary" />
                </span>
                <div className="text-sm font-medium">{reduced ? s.label : <ShimmerText delay={0}>{s.label}</ShimmerText>}</div>
              </>
            ) : s.status === 'error' ? (
              <>
                <span className="inline-flex size-[18px] items-center justify-center rounded-[6px] bg-destructive text-background">
                  <X size={12} strokeWidth={3} aria-hidden="true" />
                </span>
                <span className="text-sm font-medium text-destructive">{s.label}</span>
              </>
            ) : (
              <AnimatedCheckbox readOnly checked={s.status === 'done'} title={s.label} />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
