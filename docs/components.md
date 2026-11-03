# The component contract

Every primitive publishes its slots and its states, and
`packages/react/src/contract.ts` is the single place that says what they
are. A **slot** is a `data-aicl` value: a stable name for a piece of the
DOM that a skin or a consumer's CSS can select on. A **state** is an
attribute and the values it can take.

The names are public API. Changing one is a breaking change.

| Primitive | What it is for | Slots |
| --- | --- | --- |
| Transcript | The conversation: one scroll container over the selected branch path. | `transcript-root` `transcript` `message-row` `message` `status-line` `day-separator` `scroll-to-bottom` `branch-switcher` |
| Composer | The field, the submit action, the toolbar slots and the above-band. | `composer` `composer-input` `composer-submit` `composer-attach` `composer-disabled-reason` `attachment-row` |
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

## Shared slots

| Slot | What it is for |
| --- | --- |
| `icon` | One icon. The role is in `data-aicl-icon`; the glyph comes from the icon provider. |
| `visually-hidden` | Text for a screen reader, painted as nothing. |

## States

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
- `branch-switcher`
- `code-block`
- `composer`
- `composer-attach`
- `composer-disabled-reason`
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
- `message`
- `message-actions`
- `message-row`
- `part`
- `plan-checklist`
- `plan-count`
- `plan-rollup`
- `plan-title`
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
- `transcript`
- `transcript-root`
- `trigger-menu`
- `trigger-menu-empty`
- `visually-hidden`
