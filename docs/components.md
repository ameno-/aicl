# The component contract

Every primitive publishes its slots and its states, and
`packages/react/src/contract.ts` is the single place that says what they
are. A **slot** is a `data-aicl` value: a stable name for a piece of the
DOM that a skin or a consumer's CSS can select on. A **state** is an
attribute and the values it can take.

The names are public API. Changing one is a breaking change.

The **catalog** is how a component is found, read, and installed. Every
item below has a page under `docs/components/` and an `npx aicl add`
command. A component is not incorporated until it is in this list.

| Item | Type | What it is for |
| --- | --- | --- |
| [`token-contract`](components/token-contract.md) | theme | Every visual decision as a named custom property, plus the primitive surfaces. |
| [`looseleaf`](components/looseleaf.md) | theme | Paper on a desk. Values only: no JavaScript, so it cannot change behaviour. |
| [`motion`](components/motion.md) | lib | Three spring tiers, their exits, fluid hover, and weight without reflow. |
| [`icon-slots`](components/icon-slots.md) | lib | Icons looked up by role, swappable through one provider. A primitive never imports an icon. |
| [`cn`](components/cn.md) | lib | clsx + tailwind-merge. The `@aicl/fx` components compose class names through it. |
| [`fx-provider`](components/fx-provider.md) | lib | Sets motion reducedMotion="user" and the data-fx scope vendored components assume. |
| [`use-chat`](components/use-chat.md) | hook | Binds a ChatController to React. Status, messages, send, stop, and the streaming id. |
| [`use-readable`](components/use-readable.md) | hook | Subscribe a React component to a core store without pulling the store into the tree. |
| [`use-fluid-hover`](components/use-fluid-hover.md) | hook | One travelling highlight per list. The nearest-item rule is a pure function. |
| [`button`](components/button.md) | ui | A button. Variant, size and loading, with the glyphs as icon slots. |
| [`transcript`](components/transcript.md) | ui | The conversation: a scroller, the rows, and jump-to-latest. One live region for the thread. |
| [`composer`](components/composer.md) | ui | The field, the submit action, the toolbar slots and the above-band. |
| [`part-renderer`](components/part-renderer.md) | ui | Dispatches one part to its renderer. The default renderers follow. |
| [`message-actions`](components/message-actions.md) | ui | The per-message action row. Hidden until the row is hovered or focused. |
| [`plan-checklist`](components/plan-checklist.md) | ui | An ordered plan with a derived rollup. Render only. |
| [`composer-surface`](components/composer-surface.md) | ui | The composer surface: trigger menus, suggestion chips, attachments. |
| [`session-list`](components/session-list.md) | ui | A host-agnostic session listbox, grouped by recency. |
| [`session-search`](components/session-search.md) | ui | One incremental combobox for sessions. |
| [`sidebar-nav`](components/sidebar-nav.md) | ui | A vertical nav host with a controlled collapse. |
| [`dialog`](components/dialog.md) | ui | A modal on the top layer, with a focus trap and a focus return. |
| [`alert-dialog`](components/alert-dialog.md) | ui | A modal that asks before it acts. The scrim does not dismiss it. |
| [`drawer`](components/drawer.md) | ui | A sheet that slides in from an edge. Swipe to dismiss. |
| [`toast-region`](components/toast-region.md) | ui | Transient status in a corner region. One live region, polite by default. |
| [`toast`](components/toast.md) | ui | One transient status message, with an optional action. |
| [`field`](components/field.md) | ui | A label, a control, a description, an error and a save acknowledgement. |
| [`switch`](components/switch.md) | ui | A toggle. The label is a real label, not a placeholder for one. |
| [`select`](components/select.md) | ui | A listbox trigger with typeahead. |
| [`segmented-control`](components/segmented-control.md) | ui | One tab stop, arrow keys move and select. |
| [`tooltip`](components/tooltip.md) | ui | A short label on hover or focus. The delay is the fast motion tier. |
| [`badge`](components/badge.md) | ui | A status chip. Quiet colour, never a button. |
| [`separator`](components/separator.md) | ui | A line between groups. Decorative by default. |
| [`kbd`](components/kbd.md) | ui | A keyboard hint. Pass keys for a chord, or children for free text. |
| [`progress`](components/progress.md) | ui | A determined bar, or an indeterminate pulse. The fill uses scaleX. |
| [`collapsible`](components/collapsible.md) | ui | A disclosure. Height is not animated; opacity is. |
| [`tabs`](components/tabs.md) | ui | One tab stop, arrows move, a travelling pill follows the selected tab. |
| [`streaming-text`](components/streaming-text.md) | ui | Tokens arrive. Character, word, or instant reveal, with a caret that does not reflow. |
| [`thinking-indicator`](components/thinking-indicator.md) | ui | Shimmer, dots or bars while the model thinks; collapses to "Thought for 24s". |
| [`work-summary`](components/work-summary.md) | ui | Devin-style "Worked for 11s" disclosure; animates open and closed. |
| [`tool-call-card`](components/tool-call-card.md) | ui | A live tool-call card: pending, running, success, error, cancelled. |
| [`animated-plan`](components/animated-plan.md) | ui | A plan whose steps tick through pending, running and done. |
| [`rolling-number`](components/rolling-number.md) | ui | A number that rolls to its next value. Jumps under reduced motion. |
| [`live-terminal`](components/live-terminal.md) | ui | Streaming shell output, stick-to-bottom, with a quiet chrome. |
| [`status-island`](components/status-island.md) | ui | A compact status chip that morphs between idle, working and done. |
| [`fx-code-block`](components/fx-code-block.md) | ui | A highlighted code block with a copy button. The animated sibling of the primitive. |
| [`border-beam`](components/border-beam.md) | ui | A light that travels around the parent border. Static under reduced motion. |
| [`prompt-composer`](components/prompt-composer.md) | ui | The styled composer: attachments, a model picker, send that morphs into stop. |
| [`model-picker`](components/model-picker.md) | ui | A model menu on a smooth dropdown. |
| [`smooth-dropdown`](components/smooth-dropdown.md) | ui | A dropdown whose panel size springs to the content. |
| [`suggestion-stack`](components/suggestion-stack.md) | ui | Follow-up chips that fan into a stack. The cousin of Fluid's queued-stack. |
| [`approval-card`](components/approval-card.md) | ui | Allow, deny, or always-allow a pending tool call. |
| [`question-card`](components/question-card.md) | ui | A single question with options. The narrow form of Fluid's ask-user-questions. |
| [`toaster`](components/toaster.md) | ui | The styled toast host. Call `toast()` from anywhere under it. |
| [`segmented-tabs`](components/segmented-tabs.md) | ui | A sliding pill, or discrete tabs that widen to show the label. |
| [`inline-edit`](components/inline-edit.md) | ui | Click-to-edit text. Enter commits, Escape reverts. |
| [`fx-kbd`](components/fx-kbd.md) | ui | The animated keyboard hint. The headless primitive is `kbd`. |
| [`command-menu`](components/command-menu.md) | ui | A fuzzy-filtered command palette. Move this to the library is Wave 2 C5. |
| [`side-panel`](components/side-panel.md) | ui | A sliding side sheet for the work the agent is doing. |
| [`ambient`](components/ambient.md) | ui | A WebGPU mesh gradient for idle and working states. CSS fallback, no telemetry. |

