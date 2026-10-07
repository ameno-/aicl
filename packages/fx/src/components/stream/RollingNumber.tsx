import { RollingNumber as VendoredRollingNumber } from '../../vendor/cult-ui/rolling-number.tsx';
import { cn } from '../../lib/cn.ts';

export interface RollingNumberProps {
  value: number;
  /** Defaults to `toLocaleString()`. */
  format?: (value: number) => string;
  /** Decimal places shown while rolling. */
  precision?: number;
  className?: string;
}

/** Spring-rolled counter for tokens, cost, elapsed time. Jumps instantly under reduced motion. */
export function RollingNumber({ value, format, precision = 0, className }: RollingNumberProps) {
  return (
    <span data-fx-component="RollingNumber" className={cn('inline-block', className)}>
      <VendoredRollingNumber value={value} precision={precision} {...(format ? { format } : {})} />
    </span>
  );
}
