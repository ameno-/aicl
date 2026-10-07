/**
 * The command menu surface. A wrapper-level replacement for @aicl/fx's
 * CommandMenu: that component's fuzzyScore returns negative scores for
 * matches at the start of a label (a -2 bonus) and then discards negatives as
 * "no match", so typing the beginning of any command finds nothing. Same
 * look and keys; the scoring is fixed here (packages/fx is not ours to edit).
 */
import { AnimatePresence, motion } from 'motion/react';
import { Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Kbd, type CommandItem } from '@aicl/fx';

/** Subsequence match; null when `query` is not a subsequence of `text`. Lower is better. */
export function matchScore(query: string, text: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let ti = 0;
  let last = -1;
  let score = 0;
  for (const ch of q) {
    const at = t.indexOf(ch, ti);
    if (at < 0) return null;
    score += at - (last + 1) - (at === 0 || t[at - 1] === ' ' ? 1 : 0);
    last = at;
    ti = at + 1;
  }
  return score + t.length * 0.01;
}

export function CommandPaletteView({ open, onOpenChange, items, placeholder }: { open: boolean; onOpenChange: (open: boolean) => void; items: CommandItem[]; placeholder: string }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const uid = useId();

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      returnFocus.current?.focus?.();
    }
  }, [open]);

  const results = useMemo(() => {
    const scored = items.flatMap((item, i) => {
      const s = matchScore(query, item.label);
      return s === null ? [] : [{ item, i, s }];
    });
    if (query) scored.sort((a, b) => a.s - b.s || a.i - b.i);
    return scored.map((r) => r.item);
  }, [items, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (item: CommandItem | undefined) => {
    if (!item) return;
    onOpenChange(false);
    item.onSelect();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = results.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (n) setActive((a) => (a + 1) % n);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (n) setActive((a) => (a - 1 + n) % n);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  };

  let lastGroup: string | undefined;
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="cmd"
          data-fx-component="command-menu"
          className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[15vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-foreground/30 backdrop-blur-[2px]" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command menu"
            onKeyDown={onKeyDown}
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', damping: 30, stiffness: 420 }}
            className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                role="combobox"
                aria-expanded="true"
                aria-controls={`${uid}-list`}
                aria-activedescendant={results[active] ? `${uid}-${results[active]!.id}` : undefined}
                aria-label="Search commands"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="h-12 w-full border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <Kbd keys={['esc']} className="shrink-0 text-muted-foreground" />
            </div>
            <div ref={listRef} id={`${uid}-list`} role="listbox" aria-label="Commands" className="max-h-80 overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="m-0 px-3 py-6 text-center text-sm text-muted-foreground">No matching commands</p>
              ) : (
                results.map((item, i) => {
                  const showGroup = !query && item.group && item.group !== lastGroup;
                  lastGroup = item.group;
                  const on = i === active;
                  return (
                    <div key={item.id}>
                      {showGroup ? <div className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-faint">{item.group}</div> : null}
                      <motion.div
                        id={`${uid}-${item.id}`}
                        role="option"
                        aria-selected={on}
                        data-active={on ? '' : undefined}
                        onMouseMove={() => setActive(i)}
                        onClick={() => run(item)}
                        className={`relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${on ? 'text-foreground' : 'text-muted-foreground'}`}
                      >
                        {on ? (
                          <motion.span layoutId={`${uid}-hl`} aria-hidden="true" className="absolute inset-0 rounded-lg bg-muted" transition={{ type: 'spring', damping: 32, stiffness: 520 }} />
                        ) : null}
                        <span className="relative z-10 flex-1 truncate">{item.label}</span>
                        {item.shortcut ? <Kbd keys={item.shortcut} className="relative z-10" /> : null}
                      </motion.div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