## Primitives

| Primitive | What it is for | Slots |
| --- | --- | --- |
| Button | A button. Variant, size and loading, with the glyphs as icon slots. | `button` `button-label` `button-icon` |
| Transcript | The conversation: a scroller, the rows, and jump-to-latest. One live region for the thread. | `transcript-root` `transcript` `message-row` `message` `status-line` `day-separator` `scroll-to-bottom` `branch-switcher` |
| Composer | The field, the submit action, the toolbar slots and the above-band. | `composer` `composer-body` `composer-input` `composer-submit` `composer-attach` `composer-disabled-reason` `composer-hint` `attachment-row` |
| PartRenderer | Dispatches one part to its renderer. The default renderers follow. | `part` `reasoning` `reasoning-body` `tool-call` `tool-call-body` `artifact-card` `artifact-icon` `artifact-title` `artifact-meta` `artifact-kind` `artifact-version` `artifact-open` `code-block` `inline-code` `terminal-output` |
| MessageActions | The per-message action row. Hidden until the row is hovered or focused. | `message-actions` |
| PlanChecklist | An ordered plan with a derived rollup. Render only. | `plan-checklist` `plan-rollup` `plan-title` `plan-count` |
| ComposerSurface | The composer surface: trigger menus, suggestion chips, attachments. | `trigger-menu` `trigger-menu-empty` `suggestion-chips` `suggestion-chip` `attachment-chip` `attachment-dropzone` `attachment-error` `attachment-icon` `attachment-name` `attachment-preview` `attachment-progress` `attachment-remove` `attachment-retry` `attachment-size` |
| SessionList | A host-agnostic session listbox, grouped by recency. | `session-list` `session-list-header` `session-listbox` `session-list-empty` `session-list-skeleton` `session-list-sentinel` `session-skeleton` `session-item` `session-actions` `session-title` `session-secondary` `session-group` `session-group-label` |
| SessionSearch | One incremental combobox for sessions. | `session-search` `session-search-icon` `session-search-input` `session-search-results` `session-search-status` `session-search-empty` |
| SidebarNav | A vertical nav host with a controlled collapse. | `sidebar-nav` `sidebar-nav-header` `sidebar-nav-list` `sidebar-nav-item` `sidebar-nav-icon` `sidebar-nav-label` `sidebar-nav-badge` `sidebar-nav-toggle` `sidebar-nav-footer` |
| Dialog | A modal on the top layer, with a focus trap and a focus return. | `dialog` `dialog-layer` `dialog-title` `dialog-description` `dialog-close` `scrim` |
| AlertDialog | A modal that asks before it acts. The scrim does not dismiss it. | `alert-dialog` `alert-dialog-layer` `alert-dialog-actions` `alert-dialog-cancel` `alert-dialog-confirm` `alert-dialog-confirmation` |
| Drawer | A sheet that slides in from an edge. Swipe to dismiss. | `drawer` `drawer-layer` |
| ToastRegion | Transient status in a corner region. One live region, polite by default. | `toast-region` |
| Toast | One transient status message, with an optional action. | `toast` `toast-icon` `toast-title` `toast-description` `toast-action` `toast-dismiss` |
| Field | A label, a control, a description, an error and a save acknowledgement. | `field` `field-label` `field-description` `field-error` `field-save-state` |
| Switch | A toggle. The label is a real label, not a placeholder for one. | `switch` `switch-root` `switch-label` `switch-thumb` |
| Select | A listbox trigger with typeahead. | `select` `select-trigger` `select-value` `select-listbox` `select-option-label` `select-option-description` `select-option-check` |
| SegmentedControl | One tab stop, arrow keys move and select. | `segmented` `segmented-item` `segmented-icon` |
| Tooltip | A short label on hover or focus. The delay is the fast motion tier. | `tooltip` `tooltip-trigger` `tooltip-content` |
| Badge | A status chip. Quiet colour, never a button. | `badge` |
| Separator | A line between groups. Decorative by default. | `separator` |
| Kbd | A keyboard hint. Pass keys for a chord, or children for free text. | `kbd` `kbd-key` |
| Progress | A determined bar, or an indeterminate pulse. The fill uses scaleX. | `progress` `progress-fill` |
| Collapsible | A disclosure. Height is not animated; opacity is. | `collapsible` `collapsible-trigger` `collapsible-icon` `collapsible-content` |
| Tabs | One tab stop, arrows move, a travelling pill follows the selected tab. | `tabs` `tabs-list` `tabs-tab` `tabs-indicator` `tabs-panel` |

