/**
 * Tooltip.
 *
 * A short label that appears on hover or focus. Fluid and LooseLeaf both
 * ship one; AICL had none. The delay is the motion system's `fast` tier
 * (80 ms) so it reads as a preview, not a pop.
 *
 * Compound: `Tooltip.Trigger` and `Tooltip.Content`. A `content` prop on
 * the root is the short form — it wraps the child as the trigger.
 */

import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  type FocusEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';

import { useControllableState } from './controllable.js';

export type TooltipSide = 'top' | 'bottom' | 'start' | 'end';

export interface TooltipProps {
  /** Controlled open. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Milliseconds before the tip appears. Defaults to the fast tier, 80 ms. */
  delay?: number;
  side?: TooltipSide;
  /** Short form: the tip's text, wrapping `children` as the trigger. */
  content?: ReactNode;
  children?: ReactNode;
}

interface TooltipContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  delay: number;
  side: TooltipSide;
  triggerId: string;
  contentId: string;
}

const TooltipContext = createContext<TooltipContextValue | null>(null);

function useTooltip(): TooltipContextValue {
  const ctx = useContext(TooltipContext);
  if (!ctx) throw new Error('Tooltip parts must be rendered inside <Tooltip>.');
  return ctx;
}

function TooltipRoot({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  delay = 80,
  side = 'top',
  content,
  children,
}: TooltipProps) {
  const [open, setOpen] = useControllableState(openProp, defaultOpen, onOpenChange);
  const triggerId = useId();
  const contentId = useId();
  const value: TooltipContextValue = { open, setOpen, delay, side, triggerId, contentId };

  if (content !== undefined) {
    return (
      <TooltipContext.Provider value={value}>
        <span data-aicl="tooltip" data-side={side} data-state={open ? 'open' : 'closed'}>
          <TooltipTrigger>{children}</TooltipTrigger>
          <TooltipContent>{content}</TooltipContent>
        </span>
      </TooltipContext.Provider>
    );
  }

  return (
    <TooltipContext.Provider value={value}>
      <span data-aicl="tooltip" data-side={side} data-state={open ? 'open' : 'closed'}>
        {children}
      </span>
    </TooltipContext.Provider>
  );
}

export interface TooltipTriggerProps {
  children: ReactNode;
}

export function TooltipTrigger({ children }: TooltipTriggerProps) {
  const { open, setOpen, delay, triggerId, contentId } = useTooltip();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const props = {
    id: triggerId,
    'aria-describedby': open ? contentId : undefined,
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      show();
    },
    onPointerLeave: hide,
    onFocus: (_event: FocusEvent) => show(),
    onBlur: hide,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        event.stopPropagation();
        hide();
      }
    },
  };

  if (isValidElement(children)) {
    const child = children as ReactElement<Record<string, unknown>>;
    return (
      <span data-aicl="tooltip-trigger">
        {cloneElement(child, {
          ...props,
          onPointerEnter: (event: PointerEvent) => {
            (child.props.onPointerEnter as ((e: PointerEvent) => void) | undefined)?.(event);
            props.onPointerEnter(event);
          },
          onPointerLeave: (event: PointerEvent) => {
            (child.props.onPointerLeave as ((e: PointerEvent) => void) | undefined)?.(event);
            props.onPointerLeave();
          },
          onFocus: (event: FocusEvent) => {
            (child.props.onFocus as ((e: FocusEvent) => void) | undefined)?.(event);
            props.onFocus(event);
          },
          onBlur: (event: FocusEvent) => {
            (child.props.onBlur as ((e: FocusEvent) => void) | undefined)?.(event);
            props.onBlur();
          },
          onKeyDown: (event: KeyboardEvent) => {
            (child.props.onKeyDown as ((e: KeyboardEvent) => void) | undefined)?.(event);
            props.onKeyDown(event);
          },
        })}
      </span>
    );
  }

  return (
    <button type="button" data-aicl="tooltip-trigger" {...props}>
      {children}
    </button>
  );
}

export interface TooltipContentProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
}

export function TooltipContent({ children, ...rest }: TooltipContentProps) {
  const { open, side, contentId } = useTooltip();
  return (
    <span
      {...rest}
      id={contentId}
      role="tooltip"
      data-aicl="tooltip-content"
      data-side={side}
      data-state={open ? 'open' : 'closed'}
      hidden={!open}
    >
      {children}
    </span>
  );
}

export const Tooltip = Object.assign(TooltipRoot, {
  Trigger: TooltipTrigger,
  Content: TooltipContent,
});
