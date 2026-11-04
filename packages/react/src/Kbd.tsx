/**
 * Kbd.
 *
 * A keyboard hint. The `@aicl/fx` vendor is the animated one; this is the
 * headless primitive a skin can paint.
 *
 * Pass `keys` for a chord (`['Meta', 'K']`) or children for free text.
 */

import type { HTMLAttributes, ReactNode } from 'react';

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  /** A chord, rendered as one glyph per key. */
  keys?: readonly string[];
  children?: ReactNode;
}

export function Kbd({ keys, children, ...rest }: KbdProps) {
  const content =
    keys && keys.length > 0
      ? keys.map((key, index) => (
          <span key={`${key}-${index}`} data-aicl="kbd-key">
            {key}
          </span>
        ))
      : children;

  return (
    <kbd {...rest} data-aicl="kbd">
      {content}
    </kbd>
  );
}
