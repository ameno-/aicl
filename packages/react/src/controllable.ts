import { useState } from 'react';

/**
 * Controlled and uncontrolled in one hook, the shape both sample libraries
 * use: `value` wins when it is passed, otherwise `defaultValue` is the state.
 *
 * The setter always notifies `onChange`. It only writes local state when the
 * caller is not holding the value.
 */
export function useControllableState<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void,
): [T, (next: T) => void] {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : uncontrolled;
  const set = (next: T) => {
    if (!isControlled) setUncontrolled(next);
    onChange?.(next);
  };
  return [current, set];
}
