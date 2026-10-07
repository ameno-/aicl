import { AnimatePresence, motion } from 'motion/react';
import { Check, CornerDownLeft } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from '../../lib/cn.ts';

export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
}

export interface QuestionAnswer {
  optionIds: string[];
  text?: string;
}

export interface QuestionCardProps {
  question: string;
  options: QuestionOption[];
  multiple?: boolean;
  /** Adds a free-text "Other" field. */
  allowText?: boolean;
  onAnswer: (answer: QuestionAnswer) => void;
  /** When set, the card is locked and shows this answer. */
  answered?: QuestionAnswer;
  className?: string;
}

const spring = { type: 'spring', damping: 24, stiffness: 340 } as const;

/** Agent question with animated option chips. Single choice answers on click unless text or multi-select is on. */
export function QuestionCard({ question, options, multiple, allowText, onAnswer, answered, className }: QuestionCardProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState('');
  const qid = useId();
  const locked = answered !== undefined;
  const selected = locked ? answered.optionIds : picked;
  const needsSubmit = Boolean(multiple || allowText);
  const canSubmit = picked.length > 0 || text.trim().length > 0;

  const toggle = (id: string) => {
    if (locked) return;
    if (multiple) {
      setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    } else if (needsSubmit) {
      setPicked((p) => (p[0] === id ? [] : [id]));
    } else {
      setPicked([id]);
      onAnswer({ optionIds: [id] });
    }
  };
  const submit = () => {
    if (locked || !canSubmit) return;
    const t = text.trim();
    onAnswer({ optionIds: picked, ...(t ? { text: t } : {}) });
  };

  return (
    <motion.section
      data-fx-component="question-card"
      data-state={locked ? 'answered' : 'open'}
      aria-labelledby={`${qid}-q`}
      layout
      transition={spring}
      className={cn('w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm', className)}
    >
      <p id={`${qid}-q`} className="m-0 mb-3 text-sm font-medium text-foreground">
        {question}
      </p>
      <div role={multiple ? 'group' : 'radiogroup'} aria-labelledby={`${qid}-q`} className="flex flex-wrap gap-2">
        {options.map((o, i) => {
          const on = selected.includes(o.id);
          return (
            <motion.button
              key={o.id}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={on}
              aria-disabled={locked || undefined}
              disabled={locked && !on}
              title={o.description}
              onClick={() => toggle(o.id)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, ...spring }}
              whileTap={locked ? undefined : { scale: 0.95 }}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ring',
                on
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-muted',
                locked && 'cursor-default',
              )}
            >
              <AnimatePresence initial={false}>
                {on ? (
                  <motion.span
                    key="check"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 14, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="flex overflow-hidden"
                  >
                    <Check size={14} />
                  </motion.span>
                ) : null}
              </AnimatePresence>
              {o.label}
            </motion.button>
          );
        })}
      </div>

      {allowText && !locked ? (
        <input
          aria-label="Other answer"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="Or type your own answer"
          className="mt-3 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
        />
      ) : null}
      {locked && answered.text ? (
        <p className="m-0 mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">{answered.text}</p>
      ) : null}

      <AnimatePresence initial={false}>
        {needsSubmit && !locked ? (
          <motion.div
            key="submit"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="mt-3 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Answer <CornerDownLeft size={14} aria-hidden="true" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
