/**
 * Platform primitives (blueprint §4.18–§4.20, D10): overlays, toasts, and form
 * controls that chat surfaces need — delete confirms, model pickers, stream
 * error toasts. Pages built from them are recipes, not API.
 */

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { createComboboxModel, type ToastQueue, type ToastState } from '@aicl/core';
import { useReadable } from './useReadable.js';

/* -------------------------------------------------------------------------- */
/* Modal layer: trap, top-layer Escape, inert background, focus return         */
/* -------------------------------------------------------------------------- */

export type DismissReason = 'escape' | 'scrim' | 'close-button' | 'swipe' | 'programmatic';

/** Open layers, oldest first. Only the last one answers Escape and the scrim. */
const layers: symbol[] = [];

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface LayerProps {
  open: boolean;
  kind: 'dialog' | 'alert-dialog' | 'drawer';
  role: 'dialog' | 'alertdialog';
  attrs: Record<string, string | boolean | undefined>;
  dismissOnEscape: boolean;
  dismissOnScrimClick: boolean;
  /** CSS selector inside the content, `'container'`, or `'first'` (default). */
  initialFocus?: string;
  returnFocus: boolean;
  portal: boolean;
  onDismiss: (reason: DismissReason) => void;
  ids: { title: string; description: string };
  children: ReactNode;
  contentProps?: Record<string, unknown>;
}

function ModalLayer({
  open,
  kind,
  role,
  attrs,
  dismissOnEscape,
  dismissOnScrimClick,
  initialFocus = 'first',
  returnFocus,
  portal,
  onDismiss,
  ids,
  children,
  contentProps,
}: LayerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const token = useMemo(() => Symbol(kind), [kind]);
  const isTop = () => layers[layers.length - 1] === token;

  useLayoutEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const previous = document.activeElement as HTMLElement | null;
    layers.push(token);

    // Everything outside this layer becomes inert while it is on top.
    const host = hostRef.current;
    const inerted: Element[] = [];
    for (const el of Array.from(document.body.children)) {
      if (host && (el === host || el.contains(host))) continue;
      if (!el.hasAttribute('inert')) {
        el.setAttribute('inert', '');
        el.setAttribute('aria-hidden', 'true');
        inerted.push(el);
      }
    }

    const content = contentRef.current;
    if (content) {
      const target =
        initialFocus === 'container'
          ? content
          : initialFocus === 'first'
            ? content.querySelector<HTMLElement>(FOCUSABLE)
            : content.querySelector<HTMLElement>(initialFocus);
      (target ?? content).focus();
    }

    return () => {
      layers.splice(layers.indexOf(token), 1);
      for (const el of inerted) {
        el.removeAttribute('inert');
        el.removeAttribute('aria-hidden');
      }
      if (returnFocus) previous?.focus?.();
    };
  }, [initialFocus, open, returnFocus, token]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isTop() && layers.length) return;
    if (event.key === 'Escape' && dismissOnEscape) {
      event.stopPropagation();
      onDismiss('escape');
      return;
    }
    if (event.key !== 'Tab') return;
    const content = contentRef.current;
    if (!content) return;
    const focusable = Array.from(content.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === content)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  const tree = (
    <div ref={hostRef} data-aicl={`${kind}-layer`} data-state="open" onKeyDown={onKeyDown}>
      <div
        data-aicl="scrim"
        aria-hidden="true"
        onClick={() => {
          if (dismissOnScrimClick && (isTop() || !layers.length)) onDismiss('scrim');
        }}
      />
      <div
        ref={contentRef}
        role={role}
        aria-modal="true"
        aria-labelledby={ids.title}
        aria-describedby={ids.description}
        tabIndex={-1}
        data-aicl={kind}
        data-state="open"
        data-modal=""
        {...attrs}
        {...contentProps}
      >
        {children}
      </div>
    </div>
  );

  return portal && typeof document !== 'undefined' ? createPortal(tree, document.body) : tree;
}

