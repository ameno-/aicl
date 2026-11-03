/**
 * Button.
 *
 * AICL had no button primitive: every button in the library and in the
 * reference app was a raw `<button>` styled by whatever CSS happened to be
 * around. Both reference libraries ship one, and most of their components
 * compose it.
 *
 * The button is a **flat** primitive (S1) with three axes:
 *
 *   - `variant` — what it means: `default`, `secondary`, `destructive`,
 *     `ghost`, `outline`, `link`.
 *   - `size` — how big: `sm`, `md`, `lg`.
 *   - `loading` — it is working. The button stays focusable and stays the
 *     same size; it does not become disabled, because a disabled button
 *     cannot be found by a screen reader in a busy state.
 *
 * The glyphs are **icon slots**, not icons: `Button.Icon` takes a role
 * name and resolves it through the same `IconProvider` as everything else,
 * so an app that swaps the icon set gets its buttons swapped too.
 *
 * The button is headless. It publishes `data-aicl="button"` and the three
 * axes as attributes; the surface comes from `@aicl/styles`.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { Icon, type IconSlot } from './icons.js';

export type ButtonVariant = 'default' | 'secondary' | 'destructive' | 'ghost' | 'outline' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  /** What the button means. Defaults to `default`. */
  variant?: ButtonVariant;
  /** How big the button is. Defaults to `md`. */
  size?: ButtonSize;
  /**
   * The button is working. It keeps its size and stays focusable, and it
   * announces itself as busy.
   */
  loading?: boolean;
  /** The glyph before the label. A role name, not an icon. */
  icon?: IconSlot;
  /** The glyph after the label. */
  trailingIcon?: IconSlot;
  /** The accessible name, when the visible label is not the name. */
  'aria-label'?: string;
  children?: ReactNode;
}

/**
 * A button.
 *
 * `type` defaults to `button`. A button inside a form that submits it must
 * say so — an implicit submit is the single most common way a chat app
 * sends a message twice.
 */
export const Button = Object.assign(
  forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
      variant = 'default',
      size = 'md',
      loading = false,
      icon,
      trailingIcon,
      disabled,
      type = 'button',
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        {...rest}
        ref={ref}
        type={type}
        disabled={disabled}
        aria-busy={loading || undefined}
        data-aicl="button"
        data-variant={variant}
        data-size={size}
        data-loading={loading || undefined}
      >
        {icon ? <ButtonIcon name={icon} /> : null}
        {children != null ? <span data-aicl="button-label">{children}</span> : null}
        {trailingIcon ? <ButtonIcon name={trailingIcon} /> : null}
      </button>
    );
  }),
  { Icon: ButtonIcon },
);

export interface ButtonIconProps {
  /** The role this glyph plays. Resolved through the icon provider. */
  name: IconSlot;
  /** Size in pixels. Defaults to the button's icon size. */
  size?: number;
}

/**
 * A glyph inside a button.
 *
 * Rendered through the icon provider, so it follows the app's icon set.
 */
export function ButtonIcon({ name, size }: ButtonIconProps) {
  return (
    <span data-aicl="button-icon" data-icon={name}>
      <Icon name={name} size={size} />
    </span>
  );
}
