import { motion, useReducedMotionConfig } from 'motion/react';
import { cn } from '../../lib/cn.ts';

/**
 * A light that travels around the parent's border (parent must be `relative` with a radius).
 * A rotating conic gradient is clipped to a 1.5px ring by a mask; it never affects layout.
 * Static ring under reduced motion.
 */
export function BorderBeam({ active = true, className }: { active?: boolean; className?: string }) {
  const reduced = useReducedMotionConfig() ?? false;
  if (!active) return null;
  const ring = 'linear-gradient(#000 0 0)';
  return (
    <div
      aria-hidden="true"
      data-fx-beam=""
      className={cn('pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] p-[1.5px]', className)}
      style={{
        WebkitMask: `${ring} content-box, ${ring}`,
        WebkitMaskComposite: 'xor',
        mask: `${ring} content-box exclude, ${ring}`,
      }}
    >
      <motion.div
        className="absolute left-1/2 top-1/2 aspect-square w-[300%]"
        style={{
          x: '-50%',
          y: '-50%',
          background:
            'conic-gradient(from 0deg, transparent 0deg, transparent 250deg, var(--aicl-accent) 320deg, var(--aicl-info, var(--aicl-accent)) 350deg, transparent 360deg)',
        }}
        animate={reduced ? { rotate: 0, opacity: 0.6 } : { rotate: 360 }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}
