/**
 * Progress.
 *
 * A determined bar, or an indeterminate pulse while a tool has no
 * fraction yet. Never animates width: the fill uses `scaleX` so reduced
 * motion can drop the travel for free.
 */

import type { HTMLAttributes } from 'react';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–`max`. Omit with `indeterminate` for an unbounded wait. */
  value?: number;
  max?: number;
  indeterminate?: boolean;
  label?: string;
}

export function Progress({
  value = 0,
  max = 100,
  indeterminate = false,
  label = 'Progress',
  ...rest
}: ProgressProps) {
  const clamped = max <= 0 ? 0 : Math.min(max, Math.max(0, value));
  const ratio = max <= 0 ? 0 : clamped / max;

  return (
    <div
      {...rest}
      role="progressbar"
      aria-label={label}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : max}
      aria-valuenow={indeterminate ? undefined : clamped}
      data-aicl="progress"
      data-state={indeterminate ? 'indeterminate' : 'determinate'}
    >
      <span
        data-aicl="progress-fill"
        style={indeterminate ? undefined : { transform: `scaleX(${ratio})` }}
      />
    </div>
  );
}
