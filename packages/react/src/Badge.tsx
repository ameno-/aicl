/**
 * Badge.
 *
 * A status chip. Fluid and LooseLeaf both ship one; AICL did not. The
 * corpus uses them on session rows, plan steps and tool status — quiet
 * colour, never a button.
 *
 * Headless: `data-aicl="badge"` and `data-variant`. The surface comes from
 * `@aicl/styles`.
 */

import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline';

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  variant?: BadgeVariant;
  children?: ReactNode;
}

export function Badge({ variant = 'default', children, ...rest }: BadgeProps) {
  return (
    <span {...rest} data-aicl="badge" data-variant={variant}>
      {children}
    </span>
  );
}