/* -------------------------------------------------------------------------- */
/* Dialog                                                                      */
/* -------------------------------------------------------------------------- */

interface DialogContextValue {
  titleId: string;
  descriptionId: string;
  close: (reason?: DismissReason) => void;
}
const DialogContext = createContext<DialogContextValue | null>(null);
const useDialog = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('Dialog parts must be used inside <Dialog>, <AlertDialog>, or <Drawer>.');
  return ctx;
};

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean, reason: DismissReason) => void;
  /** `lg` reaches ~85% of the viewport with internal scrolling. */
  size?: 'sm' | 'md' | 'lg';
  dismissOnEscape?: boolean;
  dismissOnScrimClick?: boolean;
  initialFocus?: string;
  returnFocus?: boolean;
  /** When dirty, every dismiss path goes through `onDismissRequest`. */
  dirty?: boolean;
  /** Return `false` to veto a dismissal (e.g. to confirm discarding edits). */
  onDismissRequest?: (reason: DismissReason) => boolean | void;
  saveState?: 'idle' | 'saving' | 'saved' | 'error';
  /** Render in place instead of a body portal (tests, nested shadow roots). */
  portal?: boolean;
  children: ReactNode;
}

function useDismiss(
  onOpenChange: DialogProps['onOpenChange'],
  onDismissRequest: DialogProps['onDismissRequest'],
) {
  return useCallback(
    (reason: DismissReason) => {
      if (onDismissRequest?.(reason) === false) return;
      onOpenChange(false, reason);
    },
    [onDismissRequest, onOpenChange],
  );
}

