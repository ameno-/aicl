/**
 * Composer surface primitives (blueprint §4.12): the trigger menu, suggestion
 * chips, and attachment intake. Behaviour and semantics only; paint comes from
 * `data-*` attributes.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createComboboxModel, type Attachment, type Mention } from '@aicl/core';
import { useReadable } from './useReadable.js';

/* -------------------------------------------------------------------------- */
/* TriggerMenu                                                                 */
/* -------------------------------------------------------------------------- */

export interface TriggerMenuProps<I> {
  /** The field the menu completes. Focus stays there: no dialog, no trap. */
  inputRef: RefObject<HTMLTextAreaElement | HTMLInputElement>;
  /** The draft text; the menu reads the token at the caret and writes the completion back. */
  value: string;
  onValueChange: (value: string) => void;
  trigger: '/' | '@' | (string & {});
  items: I[];
  getLabel: (item: I) => string;
  getKey: (item: I) => string;
  isDisabled?: (item: I) => boolean;
  /** `text` inserts the label verbatim; `mention` also reports a structured `Mention`. */
  insert?: 'text' | 'mention';
  emptyLabel?: string;
  renderItem?: (item: I, state: { active: boolean }) => ReactNode;
  /** When provided, filtering is the consumer's; otherwise labels are matched case-insensitively. */
  onQueryChange?: (query: string) => void;
  onClose?: () => void;
  onSelect: (item: I, result: { insertText: string; mentioned?: Mention }) => void;
}

/** The trigger token ending at the caret, if the caret sits in one. */
export function findTrigger(value: string, caret: number, trigger: string): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const at = before.lastIndexOf(trigger);
  if (at < 0) return null;
  // Word boundary: the trigger opens the field or follows whitespace.
  if (at > 0 && !/\s/.test(before[at - 1]!)) return null;
  const query = before.slice(at + trigger.length);
  if (/\s/.test(query)) return null;
  return { start: at, query };
}

