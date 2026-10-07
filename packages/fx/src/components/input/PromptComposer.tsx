import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, Paperclip, Square, X } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';
import { SmoothDropdown, type DropdownOption } from '../../vendor/uselayouts/smooth-dropdown.tsx';

export type PromptStatus = 'ready' | 'streaming' | 'error';

export interface PromptAttachment {
  id: string;
  name: string;
}

export interface PromptChip {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  onRemove?: () => void;
}

export interface PromptProgress {
  label: string;
  done: number;
  total: number;
}

export interface PromptComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onStop?: () => void;
  status?: PromptStatus;
  placeholder?: string;
  /** Accessible name of the textarea. */
  ariaLabel?: string;
  attachments?: PromptAttachment[];
  onAttach?: () => void;
  onRemoveAttachment?: (id: string) => void;
  modes?: DropdownOption[];
  mode?: string;
  onModeChange?: (id: string) => void;
  models?: DropdownOption[];
  model?: string;
  onModelChange?: (id: string) => void;
  /** Context chips under the box. */
  chips?: PromptChip[];
  /** Task-progress chip (e.g. 4/4). */
  progress?: PromptProgress;
  variant?: 'bottom' | 'hero';
  disabled?: boolean;
  className?: string;
}

const MAX_HEIGHT = { bottom: 220, hero: 320 } as const;

/**
 * Auto-growing AI-chat input. Enter submits, Shift+Enter adds a line, the send
 * button morphs into Stop while streaming. The box height eases to its content.
 */
