import { AnimatePresence, motion, useReducedMotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

/** Height-animating disclosure body (0 -> auto). Instant under reduced motion. */
export function Collapse({ open, id, children }: { open: boolean; id?: string; children: ReactNode }) {
  const reduced = useReducedMotionConfig() ?? false;
  const t = { duration: reduced ? 0 : 0.22, ease: [0.4, 0, 0.2, 1] as const };
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="body"
          id={id}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={t}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
