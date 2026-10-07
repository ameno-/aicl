/**
 * Vendored from xxtomm/spell-ui (registry/spell-ui/animated-checkbox.tsx) at fffe96db7b67. MIT licence, see ../../../ATTRIBUTION.md.
 * AICL: added a controlled `checked` + `readOnly` mode (plan steps are driven by the agent, not clicked),
 * `size` of the label text, button semantics (role=checkbox, keyboard toggle) and `data-checked`.
 */
"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { cn } from "../../lib/cn.ts";

interface AnimatedCheckboxProps {
  title?: React.ReactNode;
  defaultChecked?: boolean;
  /** AICL: controlled value; when given, internal state is ignored. */
  checked?: boolean;
  /** AICL: render without toggling or focus (agent-driven lists). */
  readOnly?: boolean;
  className?: string;
  onCheckedChange?: (checked: boolean) => void;
}

const springTransition = {
  type: "spring" as const,
  duration: 0.4,
  bounce: 0.2,
};

export function AnimatedCheckbox({
  title = "Implement Checkbox",
  defaultChecked = false,
  checked: controlled,
  readOnly = false,
  className,
  onCheckedChange,
}: AnimatedCheckboxProps) {
  const [inner, setInner] = useState(defaultChecked);
  const checked = controlled ?? inner;

  const toggle = () => {
    if (readOnly) return;
    const next = !checked;
    if (controlled === undefined) setInner(next);
    onCheckedChange?.(next);
  };

  return (
    <div
      role="checkbox"
      aria-checked={checked}
      aria-readonly={readOnly || undefined}
      data-checked={checked}
      tabIndex={readOnly ? -1 : 0}
      className={cn(
        "flex items-center gap-3 select-none outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md",
        !readOnly && "cursor-pointer",
        className,
      )}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <div
        className={cn(
          "size-4.5 shrink-0 rounded-[6px] flex items-center justify-center border-[1.5px] transition-colors duration-200",
          checked
            ? "bg-foreground border-transparent"
            : "bg-transparent border-muted-foreground/40 hover:border-muted-foreground/60"
        )}
      >
        <svg viewBox="0 0 20 20" className="size-full text-background">
          <motion.path
            d="M 0 4.5 L 3.182 8 L 10 0"
            fill="transparent"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="translate(5 6)"
            initial={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            animate={{
              pathLength: checked ? 1 : 0,
              opacity: checked ? 1 : 0
            }}
            transition={{
              pathLength: { ease: "easeOut", duration: 0.3 },
              opacity: { duration: 0 }
            }}
          />
        </svg>
      </div>
      <div className="relative">
        <span
          className={cn(
            "text-sm font-medium transition-colors duration-200",
            checked ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {title}
        </span>
        <motion.div
          className="absolute left-0 top-1/2 h-[1.5px] bg-muted-foreground -translate-y-1/2"
          initial={{ width: checked ? "100%" : 0, opacity: checked ? 1 : 0 }}
          animate={{
            width: checked ? "100%" : 0,
            opacity: checked ? 1 : 0,
          }}
          transition={springTransition}
        />
      </div>
    </div>
  );
}
