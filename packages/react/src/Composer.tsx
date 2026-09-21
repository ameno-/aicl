import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

export interface ComposerProps {
  onSubmit: (text: string) => void;
  onStop?: () => void;
  isBusy?: boolean;
  disabled?: boolean;
  placeholder?: string;
  maxRows?: number;
  /** Render-prop children receive live state so consumers own all markup. */
  children?: (api: ComposerRenderApi) => ReactNode;
}

export interface ComposerRenderApi {
  value: string;
  setValue: (v: string) => void;
  submit: () => void;
  canSubmit: boolean;
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
  { onSubmit, onStop, isBusy = false, disabled = false, placeholder, maxRows = 12, children },
  ref,
) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Tracks IME composition. Without this, pressing Enter to confirm a candidate
  // in a Japanese, Chinese, or Korean IME submits the message mid-word. This is
  // the single most common accessibility bug in chat composers.
  const composingRef = useRef(false);

  const canSubmit = value.trim().length > 0 && !isBusy && !disabled;

  const submit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit(value);
    setValue('');
  }, [canSubmit, onSubmit, value]);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    clear: () => setValue(''),
  }));

  // Autosize before paint so the textarea never renders at the wrong height.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * maxRows)}px`;
  }, [value, maxRows]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    // `isComposing` covers browsers that set it; the ref covers those that fire
    // keydown before compositionend. Both are needed in practice.
    if (composingRef.current || event.nativeEvent.isComposing) return;
    if (event.shiftKey) return; // newline
    event.preventDefault();
    submit();
  };

  if (children) {
    return <>{children({ value, setValue, submit, canSubmit, isBusy })}</>;
  }

  return (
    <div data-aicl="composer" data-busy={isBusy || undefined}>
      <textarea
        ref={textareaRef}
        value={value}
        rows={1}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={placeholder ?? 'Message'}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => (composingRef.current = true)}
        onCompositionEnd={() => (composingRef.current = false)}
        data-aicl="composer-input"
      />
      {isBusy && onStop ? (
        <button type="button" onClick={onStop} data-aicl="composer-stop" aria-label="Stop generating">
          Stop
        </button>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          data-aicl="composer-send"
          aria-label="Send message"
        >
          Send
        </button>
      )}
    </div>
  );
});
