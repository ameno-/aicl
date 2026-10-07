/**
 * Vendored from nolly-studio/cult-ui (apps/www/registry/default/ui/rolling-number.tsx) at 67a66c6ac1cd. MIT licence, see ../../../ATTRIBUTION.md.
 * Adapted: imports rewritten to relative paths; AICL changes are marked with `AICL:`.
 */
"use client"

import { useEffect } from "react"
import { motion, MotionValue, useReducedMotionConfig, useSpring, useTransform } from "motion/react"

interface RollingNumberProps {
  value: number
  mass?: number
  stiffness?: number
  damping?: number
  precision?: number
  format?: (value: number) => string
  onAnimationStart?: () => void
  onAnimationComplete?: () => void
}

export function RollingNumber({
  value,
  mass = 0.8,
  stiffness = 75,
  damping = 15,
  precision = 0,
  format = (num) => num.toLocaleString(),
  onAnimationStart,
  onAnimationComplete,
}: RollingNumberProps) {
  const spring = useSpring(value, { mass, stiffness, damping })
  const display: MotionValue<string> = useTransform(spring, (current) =>
    format(parseFloat(current.toFixed(precision)))
  )

  const reduced = useReducedMotionConfig() // AICL: jump instead of rolling when the user prefers reduced motion
  useEffect(() => {
    if (reduced) spring.jump(value)
    else spring.set(value)
    if (onAnimationStart) onAnimationStart()
    const unsubscribe = spring.on("change", () => {
      if (spring.get() === value && onAnimationComplete) onAnimationComplete()
    })
    return () => unsubscribe()
  }, [spring, value, reduced, onAnimationStart, onAnimationComplete])

  return <motion.span className="tabular-nums">{display}</motion.span> // AICL: tabular-nums, no layout jitter
}
