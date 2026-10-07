/**
 * Vendored from xxtomm/spell-ui
 * Path: registry/spell-ui/kbd.tsx
 * Commit: fffe96db7b67
 * Licence: MIT (see packages/fx/ATTRIBUTION.md)
 * Adapted: cn import; react-hotkeys-hook replaced by a local keydown listener;
 * data-fx-component hook.
 */
import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn.ts';

type KeyItem = string | { display: string; key: string };

export interface KbdProps {
  keys: KeyItem[];
  className?: string;
  active?: boolean;
  listenToKeyboard?: boolean;
}

const keySymbolMap: Record<string, string> = {
  command: '⌘',
  cmd: '⌘',
  meta: '⌘',
  control: '⌃',
  ctrl: '⌃',
  alt: '⌥',
  option: '⌥',
  shift: '⇧',
  enter: '↵',
  return: '↵',
  space: '␣',
  arrowleft: '←',
  left: '←',
  arrowdown: '↓',
  down: '↓',
  arrowup: '↑',
  up: '↑',
  arrowright: '→',
  right: '→',
};

const keyHotkeyMap: Record<string, string> = {
  command: 'meta',
  cmd: 'meta',
  control: 'ctrl',
  option: 'alt',
  return: 'enter',
  arrowleft: 'left',
  arrowdown: 'down',
  arrowup: 'up',
  arrowright: 'right',
};

const eventKey = (key: string): string => {
  const k = key.toLowerCase();
  return k === ' ' ? 'space' : keyHotkeyMap[k] ?? k;
};

export function Kbd({ keys = [], className, active, listenToKeyboard = false }: KbdProps) {
  const [isPressed, setIsPressed] = useState(false);

  const getKeyDisplay = (item: KeyItem): string => {
    const key = typeof item === 'string' ? item : item.display;
    return keySymbolMap[key.toLowerCase()] ?? key.toUpperCase();
  };

  const wantKey = keys.map((item) => eventKey(typeof item === 'string' ? item : item.key)).join('+');

  useEffect(() => {
    if (!listenToKeyboard) return;
    const want = wantKey.split('+');
    const onDown = (e: KeyboardEvent) => {
      const down = new Set<string>([eventKey(e.key)]);
      if (e.metaKey) down.add('meta');
      if (e.ctrlKey) down.add('ctrl');
      if (e.altKey) down.add('alt');
      if (e.shiftKey) down.add('shift');
      if (want.every((w) => down.has(w))) setIsPressed(true);
    };
    const release = () => setIsPressed(false);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', release);
      window.removeEventListener('blur', release);
    };
  }, [listenToKeyboard, wantKey]);

  const isActive = active || isPressed;

  return (
    <kbd
      data-fx-component="kbd"
      className={cn(
        'relative -top-[0.03em] box-border inline-flex min-w-[1.75em] shrink-0 cursor-default select-none items-center justify-center whitespace-nowrap rounded-[0.35em] px-[0.5em] pb-[0.05em] align-text-top font-sans text-[0.75em] font-normal leading-[1.7em] tracking-tight transition-all duration-100',
        isActive
          ? 'translate-y-[0.05em] bg-background text-foreground shadow-[inset_0_0.05em_rgba(255,255,255,0.95),inset_0_0.05em_0.2em_rgba(0,0,0,0.1),0_0_0_0.05em_rgba(0,0,0,0.134)] dark:shadow-[inset_0_0.05em_0.2em_rgba(0,0,0,0.3),0_0_0_0.05em_rgba(255,255,255,0.134)]'
          : 'bg-background text-foreground shadow-[inset_0_-0.05em_0.5em_rgba(0,0,0,0.034),inset_0_0.05em_rgba(255,255,255,0.95),inset_0_0.25em_0.5em_rgba(0,0,0,0.034),inset_0_-0.05em_rgba(0,0,0,0.172),0_0_0_0.05em_rgba(0,0,0,0.134),0_0.08em_0.17em_rgba(0,0,0,0.231)] dark:shadow-[inset_0_-0.05em_0.5em_rgba(255,255,255,0.034),inset_0_0.05em_rgba(255,255,255,0.1),inset_0_0.25em_0.5em_rgba(255,255,255,0.034),inset_0_-0.05em_rgba(255,255,255,0.172),0_0_0_0.05em_rgba(255,255,255,0.134),0_0.08em_0.17em_rgba(255,255,255,0.231)]',
        className,
      )}
    >
      {keys.map((item, index) => (
        <span key={index} className={index > 0 ? 'ml-0.5' : ''}>
          {getKeyDisplay(item)}
        </span>
      ))}
    </kbd>
  );
}
