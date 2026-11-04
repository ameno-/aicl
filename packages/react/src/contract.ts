/**
 * The component contract.
 *
 * Every primitive publishes its slots and its states, and this file is the
 * single place that says what they are. A **slot** is a `data-aicl` value: a
 * stable name for a piece of the DOM that a skin or a consumer's CSS can
 * select on. A **state** is an attribute and the values it can take.
 *
 * Why a machine-readable contract, rather than prose:
 *
 *   - **A skin author needs the vocabulary.** The alternative is reading
 *     the source to find out what `data-aicl` values exist. The contract is
 *     the list.
 *   - **The registry needs it.** A registry item has to declare its slots,
 *     its states, and the tokens it reads, or it cannot be installed
 *     safely.
 *   - **An agent needs it.** A brief that names the slots and the states
 *     is enough to compose a primitive without reading its implementation.
 *   - **It can be checked.** A test compares this file against the source,
 *     so a slot that is added without being documented fails the build
 *     rather than quietly shipping.
 *
 * The slot names are public API, exactly like the token names. Changing one
 * is a breaking change.
 */

import type { IconSlot } from './icons.js';

/** One primitive. */
export interface PrimitiveContract {
  /** The primitive's public name, as exported from `@aicl/react`. */
  readonly name: string;
  /** One line: what the primitive is for. */
  readonly summary: string;
  /**
   * The source files it lives in, relative to `src/`. Used by the drift
   * test to check this contract against the implementation.
   */
  readonly source: readonly string[];
  /** The slots it renders, as `data-aicl` values. */
  readonly slots: readonly string[];
  /**
   * The states it exposes: the attribute, and the values it can take.
   * A slot's states are the attributes on that slot.
   */
  readonly states?: Readonly<Record<string, readonly string[]>>;
}

/** A slot every primitive may use. */
export interface SharedContract {
  /** The slots that are not owned by one primitive. */
  readonly slots: readonly string[];
  /** What each shared slot is for. */
  readonly purpose: Readonly<Record<string, string>>;
}

/**
 * The slots that belong to no single primitive.
 *
 * `icon` is the one that matters: every primitive's icon goes through it,
 * so a consumer's icon set applies everywhere.
 */
export const sharedSlots: SharedContract = {
  slots: ['icon', 'visually-hidden'],
  purpose: {
    icon: 'One icon. The role is in `data-aicl-icon`; the glyph comes from the icon provider.',
    'visually-hidden': 'Text for a screen reader, painted as nothing.',
  },
};

/**
 * The primitives.
 *
 * Ordered by the surface they belong to: the transcript, the composer, the
 * part renderers, the platform controls, and the navigation.
 */
