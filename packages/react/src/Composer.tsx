import {
  forwardRef,
  useCallback,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import type { ChatStatus } from '@aicl/core';

export type ComposerPlacement = 'docked' | 'hero' | 'rail';

export interface ComposerProps {
  onSubmit: (text: string) => void;
  onStop?: () => void;
  /**
   * Conversation status. `submitted` and `streaming` are never collapsed:
   * stop is available only while tokens are arriving.
   */
  status?: ChatStatus;
  /** @deprecated Pass `status`. Treated as `streaming` when `status` is omitted. */
  isBusy?: boolean;
  /** Disables send only. The field stays editable. */
  disabled?: boolean;
  disabledReason?: string;
  placeholder?: string;
  placement?: ComposerPlacement;
  attachmentCount?: number;
  attachments?: Array<{ id: string; name: string }>;
  suggestions?: string[];
  onSelectSuggestion?: (label: string) => void;
  maxRows?: number;
  /** Render-prop children receive live state so consumers own all markup. */
  children?: (api: ComposerRenderApi) => ReactNode;
}

export interface ComposerRenderApi {
  value: string;
  setValue: (v: string) => void;
  submit: () => void;
  stop: () => void;
  canSubmit: boolean;
  showStop: boolean;
  isBusy: boolean;
}

export interface ComposerHandle {
  focus: () => void;
  clear: () => void;
}

/**
 * Unstyled composer primitive. Owns keyboard semantics, autosizing, and
 * submission guards; owns no visual design.
 */
export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  {
    onSubmit,
    onStop,
    status,
    isBusy = false,
    disabled = false,
    disabledReason,
    placeholder,
    placement = 'docked',
    attachmentCount = 0,
    attachments = [],
    suggestions = [],
    onSelectSuggestion,
    maxRows = 10,
    children,
  },
  ref,
) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const reasonId = useId();

  // Tracks IME composition. Without this, pressing Enter to confirm a candidate
  // in a Japanese, Chinese, or Korean IME submits the message mid-word.
  const composingRef = useRef(false);

  const resolved: ChatStatus = status ?? (isBusy ? 'streaming' : 'idle');
  const showStop = resolved === 'streaming';
  const busy = resolved === 'submitted' || resolved === 'streaming';
  const hasText = value.trim().length > 0;
  const hasAttachments = attachmentCount > 0 || attachments.length > 0;
  const canSubmit = (hasText || hasAttachments) && !busy && !disabled;
  const composerState = resolved === 'idle' || resolved === 'aborted' ? 'ready' : resolved;

  const submit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit(value);
    setValue('');
  }, [canSubmit, onSubmit, value]);

  const stop = useCallback(() => {
    if (showStop) onStop?.();
  }, [onStop, showStop]);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    clear: () => setValue(''),
  }));

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * maxRows)}px`;
  }, [value, maxRows]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    if (composingRef.current || event.nativeEvent.isComposing) return;
    if (event.shiftKey) return;
    event.preventDefault();
    submit();
  };

  if (children) {
    return (
      <>{children({ value, setValue, submit, stop, canSubmit, showStop, isBusy: busy })}</>
    );
  }

  return (
    <div
      data-aicl="composer"
      data-state={composerState}
      data-placement={placement}
      data-has-text={hasText || undefined}
      data-has-attachments={hasAttachments || undefined}
      data-disabled-reason={disabled && disabledReason ? disabledReason : undefined}
    >
      {suggestions.length ? (
        <div data-aicl="suggestion-chips" data-count={suggestions.length}>
          {suggestions.map((label) => (
            <button key={label} type="button" onClick={() => onSelectSuggestion?.(label)}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {attachments.length ? (
        <div data-aicl="attachment-row">
          {attachments.map((file) => (
            <span key={file.id} data-aicl="attachment-chip">{file.name}</span>
          ))}
        </div>
      ) : null}
      <textarea
        ref={textareaRef}
        value={value}
        rows={1}
        placeholder={placeholder}
        aria-label="Message"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
        }}
        data-aicl="composer-input"
      />
      {disabled && disabledReason ? (
        <span id={reasonId} data-aicl="composer-disabled-reason">
          {disabledReason}
        </span>
      ) : null}
      <button
        type="button"
        data-aicl="composer-submit"
        data-role={showStop ? 'stop' : 'send'}
        aria-label={showStop ? 'Stop generating' : 'Send message'}
        aria-describedby={disabled && disabledReason ? reasonId : undefined}
        disabled={showStop ? false : !canSubmit}
        onClick={showStop ? stop : submit}
      >
        {showStop ? 'Stop' : 'Send'}
      </button>
    </div>
  );
});
