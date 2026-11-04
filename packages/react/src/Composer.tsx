import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import type { Attachment, ChatStatus } from '@aicl/core';
import { AttachmentChip, SuggestionChips } from './composer-surface.js';
import { Icon } from './icons.js';

export type ComposerPlacement = 'docked' | 'hero' | 'rail';

/** The state a composer subpart can read. */
export interface ComposerApi {
  /** The draft text. */
  value: string;
  setValue: (v: string) => void;
  submit: () => void;
  stop: () => void;
  /** Whether the draft can be sent right now. */
  canSubmit: boolean;
  /** Whether the submit action is a stop control. */
  showStop: boolean;
  isBusy: boolean;
  status: ChatStatus;
  disabled: boolean;
  disabledReason?: string;
  placeholder?: string;
  maxRows: number;
  /** The suggestion chips, if any. */
  suggestions: string[];
  onSelectSuggestion?: (label: string) => void;
  /** The staged attachments. */
  attachments: Array<Pick<Attachment, 'id' | 'name'> & Partial<Attachment>>;
  onRemoveAttachment?: (id: string) => void;
  onRetryAttachment?: (id: string) => void;
  /** Opens the file picker, when the consumer supplied one. */
  onAttach?: () => void;
  /** The field element, for a `TriggerMenu` to attach to. */
  inputRef: MutableRefObject<HTMLTextAreaElement | null>;
}

/** The live state a render-prop child receives. */
export interface ComposerRenderApi {
  value: string;
  setValue: (v: string) => void;
  submit: () => void;
  stop: () => void;
  canSubmit: boolean;
  showStop: boolean;
  isBusy: boolean;
}

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
  /** Staged attachments. Minimal `{ id, name }` entries render as ready. */
  attachments?: Array<Pick<Attachment, 'id' | 'name'> & Partial<Attachment>>;
  onRemoveAttachment?: (id: string) => void;
  onRetryAttachment?: (id: string) => void;
  /** Controlled draft text. Omit for an uncontrolled field. */
  value?: string;
  onChange?: (value: string) => void;
  /** The field element, for a `TriggerMenu` to attach to. */
  inputRef?: MutableRefObject<HTMLTextAreaElement | null>;
  suggestions?: string[];
  onSelectSuggestion?: (label: string) => void;
  onAttach?: () => void;
  maxRows?: number;
  /**
   * Two ways to own the markup.
   *
   * A **function** receives the live state and owns *everything* — there
   * is no wrapper at all. This is the original escape hatch.
   *
   * A **node** is rendered inside the composer, with the subparts
   * available: `Composer.Body`, `Composer.Input`, `Composer.Submit`, and
   * the rest. The default arrangement is replaced.
   */
  children?: ((api: ComposerRenderApi) => ReactNode) | ReactNode;
}

export interface ComposerHandle {
  focus: () => void;
  clear: () => void;
}

const ComposerContext = createContext<ComposerApi | null>(null);

/**
 * The live state of the composer a subpart belongs to.
 *
 * Throws outside a `Composer`, because a subpart without a composer has no
 * sensible default.
 */
export function useComposer(): ComposerApi {
  const api = useContext(ComposerContext);
  if (!api) throw new Error('useComposer must be used within a Composer');
  return api;
}

/**
 * Unstyled composer primitive. Owns keyboard semantics, autosizing, and
 * submission guards; owns no visual design.
 *
 * It is a **compound** component: `Composer.Input`, `Composer.Submit` and
 * the rest can be arranged however the consumer wants, and the default
 * arrangement is what it renders when it has no children.
 */
