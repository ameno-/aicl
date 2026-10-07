import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Wrap an app once. Motion follows the user's reduced-motion setting, and
 * `data-fx` scopes the border-box defaults vendored components assume.
 */
export function FxProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div data-fx="" style={{ display: 'contents' }}>
        {children}
      </div>
    </MotionConfig>
  );
}
