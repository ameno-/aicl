/**
 * Controlled and uncontrolled state, in the shape both sample libraries use.
 *
 * Pass `value` and the caller owns the state. Omit it and the component
 * keeps the state, starting from `defaultValue`. `onChange` fires either way.
 */

import { useState } from 'react';

export function useControllable<T>(
  value: T | undefined,
  defaultValue: T,
  onChange: ((value: T) => void) | undefined,
): [T, (value: T) => void] {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : uncontrolled;

  const set = (next: T) => {
    if (!controlled) setUncontrolled(next);
    onChange?.(next);
  };

  return [current, set];
}