const ComposerRoot = forwardRef<ComposerHandle, ComposerProps>(function Composer(
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
    onRemoveAttachment,
    onRetryAttachment,
    value: controlledValue,
    onChange,
    inputRef,
    suggestions = [],
    onSelectSuggestion,
    onAttach,
    maxRows = 10,
    children,
  },
  ref,
) {
  const [innerValue, setInnerValue] = useState('');
  const value = controlledValue ?? innerValue;
  const setValue = useCallback(
    (next: string) => {
      if (controlledValue === undefined) setInnerValue(next);
      onChange?.(next);
    },
    [controlledValue, onChange],
  );
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // When the consumer supplies a ref, it *is* the field ref: the consumer
  // sees the element, and the composer still drives it.
  const fieldRef = inputRef ?? textareaRef;
  const reasonId = useId();

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
  }, [canSubmit, onSubmit, setValue, value]);

  const stop = useCallback(() => {
    if (showStop) onStop?.();
  }, [onStop, showStop]);

  useImperativeHandle(ref, () => ({
    focus: () => fieldRef.current?.focus(),
    clear: () => setValue(''),
  }));

  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // `getComputedStyle` is absent outside a DOM. The composer renders in
    // servers and in test environments, so the fallback carries it.
    const styles = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
    const lineHeight = parseFloat(styles?.lineHeight ?? '') || 20;
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * maxRows)}px`;
  }, [value, maxRows, fieldRef]);

  const api = useMemo<ComposerApi>(
    () => ({
      value,
      setValue,
      submit,
      stop,
      canSubmit,
      showStop,
      isBusy: busy,
      status: resolved,
      disabled,
      disabledReason,
      placeholder,
      maxRows,
      suggestions,
      onSelectSuggestion,
      attachments,
      onRemoveAttachment,
      onRetryAttachment,
      onAttach,
      inputRef: fieldRef,
    }),
    [
      value,
      setValue,
      submit,
      stop,
      canSubmit,
      showStop,
      busy,
      resolved,
      disabled,
      disabledReason,
      placeholder,
      maxRows,
      suggestions,
      onSelectSuggestion,
      attachments,
      onRemoveAttachment,
      onRetryAttachment,
      onAttach,
      fieldRef,
    ],
  );

  // The original escape hatch: a function child owns everything, including
  // the wrapper. Kept exactly as it was.
  if (typeof children === 'function') {
    return (
      <>{children({ value, setValue, submit, stop, canSubmit, showStop, isBusy: busy })}</>
    );
  }

  const frame = (
    <div
      data-aicl="composer"
      data-state={composerState}
      data-placement={placement}
      data-has-text={hasText || undefined}
      data-has-attachments={hasAttachments || undefined}
      data-disabled-reason={disabled && disabledReason ? disabledReason : undefined}
    >
      {children ?? <ComposerDefault />}
    </div>
  );

  return (
    <ComposerContext.Provider value={api}>
      {frame}
    </ComposerContext.Provider>
  );
});

/**
 * The default arrangement: suggestions above, attachments, the attach
 * button, the field, the disabled reason, and the submit action.
 */
function ComposerDefault() {
  const api = useComposer();
  const reasonId = useId();
  return (
    <>
      <Composer.Suggestions />
      <Composer.Attachments />
      {api.onAttach ? <Composer.Attach /> : null}
      <Composer.Input />
      {api.disabled && api.disabledReason ? (
        <span id={reasonId} data-aicl="composer-disabled-reason">
          {api.disabledReason}
        </span>
      ) : null}
      <Composer.Submit describedBy={api.disabled && api.disabledReason ? reasonId : undefined} />
    </>
  );
}

/** The field area. */
export function ComposerBody({ className, children, ...rest }: { className?: string; children?: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} data-aicl="composer-body" className={className}>
      {children}
    </div>
  );
}

/** The field. */
export function ComposerInput({
  placeholder,
  rows = 1,
  'aria-label': ariaLabel = 'Message',
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'rows'> & {
  rows?: number;
  placeholder?: string;
}) {
  const api = useComposer();
  const composingRef = useRef(false);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    if (composingRef.current || event.nativeEvent.isComposing) return;
    if (event.shiftKey) return;
    event.preventDefault();
    api.submit();
  };

  return (
    <textarea
      {...rest}
      ref={(el) => {
        api.inputRef.current = el;
      }}
      value={api.value}
      rows={rows}
      placeholder={placeholder ?? api.placeholder}
      aria-label={ariaLabel}
      onChange={(e) => api.setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={() => {
        composingRef.current = false;
      }}
      data-aicl="composer-input"
    />
  );
}

/** The send / stop action. */
export function ComposerSubmit({
  describedBy,
  className,
  children,
  ...rest
}: { describedBy?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const api = useComposer();
  return (
    <button
      {...rest}
      type="button"
      data-aicl="composer-submit"
      data-role={api.showStop ? 'stop' : 'send'}
      aria-label={api.showStop ? 'Stop generating' : 'Send message'}
      aria-describedby={describedBy}
      disabled={api.showStop ? false : !api.canSubmit}
      onClick={api.showStop ? api.stop : api.submit}
      className={className}
    >
      {children ?? <Icon name={api.showStop ? 'stop' : 'send'} size={api.showStop ? 12 : 18} />}
    </button>
  );
}

/** The attach action. */
export function ComposerAttach({ className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const api = useComposer();
  if (!api.onAttach) return null;
  return (
    <button
      {...rest}
      type="button"
      data-aicl="composer-attach"
      aria-label="Attach file"
      onClick={api.onAttach}
      className={className}
    >
      {children ?? <Icon name="plus" size={18} />}
    </button>
  );
}

/** The staged attachments. */
export function ComposerAttachments({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  const api = useComposer();
  if (!api.attachments.length) return null;
  return (
    <div {...rest} data-aicl="attachment-row" className={className}>
      {api.attachments.map((file) => (
        <AttachmentChip
          key={file.id}
          attachment={{ mediaType: 'application/octet-stream', status: 'ready', ...file }}
          onRemove={api.onRemoveAttachment}
          onRetry={api.onRetryAttachment}
        />
      ))}
    </div>
  );
}

/** The suggestion chips. */
export function ComposerSuggestions() {
  const api = useComposer();
  if (!api.suggestions.length) return null;
  return (
    <SuggestionChips
      suggestions={api.suggestions.map((label) => ({ id: label, label }))}
      onSelect={(s) => api.onSelectSuggestion?.(s.label)}
    />
  );
}

/** A hint line. The consumer supplies the text. */
export function ComposerHint({ className, children, ...rest }: { children?: ReactNode } & React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p {...rest} data-aicl="composer-hint" className={className}>
      {children}
    </p>
  );
}

/** The reason the composer is disabled. */
export function ComposerDisabledReason({ className, children, ...rest }: { children?: ReactNode } & React.HTMLAttributes<HTMLSpanElement>) {
  const api = useComposer();
  if (!api.disabled || !api.disabledReason) return null;
  return (
    <span {...rest} data-aicl="composer-disabled-reason" className={className}>
      {children ?? api.disabledReason}
    </span>
  );
}

export const Composer = Object.assign(ComposerRoot, {
  Body: ComposerBody,
  Input: ComposerInput,
  Submit: ComposerSubmit,
  Attach: ComposerAttach,
  Attachments: ComposerAttachments,
  Suggestions: ComposerSuggestions,
  Hint: ComposerHint,
  DisabledReason: ComposerDisabledReason,
});