function DialogRoot({
  open,
  onOpenChange,
  size = 'md',
  dismissOnEscape = true,
  dismissOnScrimClick = true,
  initialFocus,
  returnFocus = true,
  dirty = false,
  onDismissRequest,
  saveState,
  portal = true,
  children,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dismiss = useDismiss(onOpenChange, onDismissRequest);
  const ctx = useMemo(
    () => ({ titleId, descriptionId, close: (reason: DismissReason = 'close-button') => dismiss(reason) }),
    [descriptionId, dismiss, titleId],
  );
  return (
    <DialogContext.Provider value={ctx}>
      <ModalLayer
        open={open}
        kind="dialog"
        role="dialog"
        attrs={{ 'data-size': size, 'data-dirty': dirty || undefined, 'data-save-state': saveState }}
        dismissOnEscape={dismissOnEscape}
        dismissOnScrimClick={dismissOnScrimClick}
        initialFocus={initialFocus}
        returnFocus={returnFocus}
        portal={portal}
        onDismiss={dismiss}
        ids={{ title: titleId, description: descriptionId }}
      >
        {children}
      </ModalLayer>
    </DialogContext.Provider>
  );
}

function DialogTitle({ children }: { children: ReactNode }) {
  return (
    <h2 id={useDialog().titleId} data-aicl="dialog-title">
      {children}
    </h2>
  );
}

function DialogDescription({ children }: { children: ReactNode }) {
  return (
    <div id={useDialog().descriptionId} data-aicl="dialog-description">
      {children}
    </div>
  );
}

function DialogClose({ children = 'Close', ariaLabel }: { children?: ReactNode; ariaLabel?: string }) {
  const { close } = useDialog();
  return (
    <button type="button" data-aicl="dialog-close" aria-label={ariaLabel} onClick={() => close('close-button')}>
      {children}
    </button>
  );
}

export const Dialog = Object.assign(DialogRoot, {
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
});

/* -------------------------------------------------------------------------- */
/* AlertDialog                                                                 */
/* -------------------------------------------------------------------------- */

export interface AlertDialogProps extends Omit<DialogProps, 'dismissOnScrimClick' | 'size' | 'children' | 'initialFocus'> {
  title: string;
  variant: 'danger' | 'warning';
  /** Required: what will happen, in plain words. Wired as the description. */
  consequence: string;
  /** Opt-in typed confirmation: confirm stays disabled until the field matches. */
  confirmationValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmStatus?: 'idle' | 'loading' | 'done';
  onConfirm: () => void;
  children?: ReactNode;
}

/** Destructive confirm. No scrim dismissal; initial focus is Cancel. */
export function AlertDialog({
  open,
  onOpenChange,
  title,
  variant,
  consequence,
  confirmationValue,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  confirmStatus = 'idle',
  onConfirm,
  dismissOnEscape = true,
  returnFocus = true,
  dirty,
  onDismissRequest,
  portal = true,
  children,
}: AlertDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);
  const dismiss = useDismiss(onOpenChange, onDismissRequest);
  const loading = confirmStatus === 'loading';
  const enabled = !loading && (confirmationValue === undefined || typed === confirmationValue);
  const ctx = useMemo(
    () => ({ titleId, descriptionId, close: (reason: DismissReason = 'close-button') => dismiss(reason) }),
    [descriptionId, dismiss, titleId],
  );

  return (
    <DialogContext.Provider value={ctx}>
      <ModalLayer
        open={open}
        kind="alert-dialog"
        role="alertdialog"
        attrs={{
          'data-variant': variant,
          'data-confirm-enabled': enabled || undefined,
          'data-confirm-state': loading ? 'confirming' : confirmStatus === 'done' ? 'done' : 'idle',
          'data-dirty': dirty || undefined,
        }}
        dismissOnEscape={dismissOnEscape && !loading}
        dismissOnScrimClick={false}
        initialFocus='[data-aicl="alert-dialog-cancel"]'
        returnFocus={returnFocus}
        portal={portal}
        onDismiss={dismiss}
        ids={{ title: titleId, description: descriptionId }}
      >
        <h2 id={titleId} data-aicl="dialog-title">
          {title}
        </h2>
        <p id={descriptionId} data-aicl="dialog-description">
          {consequence}
        </p>
        {children}
        {confirmationValue !== undefined ? (
          <label data-aicl="alert-dialog-confirmation">
            <span>
              Type <strong>{confirmationValue}</strong> to confirm
            </span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
          </label>
        ) : null}
        <div data-aicl="alert-dialog-actions">
          <button type="button" data-aicl="alert-dialog-cancel" disabled={loading} onClick={() => dismiss('close-button')}>
            {cancelLabel}
          </button>
          <button
            type="button"
            data-aicl="alert-dialog-confirm"
            data-variant={variant}
            disabled={!enabled}
            aria-busy={loading || undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </ModalLayer>
    </DialogContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/* Drawer                                                                      */
/* -------------------------------------------------------------------------- */

export interface DrawerProps extends DialogProps {
  side: 'left' | 'right' | 'bottom';
  swipeToDismiss?: boolean;
}

const SWIPE_DISMISS_RATIO = 0.3;

export function Drawer({
  side,
  swipeToDismiss = true,
  open,
  onOpenChange,
  size = 'md',
  dismissOnEscape = true,
  dismissOnScrimClick = true,
  initialFocus,
  returnFocus = true,
  dirty = false,
  onDismissRequest,
  portal = true,
  children,
}: DrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dismiss = useDismiss(onOpenChange, onDismissRequest);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ start: number; extent: number } | null>(null);
  const ctx = useMemo(
    () => ({ titleId, descriptionId, close: (reason: DismissReason = 'close-button') => dismiss(reason) }),
    [descriptionId, dismiss, titleId],
  );

  // Distance travelled toward the closed edge, never away from it.
  const travel = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current!;
    const pos = side === 'bottom' ? e.clientY : e.clientX;
    const delta = pos - d.start;
    return Math.max(0, side === 'left' ? -delta : delta);
  };

  const contentProps = swipeToDismiss
    ? {
        onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
          if ((e.target as HTMLElement).closest(FOCUSABLE)) return;
          const rect = e.currentTarget.getBoundingClientRect();
          drag.current = { start: side === 'bottom' ? e.clientY : e.clientX, extent: side === 'bottom' ? rect.height : rect.width };
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        },
        onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
          if (!drag.current) return;
          // A custom property, not a visual style: the theme decides how to paint it.
          e.currentTarget.style.setProperty('--aicl-drawer-drag', `${travel(e)}px`);
        },
        onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
          if (!drag.current) return;
          const done = travel(e) > drag.current.extent * SWIPE_DISMISS_RATIO;
          drag.current = null;
          e.currentTarget.style.removeProperty('--aicl-drawer-drag');
          setDragging(false);
          if (done) dismiss('swipe');
        },
      }
    : undefined;

  return (
    <DialogContext.Provider value={ctx}>
      <ModalLayer
        open={open}
        kind="drawer"
        role="dialog"
        attrs={{
          'data-side': side,
          'data-size': size,
          'data-dirty': dirty || undefined,
          'data-state': dragging ? 'dragging' : 'open',
        }}
        dismissOnEscape={dismissOnEscape}
        dismissOnScrimClick={dismissOnScrimClick}
        initialFocus={initialFocus}
        returnFocus={returnFocus}
        portal={portal}
        onDismiss={dismiss}
        ids={{ title: titleId, description: descriptionId }}
        contentProps={contentProps}
      >
        {children}
      </ModalLayer>
    </DialogContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/* ToastRegion + Toast                                                         */
/* -------------------------------------------------------------------------- */

export interface ToastProps {
  toast: ToastState;
  onDismiss: (id: string) => void;
  renderAction?: (toast: ToastState) => ReactNode;
}

export function Toast({ toast, onDismiss, renderAction }: ToastProps) {
  // Errors that need action interrupt; everything else waits its turn.
  const assertive = toast.variant === 'error' && toast.action !== undefined;
  return (
    <div
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
      tabIndex={0}
      data-aicl="toast"
      data-variant={toast.variant}
      data-state={toast.paused ? 'paused' : 'open'}
      data-has-action={toast.action ? '' : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss(toast.id);
      }}
    >
      <div data-aicl="toast-title">{toast.title}</div>
      {toast.description ? <div data-aicl="toast-description">{toast.description}</div> : null}
      {renderAction
        ? renderAction(toast)
        : toast.action
          ? (
              <button
                type="button"
                data-aicl="toast-action"
                onClick={() => {
                  toast.action!.onAction();
                  onDismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )
          : null}
      <button type="button" data-aicl="toast-dismiss" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>
        ×
      </button>
    </div>
  );
}

export interface ToastRegionProps {
  queue: ToastQueue;
  placement?: 'bottom-end' | 'bottom-start' | 'top-center' | 'top-start';
  ariaLabel?: string;
  children?: (toast: ToastState, a: { dismiss(): void }) => ReactNode;
}

/** The region; `createToastQueue` owns the queue and timers. Hover or focus pauses every timer. */
export function ToastRegion({ queue, placement = 'bottom-end', ariaLabel = 'Notifications', children }: ToastRegionProps) {
  const toasts = useReadable(queue.state);
  return (
    <section
      aria-label={ariaLabel}
      data-aicl="toast-region"
      data-placement={placement}
      data-count={toasts.length}
      onMouseEnter={queue.pauseAll}
      onMouseLeave={queue.resumeAll}
      onFocus={queue.pauseAll}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) queue.resumeAll();
      }}
    >
      {toasts.map((t) =>
        children ? (
          <div key={t.id}>{children(t, { dismiss: () => queue.dismiss(t.id) })}</div>
        ) : (
          <Toast key={t.id} toast={t} onDismiss={queue.dismiss} />
        ),
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Field                                                                       */
/* -------------------------------------------------------------------------- */

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_COPY: Record<SaveState, string> = { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Couldn’t save' };

export interface FieldProps {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  /** `explicit` is the composite-form default; `auto` commits per change and must acknowledge. */
  saveMode?: 'explicit' | 'auto';
  saveState?: SaveState;
  dirty?: boolean;
  /** One control. Native inputs receive id, aria-describedby, and aria-invalid. */
  children: ReactElement;
}

export function Field({ label, description, error, required, saveMode = 'explicit', saveState = 'idle', dirty, children }: FieldProps) {
  const base = useId();
  const controlId = `${base}-control`;
  const descId = description ? `${base}-desc` : undefined;
  const errId = error ? `${base}-err` : undefined;
  const describedBy = [descId, errId].filter(Boolean).join(' ') || undefined;
  const control = Children.only(children);
  const wired = isValidElement(control)
    ? cloneElement(control as ReactElement<Record<string, unknown>>, {
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required || undefined,
      })
    : control;

  return (
    <div
      data-aicl="field"
      data-dirty={dirty || undefined}
      data-invalid={error ? '' : undefined}
      data-save-state={saveState}
      data-save-mode={saveMode}
    >
      <label htmlFor={controlId} data-aicl="field-label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {wired}
      {description ? (
        <div id={descId} data-aicl="field-description">
          {description}
        </div>
      ) : null}
      {error ? (
        <div id={errId} data-aicl="field-error">
          {error}
        </div>
      ) : null}
      <span data-aicl="field-save-state" role="status" aria-live="polite">
        {SAVE_COPY[saveState]}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Switch                                                                      */
/* -------------------------------------------------------------------------- */

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  /** Drives the optimistic toggle: the consumer rolls `checked` back on error. */
  status?: 'idle' | 'saving' | 'error';
  id?: string;
  'aria-describedby'?: string;
}

export function Switch({ checked, onCheckedChange, disabled, label, status = 'idle', id, ...aria }: SwitchProps) {
  const labelId = useId();
  return (
    <span data-aicl="switch-root">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={label ? labelId : undefined}
        aria-describedby={aria['aria-describedby']}
        aria-busy={status === 'saving' || undefined}
        disabled={disabled}
        data-aicl="switch"
        data-state={checked ? 'checked' : 'unchecked'}
        data-save-state={status}
        // Commits on toggle, never on blur.
        onClick={() => onCheckedChange(!checked)}
      >
        <span data-aicl="switch-thumb" aria-hidden="true" />
      </button>
      {label ? (
        <span id={labelId} data-aicl="switch-label">
          {label}
        </span>
      ) : null}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Select                                                                      */
/* -------------------------------------------------------------------------- */

export interface SelectOption<T> {
  value: T;
  label: string;
  disabled?: boolean;
  description?: string;
}

export interface SelectProps<T> {
  value: T | undefined;
  options: SelectOption<T>[];
  onValueChange: (value: T) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  saveMode?: 'explicit' | 'auto';
  ariaLabel?: string;
  id?: string;
  'aria-describedby'?: string;
}

const TYPEAHEAD_MS = 500;

export function Select<T>({
  value,
  options,
  onValueChange,
  placeholder = 'Select…',
  size = 'md',
  saveMode = 'auto',
  ariaLabel,
  id,
  ...aria
}: SelectProps<T>) {
  const base = useId();
  const listId = `${base}-list`;
  const optionId = (i: number) => `${base}-opt-${i}`;
  const model = useMemo(() => createComboboxModel<SelectOption<T>>({ isDisabled: (o) => o.disabled ?? false }), []);
  const state = useReadable(model.state);
  const typeahead = useRef({ buffer: '', at: 0 });
  const selectedIndex = options.findIndex((o) => Object.is(o.value, value));
  const selected = options[selectedIndex];

  useEffect(() => model.setItems(options), [model, options]);

  const openAtSelected = () => {
    model.open();
    if (selectedIndex >= 0) model.setActive(selectedIndex);
  };
  const commit = () => {
    const option = model.accept();
    if (option) onValueChange(option.value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const { key } = event;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      if (!state.open) openAtSelected();
      else model.move(key === 'ArrowDown' ? 1 : -1);
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (state.open) commit();
      else openAtSelected();
    } else if (key === 'Escape' && state.open) {
      event.preventDefault();
      event.stopPropagation();
      model.close();
    } else if (key === 'Home' || key === 'End') {
      event.preventDefault();
      model.open();
      model.setActive(key === 'Home' ? 0 : options.length - 1);
    } else if (key.length === 1 && !event.metaKey && !event.ctrlKey) {
      // Typeahead: consecutive keystrokes within the window build one prefix.
      const now = Date.now();
      const t = typeahead.current;
      t.buffer = now - t.at > TYPEAHEAD_MS ? key.toLowerCase() : t.buffer + key.toLowerCase();
      t.at = now;
      const match = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(t.buffer));
      if (match >= 0) {
        model.open();
        model.setActive(match);
      }
    }
  };

  return (
    <div data-aicl="select" data-state={state.open ? 'open' : 'closed'} data-size={size} data-value={value === undefined ? undefined : String(value)} data-save-mode={saveMode}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={state.open}
        aria-controls={listId}
        aria-activedescendant={state.open && state.activeIndex >= 0 ? optionId(state.activeIndex) : undefined}
        aria-label={ariaLabel}
        aria-describedby={aria['aria-describedby']}
        data-aicl="select-trigger"
        data-placeholder={selected ? undefined : ''}
        onClick={() => (state.open ? model.close() : openAtSelected())}
        onKeyDown={onKeyDown}
        onBlur={() => model.close()}
      >
        {selected?.label ?? placeholder}
      </button>
      <ul id={listId} role="listbox" hidden={!state.open} data-aicl="select-listbox">
        {options.map((o, i) => (
          <li
            key={optionId(i)}
            id={optionId(i)}
            role="option"
            aria-selected={i === selectedIndex}
            aria-disabled={o.disabled || undefined}
            data-active={i === state.activeIndex || undefined}
            onMouseDown={(e) => e.preventDefault()}
            onMouseMove={() => model.setActive(i)}
            onClick={() => {
              if (o.disabled) return;
              model.setActive(i);
              commit();
            }}
          >
            <span data-aicl="select-option-label">{o.label}</span>
            {o.description ? <span data-aicl="select-option-description">{o.description}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SegmentedControl                                                            */
/* -------------------------------------------------------------------------- */

export interface SegmentedControlProps<T> {
  value: T;
  options: { value: T; label: string; icon?: ReactNode; disabled?: boolean }[];
  onValueChange: (value: T) => void;
  ariaLabel: string;
  saveState?: SaveState;
}

/** APG radio group: arrows move and select, Home/End jump, one tab stop. */
export function SegmentedControl<T>({ value, options, onValueChange, ariaLabel, saveState }: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = options.findIndex((o) => Object.is(o.value, value));

  const select = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onValueChange(option.value);
    refs.current[index]?.focus();
  };

  const step = (from: number, delta: 1 | -1) => {
    for (let i = 1; i <= options.length; i++) {
      const next = (((from + delta * i) % options.length) + options.length) % options.length;
      if (!options[next]!.disabled) return next;
    }
    return from;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = Math.max(0, current);
    const target: Record<string, number> = {
      ArrowRight: step(from, 1),
      ArrowDown: step(from, 1),
      ArrowLeft: step(from, -1),
      ArrowUp: step(from, -1),
      Home: step(-1, 1),
      End: step(options.length, -1),
    };
    if (!(event.key in target)) return;
    event.preventDefault();
    select(target[event.key]!);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-aicl="segmented"
      data-value={String(value)}
      data-save-state={saveState}
      onKeyDown={onKeyDown}
    >
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === current}
          tabIndex={i === current || (current < 0 && i === 0) ? 0 : -1}
          disabled={o.disabled}
          data-aicl="segmented-item"
          data-active={i === current || undefined}
          onClick={() => select(i)}
        >
          {o.icon ? (
            <span data-aicl="segmented-icon" aria-hidden="true">
              {o.icon}
            </span>
          ) : null}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
