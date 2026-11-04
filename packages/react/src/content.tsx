/**
 * Content primitives.
 *
 * The flat and compound pieces a chat surface uses around the transcript:
 * a badge, a rule, a keycap, a progress bar, a skeleton, a spinner, an
 * alert, a card, an empty state, and a tooltip. Each one is AICL's own.
 * The sample libraries are the reason the set exists — both ship these,
 * and a chat app rebuilt them every time they were missing — and the
 * incorporation record on each one says what was taken.
 *
 * They are headless. The surface, including the motion, lives in
 * `@aicl/styles` and keys off the slots below.
 */

import { useState, type HTMLAttributes, type ReactNode } from 'react';

import { Icon, type IconSlot } from './icons.js';

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'success';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** What the badge means. Defaults to `default`. */
  variant?: BadgeVariant;
  children?: ReactNode;
}

/** A small label that sits next to a word. */
export function Badge({ variant = 'default', children, ...rest }: BadgeProps) {
  return (
    <span {...rest} data-aicl="badge" data-variant={variant}>
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Separator                                                                   */
/* -------------------------------------------------------------------------- */

export interface SeparatorProps {
  /** Which way the rule runs. Defaults to `horizontal`. */
  orientation?: 'horizontal' | 'vertical';
  /**
   * A decorative rule is paint. A semantic one is a separator and is
   * announced.
   */
  decorative?: boolean;
}

/** A rule between two regions. */
export function Separator({ orientation = 'horizontal', decorative = true }: SeparatorProps) {
  return (
    <div
      role={decorative ? 'none' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      data-aicl="separator"
      data-orientation={orientation}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Kbd                                                                         */
/* -------------------------------------------------------------------------- */

export interface KbdProps {
  children?: ReactNode;
}

/** A keyboard key, drawn as a keycap. */
export function Kbd({ children }: KbdProps) {
  return <kbd data-aicl="kbd">{children}</kbd>;
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                    */
/* -------------------------------------------------------------------------- */

export interface ProgressProps {
  /** The current value. Omit it and the bar is indeterminate. */
  value?: number;
  /** The maximum. Defaults to 100. */
  max?: number;
  /** The accessible name. */
  label: string;
}

/**
 * A progress bar.
 *
 * Determinate when `value` is set: the fill width is the fraction of
 * `max`. Indeterminate when it is omitted: the fill travels.
 */
export function Progress({ value, max = 100, label }: ProgressProps) {
  const indeterminate = value == null;
  const safeMax = max > 0 ? max : 1;
  const fraction = indeterminate ? 0 : Math.min(1, Math.max(0, value / safeMax));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={indeterminate ? undefined : value}
      data-aicl="progress"
      data-state={indeterminate ? 'indeterminate' : 'determinate'}
    >
      <span data-aicl="progress-bar" style={{ width: indeterminate ? undefined : `${fraction * 100}%` }} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                    */
/* -------------------------------------------------------------------------- */

export interface SkeletonProps {
  /** Width. A number is pixels. */
  width?: number | string;
  /** Height. A number is pixels. */
  height?: number | string;
}

/** A placeholder while content is on its way. It shimmers, and it is hidden from assistive tech. */
export function Skeleton({ width, height }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      data-aicl="skeleton"
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Spinner                                                                     */
/* -------------------------------------------------------------------------- */

export interface SpinnerProps {
  /** The accessible name. Defaults to "Loading". */
  label?: string;
}

/** A spinning status glyph. The glyph is the spinner icon slot. */
export function Spinner({ label = 'Loading' }: SpinnerProps) {
  return (
    <span role="status" data-aicl="spinner">
      <Icon name="spinner" spin />
      <span data-aicl="visually-hidden">{label}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Alert                                                                       */
/* -------------------------------------------------------------------------- */

export type AlertVariant = 'info' | 'success' | 'warning' | 'destructive';

export interface AlertProps {
  /** What kind of news this is. Defaults to `info`. */
  variant?: AlertVariant;
  children?: ReactNode;
}

function alertIcon(variant: AlertVariant): IconSlot {
  switch (variant) {
    case 'info':
      return 'info';
    case 'success':
      return 'success';
    case 'warning':
      return 'alert';
    case 'destructive':
      return 'failure';
    default: {
      const never: never = variant;
      return never;
    }
  }
}

/**
 * A status message that arrives and stays.
 *
 * Compound: `Alert.Title` and `Alert.Description`.
 */
export function Alert({ variant = 'info', children }: AlertProps) {
  return (
    <div role="status" data-aicl="alert" data-variant={variant}>
      <span data-aicl="alert-icon">
        <Icon name={alertIcon(variant)} />
      </span>
      <div data-aicl="alert-body">{children}</div>
    </div>
  );
}

function AlertTitle({ children }: { children?: ReactNode }) {
  return <p data-aicl="alert-title">{children}</p>;
}

function AlertDescription({ children }: { children?: ReactNode }) {
  return <p data-aicl="alert-description">{children}</p>;
}

Alert.Title = AlertTitle;
Alert.Description = AlertDescription;

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export interface CardProps {
  children?: ReactNode;
}

/** A sheet with a header, a body and a footer. */
export function Card({ children }: CardProps) {
  return <section data-aicl="card">{children}</section>;
}

function CardHeader({ children }: { children?: ReactNode }) {
  return <header data-aicl="card-header">{children}</header>;
}

function CardTitle({ children }: { children?: ReactNode }) {
  return <h3 data-aicl="card-title">{children}</h3>;
}

function CardDescription({ children }: { children?: ReactNode }) {
  return <p data-aicl="card-description">{children}</p>;
}

function CardBody({ children }: { children?: ReactNode }) {
  return <div data-aicl="card-body">{children}</div>;
}

function CardFooter({ children }: { children?: ReactNode }) {
  return <footer data-aicl="card-footer">{children}</footer>;
}

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Body = CardBody;
Card.Footer = CardFooter;

/* -------------------------------------------------------------------------- */
/* Empty                                                                       */
/* -------------------------------------------------------------------------- */

export interface EmptyProps {
  children?: ReactNode;
}

/** What a region says when it has nothing in it yet. */
export function Empty({ children }: EmptyProps) {
  return <div data-aicl="empty">{children}</div>;
}

function EmptyTitle({ children }: { children?: ReactNode }) {
  return <p data-aicl="empty-title">{children}</p>;
}

function EmptyDescription({ children }: { children?: ReactNode }) {
  return <p data-aicl="empty-description">{children}</p>;
}

function EmptyActions({ children }: { children?: ReactNode }) {
  return <div data-aicl="empty-actions">{children}</div>;
}

Empty.Title = EmptyTitle;
Empty.Description = EmptyDescription;
Empty.Actions = EmptyActions;

/* -------------------------------------------------------------------------- */
/* Tooltip                                                                     */
/* -------------------------------------------------------------------------- */

export interface TooltipProps {
  /** The tip. Kept short: this is a label, not a paragraph. */
  content: ReactNode;
  children?: ReactNode;
}

/**
 * A tip that shows on hover and on keyboard focus.
 *
 * It is paint beside its trigger, not a collision-aware popup. A tip that
 * has to avoid a viewport edge is a popover, and that primitive is still
 * a candidate.
 */
export function Tooltip({ content, children }: TooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      data-aicl="tooltip-anchor"
      data-state={open ? 'open' : 'closed'}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <span role="tooltip" data-aicl="tooltip" aria-hidden={open ? undefined : true}>
        {content}
      </span>
    </span>
  );
}
