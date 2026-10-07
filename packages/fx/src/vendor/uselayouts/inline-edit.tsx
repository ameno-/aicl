/**
 * Vendored from iurvish/uselayouts
 * Path: registry/default/example/inline-edit.tsx
 * Commit: 07cc4f4fb8e0
 * Licence: MIT (see packages/fx/ATTRIBUTION.md)
 * Adapted: controlled via value/onSave props; hugeicons -> lucide-react; shadcn
 * Input -> native input; pen/check are real buttons; Enter saves, Escape
 * cancels; cn import.
 */
import { AnimatePresence, motion } from 'motion/react';
import { Check, Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn.ts';

export interface InlineEditProps {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function InlineEdit({ value, onSave, placeholder, label = 'Edit value', className }: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const commit = () => {
    setIsEditing(false);
    if (draft !== value) onSave(draft);
  };
  const cancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  return (
    <motion.div
      data-fx-component="inline-edit"
      data-editing={isEditing ? '' : undefined}
      layout
      className={cn(
        'relative inline-flex items-center overflow-hidden rounded-full border-2 border-border bg-background',
        isEditing && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
        className,
      )}
    >
      <input
        ref={inputRef}
        aria-label={label}
        value={draft}
        readOnly={!isEditing}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') cancel();
        }}
        className={cn(
          'h-10 w-full min-w-32 border-0 bg-transparent pl-4 pr-12 text-base outline-none',
          isEditing ? 'text-foreground' : 'text-muted-foreground',
        )}
      />
      <AnimatePresence initial={false} mode="popLayout">
        {isEditing ? (
          <motion.button
            key="save"
            type="button"
            aria-label="Save"
            initial={{ x: 50 }}
            animate={{ x: 0 }}
            exit={{ x: 50 }}
            transition={{ type: 'spring', bounce: 0.1 }}
            onClick={commit}
            className="absolute right-1 flex size-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
          >
            <Check size={16} />
          </motion.button>
        ) : (
          <motion.button
            key="edit"
            type="button"
            aria-label="Edit"
            initial={{ x: 50 }}
            animate={{ x: 0 }}
            exit={{ x: 50 }}
            transition={{ type: 'spring', bounce: 0.1 }}
            onClick={() => setIsEditing(true)}
            className="absolute right-1 flex size-8 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-muted"
          >
            <Pencil size={14} />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
