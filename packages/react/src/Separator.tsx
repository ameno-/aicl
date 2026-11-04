/**
 * Separator.
 *
 * A line between groups. Decorative by default (no role), or a real
 * `separator` when the caller needs one announced.
 */

import type { HTMLAttributes } from 'react';

export type SeparatorOrientation = 'horizontal' | 'vertical';

export interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: SeparatorOrientation;
  /** When true, the line is announced as a separator. Defaults to decorative. */
  decorative?: boolean;
}

export function Separator({
  orientation = 'horizontal',
  decorative = true,
  ...rest
}: SeparatorProps) {
  return (
    <div
      {...rest}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      data-aicl="separator"
      data-orientation={orientation}
    />
  );
}