## Shared slots

| Slot | What it is for |
| --- | --- |
| `icon` | One icon. The role is in `data-aicl-icon`; the glyph comes from the icon provider. |
| `visually-hidden` | Text for a screen reader, painted as nothing. |

## States

### Button

| Attribute | Values |
| --- | --- |
| `data-variant` | `default` `secondary` `destructive` `ghost` `outline` `link` |
| `data-size` | `sm` `md` `lg` |
| `data-loading` | `true` |
| `data-icon` | `true` |

### Transcript

| Attribute | Values |
| --- | --- |
| `data-status` | `idle` `submitted` `streaming` `aborted` `error` |
| `data-empty` | `true` |
| `data-at-bottom` | `true` |
| `data-role` | `user` `assistant` `system` |
| `data-alignment` | `end` `full` |
| `data-state` | `streaming` `complete` `aborted` |

### Composer

| Attribute | Values |
| --- | --- |
| `data-state` | `ready` `submitted` `streaming` `aborted` |
| `data-placement` | `docked` `hero` `rail` |
| `data-has-text` | `true` |
| `data-has-attachments` | `true` |
| `data-role` | `send` `stop` |

### PartRenderer

| Attribute | Values |
| --- | --- |
| `data-part` | `text` `reasoning` `tool-call` `tool-result` `artifact` `file` `error` `data-suggested-followups` `unknown` |
| `data-format` | `markdown` |
| `data-state` | `pending` `open` `closed` `uploading` `uploaded` |
| `data-status` | `pending` `running` `success` `error` `cancelled` |
| `data-open` | `true` |
| `data-is-error` | `true` |
| `data-retryable` | `true` |
| `data-raw-type` | `true` |
| `data-behavior` | `insert` |
| `data-language` | `true` |
| `data-copied` | `true` |
| `data-inline` | `true` |
| `data-streaming` | `true` |
| `data-following` | `true` |
| `data-openable` | `true` |

