/**
 * Vendored from xxtomm/spell-ui (registry/spell-ui/bars-spinner.tsx) at fffe96db7b67. MIT licence, see ../../../ATTRIBUTION.md.
 * AICL: the `<style jsx>` block (needs styled-jsx, and its global `.bar`/`spin` names would leak)
 * is replaced by 12 motion bars with the same geometry (rotate + translate 146%) and a staggered opacity fade.
 */
"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/cn.ts";

interface BarsSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
  color?: string;
}

const BARS = Array.from({ length: 12 }, (_, i) => i);

export const BarsSpinner = React.forwardRef<HTMLDivElement, BarsSpinnerProps>(
  ({ className, size = 20, color = "currentColor", style, ...props }, ref) => (
    <div
      ref={ref}
      role="presentation"
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <div className="absolute left-1/2 top-1/2 size-full">
        {BARS.map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-[6px]"
            style={{
              background: color,
              height: "8%",
              left: "-10%",
              top: "-3.9%",
              width: "24%",
              transform: `rotate(${i === 0 ? 0.0001 : i * 30}deg) translate(146%)`,
            }}
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 0.15] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear", delay: -1.2 + i * 0.1 }}
          />
        ))}
      </div>
    </div>
  ),
);

BarsSpinner.displayName = "SpellUI.BarsSpinner";

export type { BarsSpinnerProps };