export const primitives: readonly PrimitiveContract[] = [
  {
    name: 'Button',
    summary: 'A button. Variant, size and loading, with the glyphs as icon slots.',
    source: ['Button.tsx'],
    slots: ['button', 'button-label', 'button-icon'],
    states: {
      'data-variant': ['default', 'secondary', 'destructive', 'ghost', 'outline', 'link'],
      'data-size': ['sm', 'md', 'lg'],
      'data-loading': ['true'],
      'data-icon': ['true'],
    },
  },
  {
    name: 'Transcript',
    summary: 'The conversation: a scroller, the rows, and jump-to-latest. One live region for the thread.',
    source: ['Transcript.tsx'],
    slots: [
      'transcript-root',
      'transcript',
      'message-row',
      'message',
      'status-line',
      'day-separator',
      'scroll-to-bottom',
      'branch-switcher',
    ],
    states: {
      'data-status': ['idle', 'submitted', 'streaming', 'aborted', 'error'],
      'data-empty': ['true'],
      'data-at-bottom': ['true'],
      'data-role': ['user', 'assistant', 'system'],
      'data-alignment': ['end', 'full'],
      'data-state': ['streaming', 'complete', 'aborted'],
    },
  },
  {
    name: 'Composer',
    summary: 'The field, the submit action, the toolbar slots and the above-band.',
    source: ['Composer.tsx'],
    slots: [
      'composer',
      'composer-body',
      'composer-input',
      'composer-submit',
      'composer-attach',
      'composer-disabled-reason',
      'composer-hint',
      'attachment-row',
    ],
    states: {
      'data-state': ['ready', 'submitted', 'streaming', 'aborted'],
      'data-placement': ['docked', 'hero', 'rail'],
      'data-has-text': ['true'],
      'data-has-attachments': ['true'],
      'data-role': ['send', 'stop'],
    },
  },
  {
    name: 'PartRenderer',
    summary: 'Dispatches one part to its renderer. The default renderers follow.',
    source: ['parts.tsx', 'markdown.tsx'],
    slots: [
      'part',
      'reasoning',
      'reasoning-body',
      'tool-call',
      'tool-call-body',
      'artifact-card',
      'artifact-icon',
      'artifact-title',
      'artifact-meta',
      'artifact-kind',
      'artifact-version',
      'artifact-open',
      'code-block',
      'inline-code',
      'terminal-output',
    ],
    states: {
      'data-part': [
        'text',
        'reasoning',
        'tool-call',
        'tool-result',
        'artifact',
        'file',
        'error',
        'data-suggested-followups',
        'unknown',
      ],
      'data-format': ['markdown'],
      'data-state': ['pending', 'open', 'closed', 'uploading', 'uploaded'],
      'data-status': ['pending', 'running', 'success', 'error', 'cancelled'],
      'data-open': ['true'],
      'data-is-error': ['true'],
      'data-retryable': ['true'],
      'data-raw-type': ['true'],
      'data-behavior': ['insert'],
      'data-language': ['true'],
      'data-copied': ['true'],
      'data-inline': ['true'],
      'data-streaming': ['true'],
      'data-following': ['true'],
      'data-openable': ['true'],
    },
  },
  {
    name: 'MessageActions',
    summary: 'The per-message action row. Hidden until the row is hovered or focused.',
    source: ['MessageActions.tsx'],
    slots: ['message-actions'],
    states: {
      'data-visibility': ['auto', 'always'],
      'data-resolved': ['painted'],
      'data-feedback': ['up', 'down', 'none'],
      'data-role': ['user', 'assistant', 'system'],
      'data-copied': ['true'],
    },
  },
  {
    name: 'PlanChecklist',
    summary: 'An ordered plan with a derived rollup. Render only.',
    source: ['PlanChecklist.tsx'],
    slots: ['plan-checklist', 'plan-rollup', 'plan-title', 'plan-count'],
    states: {
      'data-count': ['true'],
      'data-progress': ['true'],
    },
  },
  {
    name: 'ComposerSurface',
    summary: 'The composer surface: trigger menus, suggestion chips, attachments.',
    source: ['composer-surface.tsx'],
    slots: [
      'trigger-menu',
      'trigger-menu-empty',
      'suggestion-chips',
      'suggestion-chip',
      'attachment-chip',
      'attachment-dropzone',
      'attachment-error',
      'attachment-icon',
      'attachment-name',
      'attachment-preview',
      'attachment-progress',
      'attachment-remove',
      'attachment-retry',
      'attachment-size',
    ],
    states: {
      'data-state': ['uploading', 'uploaded', 'error'],
      'data-empty': ['true'],
    },
  },
  {
    name: 'SessionList',
    summary: 'A host-agnostic session listbox, grouped by recency.',
    source: ['sessions.tsx'],
    slots: [
      'session-list',
      'session-list-header',
      'session-listbox',
      'session-list-empty',
      'session-list-skeleton',
      'session-list-sentinel',
      'session-skeleton',
      'session-item',
      'session-actions',
      'session-title',
      'session-secondary',
      'session-group',
      'session-group-label',
    ],
    states: {
      'data-empty': ['true'],
      'data-active': ['true'],
      'data-selected': ['true'],
    },
  },
  {
    name: 'SessionSearch',
    summary: 'One incremental combobox for sessions.',
    source: ['sessions.tsx'],
    slots: [
      'session-search',
      'session-search-icon',
      'session-search-input',
      'session-search-results',
      'session-search-status',
      'session-search-empty',
    ],
    states: {
      'data-empty': ['true'],
      'data-count': ['true'],
    },
  },
  {
    name: 'SidebarNav',
    summary: 'A vertical nav host with a controlled collapse.',
    source: ['sessions.tsx'],
    slots: [
      'sidebar-nav',
      'sidebar-nav-header',
      'sidebar-nav-list',
      'sidebar-nav-item',
      'sidebar-nav-icon',
      'sidebar-nav-label',
      'sidebar-nav-badge',
      'sidebar-nav-toggle',
      'sidebar-nav-footer',
    ],
    states: {
      'data-state': ['collapsed', 'expanded'],
      'data-active': ['true'],
      'data-collapsed': ['true'],
      'data-count': ['true'],
    },
  },
  {
    name: 'Dialog',
    summary: 'A modal on the top layer, with a focus trap and a focus return.',
    source: ['platform.tsx'],
    slots: [
      'dialog',
      'dialog-layer',
      'dialog-title',
      'dialog-description',
      'dialog-close',
      'scrim',
    ],
    states: {
      'data-state': ['open', 'closed'],
      'data-size': ['sm', 'md', 'lg'],
    },
  },
  {
    name: 'AlertDialog',
    summary: 'A modal that asks before it acts. The scrim does not dismiss it.',
    source: ['platform.tsx'],
    slots: [
      'alert-dialog',
      'alert-dialog-layer',
      'alert-dialog-actions',
      'alert-dialog-cancel',
      'alert-dialog-confirm',
      'alert-dialog-confirmation',
    ],
    states: {
      'data-state': ['open', 'closed'],
      'data-busy': ['true'],
    },
  },
  {
    name: 'Drawer',
    summary: 'A sheet that slides in from an edge. Swipe to dismiss.',
    source: ['platform.tsx'],
    slots: ['drawer', 'drawer-layer'],
    states: {
      'data-state': ['open', 'closed'],
      'data-side': ['start', 'end'],
    },
  },
  {
    name: 'ToastRegion',
    summary: 'Transient status in a corner region. One live region, polite by default.',
    source: ['platform.tsx'],
    slots: ['toast-region'],
    states: {
      'data-placement': ['top-start', 'top-center', 'top-end', 'bottom-start', 'bottom-end'],
    },
  },
  {
    name: 'Toast',
    summary: 'One transient status message, with an optional action.',
    source: ['platform.tsx'],
    slots: ['toast', 'toast-icon', 'toast-title', 'toast-description', 'toast-action', 'toast-dismiss'],
    states: {
      'data-variant': ['info', 'success', 'error'],
    },
  },
  {
    name: 'Field',
    summary: 'A label, a control, a description, an error and a save acknowledgement.',
    source: ['platform.tsx'],
    slots: ['field', 'field-label', 'field-description', 'field-error', 'field-save-state'],
    states: {
      'data-invalid': ['true'],
      'data-save-state': ['idle', 'saving', 'saved', 'error'],
    },
  },
  {
    name: 'Switch',
    summary: 'A toggle. The label is a real label, not a placeholder for one.',
    source: ['platform.tsx'],
    slots: ['switch', 'switch-root', 'switch-label', 'switch-thumb'],
    states: {
      'data-state': ['checked', 'unchecked'],
      'data-disabled': ['true'],
      'data-busy': ['true'],
      'data-error': ['true'],
    },
  },
  {
    name: 'Select',
    summary: 'A listbox trigger with typeahead.',
    source: ['platform.tsx'],
    slots: [
      'select',
      'select-trigger',
      'select-value',
      'select-listbox',
      'select-option-label',
      'select-option-description',
      'select-option-check',
    ],
    states: {
      'data-state': ['open', 'closed'],
      'data-size': ['sm', 'md'],
      'data-selected': ['true'],
      'data-disabled': ['true'],
    },
  },
  {
    name: 'SegmentedControl',
    summary: 'One tab stop, arrow keys move and select.',
    source: ['platform.tsx'],
    slots: ['segmented', 'segmented-item', 'segmented-icon'],
    states: {
      'data-state': ['selected', 'unselected'],
      'data-size': ['sm', 'md'],
    },
  },
  {
    name: 'Tooltip',
    summary: 'A short label on hover or focus. The delay is the fast motion tier.',
    source: ['Tooltip.tsx'],
    slots: ['tooltip', 'tooltip-trigger', 'tooltip-content'],
    states: {
      'data-state': ['open', 'closed'],
      'data-side': ['top', 'bottom', 'start', 'end'],
    },
  },
  {
    name: 'Badge',
    summary: 'A status chip. Quiet colour, never a button.',
    source: ['Badge.tsx'],
    slots: ['badge'],
    states: {
      'data-variant': ['default', 'secondary', 'success', 'warning', 'danger', 'outline'],
    },
  },
  {
    name: 'Separator',
    summary: 'A line between groups. Decorative by default.',
    source: ['Separator.tsx'],
    slots: ['separator'],
    states: {
      'data-orientation': ['horizontal', 'vertical'],
    },
  },
  {
    name: 'Kbd',
    summary: 'A keyboard hint. Pass keys for a chord, or children for free text.',
    source: ['Kbd.tsx'],
    slots: ['kbd', 'kbd-key'],
  },
  {
    name: 'Progress',
    summary: 'A determined bar, or an indeterminate pulse. The fill uses scaleX.',
    source: ['Progress.tsx'],
    slots: ['progress', 'progress-fill'],
    states: {
      'data-state': ['determinate', 'indeterminate'],
    },
  },
  {
    name: 'Collapsible',
    summary: 'A disclosure. Height is not animated; opacity is.',
    source: ['Collapsible.tsx'],
    slots: ['collapsible', 'collapsible-trigger', 'collapsible-icon', 'collapsible-content'],
    states: {
      'data-state': ['open', 'closed'],
    },
  },
  {
    name: 'Tabs',
    summary: 'One tab stop, arrows move, a travelling pill follows the selected tab.',
    source: ['Tabs.tsx'],
    slots: ['tabs', 'tabs-list', 'tabs-tab', 'tabs-indicator', 'tabs-panel'],
    states: {
      'data-state': ['active', 'inactive'],
    },
  },
];

/** Every slot the library renders, across every primitive. */
export function allSlots(): string[] {
  const slots = new Set<string>(sharedSlots.slots);
  for (const primitive of primitives) {
    for (const slot of primitive.slots) slots.add(slot);
  }
  return [...slots].sort();
}

/** The primitives that render a given slot. */
export function primitivesForSlot(slot: string): string[] {
  return primitives
    .filter((primitive) => primitive.slots.includes(slot))
    .map((primitive) => primitive.name);
}

/** The icon roles the library uses. Every one is swappable. */
export const iconRoles: readonly IconSlot[] = [
  'close',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'arrow-down',
  'arrow-up',
  'panel-left',
  'plus',
  'search',
  'send',
  'stop',
  'copy',
  'check',
  'retry',
  'edit',
  'thumb-up',
  'thumb-down',
  'spinner',
  'info',
  'success',
  'alert',
  'failure',
  'pending',
  'cancelled',
  'attachment',
  'document',
  'code',
  'diff',
  'preview',
  'terminal',
  'table',
  'chart',
  'reasoning',
];