### MessageActions

| Attribute | Values |
| --- | --- |
| `data-visibility` | `auto` `always` |
| `data-resolved` | `painted` |
| `data-feedback` | `up` `down` `none` |
| `data-role` | `user` `assistant` `system` |
| `data-copied` | `true` |

### PlanChecklist

| Attribute | Values |
| --- | --- |
| `data-count` | `true` |
| `data-progress` | `true` |

### ComposerSurface

| Attribute | Values |
| --- | --- |
| `data-state` | `uploading` `uploaded` `error` |
| `data-empty` | `true` |

### SessionList

| Attribute | Values |
| --- | --- |
| `data-empty` | `true` |
| `data-active` | `true` |
| `data-selected` | `true` |

### SessionSearch

| Attribute | Values |
| --- | --- |
| `data-empty` | `true` |
| `data-count` | `true` |

### SidebarNav

| Attribute | Values |
| --- | --- |
| `data-state` | `collapsed` `expanded` |
| `data-active` | `true` |
| `data-collapsed` | `true` |
| `data-count` | `true` |

### Dialog

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
| `data-size` | `sm` `md` `lg` |

### AlertDialog

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
| `data-busy` | `true` |

### Drawer

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
| `data-side` | `start` `end` |

### ToastRegion

| Attribute | Values |
| --- | --- |
| `data-placement` | `top-start` `top-center` `top-end` `bottom-start` `bottom-end` |

### Toast

| Attribute | Values |
| --- | --- |
| `data-variant` | `info` `success` `error` |

### Field

| Attribute | Values |
| --- | --- |
| `data-invalid` | `true` |
| `data-save-state` | `idle` `saving` `saved` `error` |

### Switch

| Attribute | Values |
| --- | --- |
| `data-state` | `checked` `unchecked` |
| `data-disabled` | `true` |
| `data-busy` | `true` |
| `data-error` | `true` |

### Select

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
| `data-size` | `sm` `md` |
| `data-selected` | `true` |
| `data-disabled` | `true` |

### SegmentedControl

| Attribute | Values |
| --- | --- |
| `data-state` | `selected` `unselected` |
| `data-size` | `sm` `md` |

### Tooltip

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
| `data-side` | `top` `bottom` `start` `end` |

### Badge

| Attribute | Values |
| --- | --- |
| `data-variant` | `default` `secondary` `success` `warning` `danger` `outline` |

### Separator

| Attribute | Values |
| --- | --- |
| `data-orientation` | `horizontal` `vertical` |

### Progress

| Attribute | Values |
| --- | --- |
| `data-state` | `determinate` `indeterminate` |

### Collapsible

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |

### Tabs

| Attribute | Values |
| --- | --- |
| `data-state` | `active` `inactive` |

## Icon roles

A primitive never imports an icon. It asks for the role it plays, and the
role is resolved through `IconProvider`. The default set is Lucide; an app
that wants another set wraps its tree once and every primitive follows.