export function PromptComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  status = 'ready',
  placeholder = 'Ask anything…',
  ariaLabel = 'Message',
  attachments = [],
  onAttach,
  onRemoveAttachment,
  modes,
  mode,
  onModeChange,
  models,
  model,
  onModelChange,
  chips = [],
  progress,
  variant = 'bottom',
  disabled,
  className,
}: PromptComposerProps) {
  const hero = variant === 'hero';
  const ref = useRef<HTMLTextAreaElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const hintId = useId();
  const streaming = status === 'streaming';
  const canSend = !disabled && value.trim().length > 0;

  // Measure content height without disturbing the painted (transitioning) height.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prev = el.style.height;
    el.style.height = '0px';
    const next = Math.min(el.scrollHeight, MAX_HEIGHT[variant]);
    el.style.height = prev;
    setHeight(next);
  }, [value, variant]);

  const submit = () => {
    if (streaming || !canSend) return;
    onSubmit(value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const hasAttachments = attachments.length > 0;
  return (
    <div
      data-fx-component="prompt-composer"
      data-variant={variant}
      data-status={status}
      className={cn('flex w-full flex-col gap-2', hero && 'mx-auto max-w-2xl', className)}
    >
      <div
        className={cn(
          'flex flex-col gap-2 border bg-card text-card-foreground shadow-sm transition-[border-color,box-shadow] duration-200 focus-within:border-ring focus-within:shadow-md',
          hero ? 'rounded-3xl p-4 shadow-lg' : 'rounded-2xl p-3',
          status === 'error' ? 'border-destructive' : 'border-border',
        )}
      >
        <AnimatePresence initial={false}>
          {hasAttachments ? (
            <motion.ul
              key="attachments"
              aria-label="Attachments"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="m-0 flex list-none flex-wrap gap-1.5 overflow-hidden p-0"
            >
              <AnimatePresence initial={false}>
                {attachments.map((a) => (
                  <motion.li
                    key={a.id}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="inline-flex max-w-48 items-center gap-1 rounded-full border border-border bg-muted py-0.5 pl-2.5 pr-1 text-xs text-foreground"
                  >
                    <Paperclip size={12} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                    <span className="truncate">{a.name}</span>
                    {onRemoveAttachment ? (
                      <button
                        type="button"
                        aria-label={`Remove ${a.name}`}
                        onClick={() => onRemoveAttachment(a.id)}
                        className="flex size-4 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-border hover:text-foreground"
                      >
                        <X size={11} />
                      </button>
                    ) : null}
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          ) : null}
        </AnimatePresence>

        <textarea
          ref={ref}
          aria-label={ariaLabel}
          aria-describedby={hintId}
          aria-invalid={status === 'error' || undefined}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          style={height === undefined ? undefined : { height }}
          className={cn(
            'block w-full resize-none border-0 bg-transparent p-1 text-foreground outline-none transition-[height] duration-150 ease-out placeholder:text-muted-foreground motion-reduce:transition-none',
            hero ? 'min-h-24 text-lg leading-7' : 'min-h-7 text-sm leading-6',
          )}
        />
        <span id={hintId} className="sr-only">
          Enter to send, Shift+Enter for a new line
        </span>

        <div className="flex items-center gap-1.5">
          {onAttach ? (
            <button
              type="button"
              aria-label="Attach files"
              onClick={onAttach}
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Paperclip size={16} />
            </button>
          ) : null}
          {modes && modes.length && onModeChange ? (
            <SmoothDropdown
              data-fx-component="mode-picker"
              label="Mode"
              options={modes}
              value={mode ?? modes[0]?.id ?? ''}
              onChange={onModeChange}
              width={240}
            />
          ) : null}
          {models && models.length && onModelChange ? (
            <SmoothDropdown
              data-fx-component="model-picker"
              label="Model"
              options={models}
              value={model ?? models[0]?.id ?? ''}
              onChange={onModelChange}
              width={280}
            />
          ) : null}
          {progress ? <ProgressChip {...progress} /> : null}

          <motion.button
            type="button"
            data-fx-part={streaming ? 'stop' : 'send'}
            aria-label={streaming ? 'Stop generating' : 'Send message'}
            aria-disabled={!streaming && !canSend ? true : undefined}
            disabled={!streaming && !canSend}
            onClick={streaming ? onStop : submit}
            whileTap={{ scale: 0.92 }}
            animate={{ borderRadius: streaming ? 10 : 999 }}
            className={cn(
              'relative ml-auto flex size-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed',
              streaming
                ? 'bg-foreground text-background'
                : canSend
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {streaming ? (
                <motion.span
                  key="stop"
                  initial={{ opacity: 0, scale: 0.4, rotate: -90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.4, rotate: 90 }}
                  transition={{ duration: 0.18 }}
                  className="flex"
                >
                  <Square size={13} fill="currentColor" />
                </motion.span>
              ) : (
                <motion.span
                  key="send"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18 }}
                  className="flex"
                >
                  <ArrowUp size={16} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {chips.length ? (
        <ul aria-label="Context" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {chips.map((c) => (
            <li
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background py-0.5 pl-2.5 pr-2.5 text-xs text-muted-foreground"
            >
              {c.icon}
              {c.onClick ? (
                <button type="button" onClick={c.onClick} className="cursor-pointer hover:text-foreground">
                  {c.label}
                </button>
              ) : (
                <span>{c.label}</span>
              )}
              {c.onRemove ? (
                <button
                  type="button"
                  aria-label={`Remove ${c.label}`}
                  onClick={c.onRemove}
                  className="-mr-1 ml-0.5 flex size-4 cursor-pointer items-center justify-center rounded-full hover:bg-muted hover:text-foreground"
                >
                  <X size={11} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ProgressChip({ label, done, total }: PromptProgress) {
  const frac = total > 0 ? Math.min(1, done / total) : 0;
  const r = 6;
  const c = 2 * Math.PI * r;
  return (
    <span
      data-fx-part="progress"
      role="status"
      aria-label={`${label}: ${done} of ${total}`}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-xs text-muted-foreground"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="-rotate-90">
        <circle cx="8" cy="8" r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        <motion.circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          className={frac >= 1 ? 'stroke-success' : 'stroke-primary'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - frac) }}
          transition={{ type: 'spring', damping: 24, stiffness: 160 }}
        />
      </svg>
      <span className="tabular-nums text-foreground">
        {done}/{total}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