export function TriggerMenu<I>({
  inputRef,
  value,
  onValueChange,
  trigger,
  items,
  getLabel,
  getKey,
  isDisabled,
  insert = 'text',
  emptyLabel = 'No matches',
  renderItem,
  onQueryChange,
  onClose,
  onSelect,
}: TriggerMenuProps<I>) {
  const listId = useId();
  const optionId = (index: number) => `${listId}-opt-${index}`;
  // Held in a ref: an inline predicate must not rebuild the model every render.
  const disabledRef = useRef(isDisabled);
  disabledRef.current = isDisabled;
  const model = useMemo(() => createComboboxModel<I>({ isDisabled: (i) => disabledRef.current?.(i) ?? false }), []);
  const state = useReadable(model.state);
  const [token, setToken] = useState<{ start: number; query: string } | null>(null);
  const dismissedAt = useRef<number | null>(null);

  // Re-read the token whenever the text or caret changes.
  const sync = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const found = findTrigger(value, el.selectionStart ?? value.length, trigger);
    if (found && dismissedAt.current === found.start) return setToken(null);
    if (!found) dismissedAt.current = null;
    setToken(found);
  }, [inputRef, trigger, value]);

  useEffect(sync, [sync]);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.addEventListener('click', sync);
    el.addEventListener('keyup', sync);
    return () => {
      el.removeEventListener('click', sync);
      el.removeEventListener('keyup', sync);
    };
  }, [inputRef, sync]);

  const query = token?.query ?? '';
  useEffect(() => {
    if (token) onQueryChange?.(query);
  }, [onQueryChange, query, token]);

  const visible = useMemo(() => {
    if (onQueryChange) return items;
    const q = query.toLowerCase();
    return items.filter((item) => getLabel(item).toLowerCase().includes(q));
  }, [getLabel, items, onQueryChange, query]);

  useEffect(() => model.setItems(visible), [model, visible]);
  useEffect(() => (token ? model.open() : model.close()), [model, token]);

  const open = token !== null && state.open;

  const close = useCallback(() => {
    if (token) dismissedAt.current = token.start;
    setToken(null);
    onClose?.();
  }, [onClose, token]);

  const accept = useCallback(
    (item: I | undefined) => {
      const el = inputRef.current;
      if (item === undefined || !token || !el) return;
      const caret = el.selectionStart ?? value.length;
      const label = getLabel(item);
      const insertText = insert === 'mention' ? `${trigger}${label}` : label;
      const next = `${value.slice(0, token.start)}${insertText} ${value.slice(caret)}`;
      const mentioned: Mention | undefined =
        insert === 'mention'
          ? { id: getKey(item), label, range: [token.start, token.start + insertText.length] }
          : undefined;
      onValueChange(next);
      onSelect(item, mentioned ? { insertText, mentioned } : { insertText });
      setToken(null);
      const end = token.start + insertText.length + 1;
      requestAnimationFrame(() => el.setSelectionRange(end, end));
    },
    [getKey, getLabel, inputRef, insert, onSelect, onValueChange, token, trigger, value],
  );

  // Keys are taken on the field itself, before the composer's Enter-to-send.
  useEffect(() => {
    const el: HTMLElement | null = inputRef.current;
    if (!el || !open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.isComposing) return;
      const keys: Record<string, () => void> = {
        ArrowDown: () => model.move(1),
        ArrowUp: () => model.move(-1),
        Enter: () => accept(model.accept()),
        Tab: () => accept(model.accept()),
        // Escape closes the menu and never clears the field.
        Escape: close,
      };
      const run = keys[event.key];
      if (!run || (event.key === 'Enter' && event.shiftKey)) return;
      if ((event.key === 'Enter' || event.key === 'Tab') && state.activeIndex < 0) return;
      event.preventDefault();
      event.stopPropagation();
      run();
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [accept, close, inputRef, model, open, state.activeIndex]);

  // The field is the combobox while a menu is attached.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.setAttribute('role', 'combobox');
    el.setAttribute('aria-autocomplete', 'list');
    el.setAttribute('aria-controls', listId);
    el.setAttribute('aria-expanded', String(open));
    if (open && state.activeIndex >= 0) el.setAttribute('aria-activedescendant', optionId(state.activeIndex));
    else el.removeAttribute('aria-activedescendant');
  });

  return (
    <div data-aicl="trigger-menu" data-trigger={trigger} data-state={open ? 'open' : 'closed'} data-count={visible.length}>
      <ul id={listId} role="listbox" aria-label={`${trigger} suggestions`} hidden={!open}>
        {visible.length === 0 ? (
          <li role="presentation" data-aicl="trigger-menu-empty">
            {emptyLabel}
          </li>
        ) : (
          visible.map((item, index) => {
            const active = index === state.activeIndex;
            const disabled = isDisabled?.(item) ?? false;
            return (
              <li
                key={getKey(item)}
                id={optionId(index)}
                role="option"
                aria-selected={active}
                aria-disabled={disabled || undefined}
                data-active={active || undefined}
                // mousedown would blur the field; the menu must never take focus.
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => model.setActive(index)}
                onClick={() => !disabled && accept(item)}
              >
                {renderItem ? renderItem(item, { active }) : getLabel(item)}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

type PresetProps<I> = Omit<TriggerMenuProps<I>, 'trigger' | 'insert'>;

/** `/` inserts the command's text verbatim. */
export function SlashMenu<I>(props: PresetProps<I>) {
  return <TriggerMenu {...props} trigger="/" insert="text" />;
}

/** `@` inserts the label and reports a structured `Mention`. */
export function MentionMenu<I>(props: PresetProps<I>) {
  return <TriggerMenu {...props} trigger="@" insert="mention" />;
}

/* -------------------------------------------------------------------------- */
/* SuggestionChips                                                             */
/* -------------------------------------------------------------------------- */

export interface Suggestion {
  id: string;
  label: string;
  prompt?: string;
}

export interface SuggestionChipsProps {
  suggestions: Suggestion[];
  /** `insert` drafts the prompt for editing; `send` submits it. Default `insert`. */
  behavior?: 'insert' | 'send';
  onSelect: (suggestion: Suggestion, behavior: 'insert' | 'send') => void;
  ariaLabel?: string;
}

/** Optional chips for `Composer.Above`; never inside the field. */
export function SuggestionChips({ suggestions, behavior = 'insert', onSelect, ariaLabel = 'Suggestions' }: SuggestionChipsProps) {
  const [focus, setFocus] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  if (!suggestions.length) return null;
  const current = Math.min(focus, suggestions.length - 1);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (current + step + suggestions.length) % suggestions.length;
    setFocus(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      data-aicl="suggestion-chips"
      data-count={suggestions.length}
      data-behavior={behavior}
      role="group"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      {suggestions.map((s, index) => (
        <button
          key={s.id}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="button"
          data-aicl="suggestion-chip"
          // Roving tabindex: one tab stop for the whole row.
          tabIndex={index === current ? 0 : -1}
          onFocus={() => setFocus(index)}
          onClick={() => onSelect(s, behavior)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* AttachmentChip                                                              */
/* -------------------------------------------------------------------------- */

export interface AttachmentChipProps {
  attachment: Attachment;
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
}

const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`;

export function AttachmentChip({ attachment: a, onRemove, onRetry }: AttachmentChipProps) {
  const isImage = a.mediaType.startsWith('image/') && a.previewUrl;
  const percent = a.progress === undefined ? undefined : Math.round(a.progress * 100);
  return (
    <div
      data-aicl="attachment-chip"
      data-status={a.status}
      data-progress={percent}
      data-media-type={a.mediaType}
      data-has-preview={isImage ? '' : undefined}
    >
      {isImage ? <img data-aicl="attachment-preview" src={a.previewUrl} alt="" /> : null}
      <span data-aicl="attachment-name" title={a.name}>
        {a.name}
      </span>
      {a.size !== undefined && a.status !== 'uploading' ? (
        <span data-aicl="attachment-size">{formatBytes(a.size)}</span>
      ) : null}
      {a.status === 'uploading' ? (
        <span
          data-aicl="attachment-progress"
          role="progressbar"
          aria-label={`Uploading ${a.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        />
      ) : null}
      {a.status === 'error' ? (
        <span data-aicl="attachment-error" role="status">
          Upload failed
        </span>
      ) : null}
      {a.status === 'error' && onRetry ? (
        <button type="button" data-aicl="attachment-retry" aria-label={`Retry ${a.name}`} onClick={() => onRetry(a.id)}>
          Retry
        </button>
      ) : null}
      {onRemove ? (
        <button type="button" data-aicl="attachment-remove" aria-label={`Remove ${a.name}`} onClick={() => onRemove(a.id)}>
          ×
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* AttachmentDropzone                                                          */
/* -------------------------------------------------------------------------- */

export type FileOrigin = 'drop' | 'paste' | 'picker';
export type RejectReason = 'type' | 'size' | 'count';

export interface AttachmentDropzoneProps {
  onFiles: (files: File[], origin: FileOrigin) => void;
  /** Same grammar as `<input accept>`: MIME types, `type/*`, or `.ext`. */
  accept?: string;
  multiple?: boolean;
  maxSizeBytes?: number;
  disabled?: boolean;
  onReject?: (reason: RejectReason, files: File[]) => void;
  children: ReactNode;
}

const DropzoneContext = createContext<{ openPicker: () => void } | null>(null);

/**
 * The keyboard path into a dropzone: an attach button calls `openPicker`, so
 * drag and paste are never the only route.
 */
export function useAttachmentPicker(): { openPicker: () => void } {
  const ctx = useContext(DropzoneContext);
  if (!ctx) throw new Error('useAttachmentPicker must be used inside <AttachmentDropzone>.');
  return ctx;
}

export function matchesAccept(file: { name: string; type: string }, accept: string | undefined): boolean {
  if (!accept) return true;
  return accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) => {
      if (rule.startsWith('.')) return file.name.toLowerCase().endsWith(rule);
      if (rule.endsWith('/*')) return file.type.toLowerCase().startsWith(rule.slice(0, -1));
      return file.type.toLowerCase() === rule;
    });
}

export function AttachmentDropzone({
  onFiles,
  accept,
  multiple = true,
  maxSizeBytes,
  disabled = false,
  onReject,
  children,
}: AttachmentDropzoneProps) {
  const [dragover, setDragover] = useState(false);
  const [reject, setReject] = useState<RejectReason | 'none'>('none');
  const depth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const take = useCallback(
    (list: FileList | File[] | null, origin: FileOrigin) => {
      const files = Array.from(list ?? []);
      if (disabled || !files.length) return;
      const fail = (reason: RejectReason, bad: File[]) => {
        setReject(reason);
        onReject?.(reason, bad);
      };
      if (!multiple && files.length > 1) return fail('count', files);
      const wrongType = files.filter((f) => !matchesAccept(f, accept));
      if (wrongType.length) return fail('type', wrongType);
      const tooBig = maxSizeBytes === undefined ? [] : files.filter((f) => f.size > maxSizeBytes);
      if (tooBig.length) return fail('size', tooBig);
      setReject('none');
      onFiles(files, origin);
    },
    [accept, disabled, maxSizeBytes, multiple, onFiles, onReject],
  );

  const picker = useMemo(() => ({ openPicker: () => !disabled && inputRef.current?.click() }), [disabled]);

  const onDragEnter = (e: DragEvent) => {
    if (disabled || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    depth.current += 1;
    setDragover(true);
  };
  const onDragLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragover(false);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    depth.current = 0;
    setDragover(false);
    take(e.dataTransfer.files, 'drop');
  };
  const onPaste = (e: ClipboardEvent) => {
    if (!e.clipboardData.files.length) return;
    e.preventDefault();
    take(e.clipboardData.files, 'paste');
  };

  return (
    <DropzoneContext.Provider value={picker}>
      <div
        data-aicl="attachment-dropzone"
        data-dragover={dragover || undefined}
        data-reject={reject}
        data-disabled={disabled || undefined}
        onDragEnter={onDragEnter}
        onDragOver={(e) => dragover && e.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onPaste={onPaste}
      >
        {children}
        <input
          ref={inputRef}
          type="file"
          hidden
          tabIndex={-1}
          accept={accept}
          multiple={multiple}
          onChange={(e) => {
            take(e.target.files, 'picker');
            e.target.value = '';
          }}
        />
      </div>
    </DropzoneContext.Provider>
  );
}