| Role | Default |
| --- | --- |
| `close` | `X` |
| `chevron-down` | `ChevronDown` |
| `chevron-left` | `ChevronLeft` |
| `chevron-right` | `ChevronRight` |
| `arrow-down` | `ArrowDown` |
| `arrow-up` | `ArrowUp` |
| `panel-left` | `PanelLeft` |
| `plus` | `Plus` |
| `search` | `Search` |
| `send` | `ArrowUp` |
| `stop` | `Square` |
| `copy` | `Copy` |
| `check` | `Check` |
| `retry` | `RotateCcw` |
| `edit` | `Pencil` |
| `thumb-up` | `ThumbsUp` |
| `thumb-down` | `ThumbsDown` |
| `spinner` | `LoaderCircle` |
| `info` | `Info` |
| `success` | `CircleCheck` |
| `alert` | `CircleAlert` |
| `failure` | `CircleX` |
| `pending` | `Circle` |
| `cancelled` | `Ban` |
| `attachment` | `File` |
| `document` | `FileText` |
| `code` | `Code` |
| `diff` | `GitCompare` |
| `preview` | `Eye` |
| `terminal` | `SquareTerminal` |
| `table` | `Table` |
| `chart` | `ChartColumn` |
| `reasoning` | `Lightbulb` |

## Every slot

- `alert-dialog`
- `alert-dialog-actions`
- `alert-dialog-cancel`
- `alert-dialog-confirm`
- `alert-dialog-confirmation`
- `alert-dialog-layer`
- `artifact-card`
- `artifact-icon`
- `artifact-kind`
- `artifact-meta`
- `artifact-open`
- `artifact-title`
- `artifact-version`
- `attachment-chip`
- `attachment-dropzone`
- `attachment-error`
- `attachment-icon`
- `attachment-name`
- `attachment-preview`
- `attachment-progress`
- `attachment-remove`
- `attachment-retry`
- `attachment-row`
- `attachment-size`
- `badge`
- `branch-switcher`
- `button`
- `button-icon`
- `button-label`
- `code-block`
- `collapsible`
- `collapsible-content`
- `collapsible-icon`
- `collapsible-trigger`
- `composer`
- `composer-attach`
- `composer-body`
- `composer-disabled-reason`
- `composer-hint`
- `composer-input`
- `composer-submit`
- `day-separator`
- `dialog`
- `dialog-close`
- `dialog-description`
- `dialog-layer`
- `dialog-title`
- `drawer`
- `drawer-layer`
- `field`
- `field-description`
- `field-error`
- `field-label`
- `field-save-state`
- `icon`
- `inline-code`
- `kbd`
- `kbd-key`
- `message`
- `message-actions`
- `message-row`
- `part`
- `plan-checklist`
- `plan-count`
- `plan-rollup`
- `plan-title`
- `progress`
- `progress-fill`
- `reasoning`
- `reasoning-body`
- `scrim`
- `scroll-to-bottom`
- `segmented`
- `segmented-icon`
- `segmented-item`
- `select`
- `select-listbox`
- `select-option-check`
- `select-option-description`
- `select-option-label`
- `select-trigger`
- `select-value`
- `separator`
- `session-actions`
- `session-group`
- `session-group-label`
- `session-item`
- `session-list`
- `session-list-empty`
- `session-list-header`
- `session-list-sentinel`
- `session-list-skeleton`
- `session-listbox`
- `session-search`
- `session-search-empty`
- `session-search-icon`
- `session-search-input`
- `session-search-results`
- `session-search-status`
- `session-secondary`
- `session-skeleton`
- `session-title`
- `sidebar-nav`
- `sidebar-nav-badge`
- `sidebar-nav-footer`
- `sidebar-nav-header`
- `sidebar-nav-icon`
- `sidebar-nav-item`
- `sidebar-nav-label`
- `sidebar-nav-list`
- `sidebar-nav-toggle`
- `status-line`
- `suggestion-chip`
- `suggestion-chips`
- `switch`
- `switch-label`
- `switch-root`
- `switch-thumb`
- `tabs`
- `tabs-indicator`
- `tabs-list`
- `tabs-panel`
- `tabs-tab`
- `terminal-output`
- `toast`
- `toast-action`
- `toast-description`
- `toast-dismiss`
- `toast-icon`
- `toast-region`
- `toast-title`
- `tool-call`
- `tool-call-body`
- `tooltip`
- `tooltip-content`
- `tooltip-trigger`
- `transcript`
- `transcript-root`
- `trigger-menu`
- `trigger-menu-empty`
- `visually-hidden`
