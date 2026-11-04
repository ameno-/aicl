# The component contract

Every primitive publishes its slots and its states, and
`packages/react/src/contract.ts` is the single place that says what they
are. A **slot** is a `data-aicl` value: a stable name for a piece of the
DOM that a skin or a consumer's CSS can select on. A **state** is an
attribute and the values it can take.

Each primitive also has an incorporation record
(`packages/react/src/incorporation.ts`): the shapes it uses, the motion it
takes, and the sample components it was built against. The page linked from
the table is that record, rendered.

The names are public API. Changing one is a breaking change.

| Primitive | What it is for | Motion | Page |
| --- | --- | --- | --- |
| Button | A button. Variant, size and loading, with the glyphs as icon slots. | fast: hover, press | [button](components/button.md) |
| Transcript | The conversation: a scroller, the rows, and jump-to-latest. One live region for the thread. | moderate: entrance | [transcript](components/transcript.md) |
| Composer | The field, the submit action, the toolbar slots and the above-band. | fast: hover | [composer](components/composer.md) |
| PartRenderer | Dispatches one part to its renderer. The default renderers follow. | fast: fade | [part-renderer](components/part-renderer.md) |
| MessageActions | The per-message action row. Hidden until the row is hovered or focused. | fast: hover | [message-actions](components/message-actions.md) |
| PlanChecklist | An ordered plan with a derived rollup. Render only. | still | [plan-checklist](components/plan-checklist.md) |
| ComposerSurface | The composer surface: trigger menus, suggestion chips, attachments. | fast: indeterminate | [composer-surface](components/composer-surface.md) |
| SessionList | A host-agnostic session listbox, grouped by recency. | fast: shimmer | [session-list](components/session-list.md) |
| SessionSearch | One incremental combobox for sessions. | fast: fade | [session-search](components/session-search.md) |
| SidebarNav | A vertical nav host with a controlled collapse. | moderate: fade | [sidebar-nav](components/sidebar-nav.md) |
| Dialog | A modal on the top layer, with a focus trap and a focus return. | slow: entrance, exit | [dialog](components/dialog.md) |
| AlertDialog | A modal that asks before it acts. The scrim does not dismiss it. | slow: entrance | [alert-dialog](components/alert-dialog.md) |
| Drawer | A sheet that slides in from an edge. Swipe to dismiss. | moderate: entrance | [drawer](components/drawer.md) |
| ToastRegion | Transient status in a corner region. One live region, polite by default. | moderate: entrance | [toast-region](components/toast-region.md) |
| Toast | One transient status message, with an optional action. | moderate: entrance, exit | [toast](components/toast.md) |
| Field | A label, a control, a description, an error and a save acknowledgement. | fast: fade | [field](components/field.md) |
| Switch | A toggle. The label is a real label, not a placeholder for one. | fast: thumb | [switch](components/switch.md) |
| Select | A listbox trigger with typeahead. | moderate: entrance | [select](components/select.md) |
| SegmentedControl | One tab stop, arrow keys move and select. | moderate: travelling-indicator | [segmented-control](components/segmented-control.md) |
| Badge | A small label that sits next to a word. | fast: hover | [badge](components/badge.md) |
| Separator | A rule between two regions. Decorative by default, announced when it is not. | still | [separator](components/separator.md) |
| Kbd | A keyboard key, drawn as a keycap. | fast: press | [kbd](components/kbd.md) |
| Progress | A progress bar. Determinate when it has a value, travelling when it does not. | moderate: fill, indeterminate | [progress](components/progress.md) |
| Skeleton | A shimmering placeholder while content is on its way. | moderate: shimmer | [skeleton](components/skeleton.md) |
| Spinner | A spinning status glyph. The glyph is the spinner icon slot. | fast: spin | [spinner](components/spinner.md) |
| Alert | A status message that arrives and stays. Title and description are subparts. | slow: entrance | [alert](components/alert.md) |
| Card | A sheet with a header, a body and a footer. | still | [card](components/card.md) |
| Empty | What a region says when it has nothing in it yet. | moderate: fade | [empty](components/empty.md) |
| Tooltip | A tip that shows on hover and on keyboard focus. | fast: fade | [tooltip](components/tooltip.md) |
| Tabs | A tablist and its panels. The selection is a pill that travels. | moderate: travelling-indicator | [tabs](components/tabs.md) |
| Collapsible | One panel that folds. The height animates, and the chevron turns. | moderate: height, chevron | [collapsible](components/collapsible.md) |
| Accordion | A list of disclosures. One open at a time, or several. | moderate: height, chevron | [accordion](components/accordion.md) |

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

### Badge

| Attribute | Values |
| --- | --- |
| `data-variant` | `default` `secondary` `outline` `destructive` `success` |

### Separator

| Attribute | Values |
| --- | --- |
| `data-orientation` | `horizontal` `vertical` |

### Progress

| Attribute | Values |
| --- | --- |
| `data-state` | `determinate` `indeterminate` |

### Alert

| Attribute | Values |
| --- | --- |
| `data-variant` | `info` `success` `warning` `destructive` |

### Tooltip

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |

### Tabs

| Attribute | Values |
| --- | --- |
| `data-state` | `active` `inactive` |

### Collapsible

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |

### Accordion

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
| `data-type` | `single` `multiple` |

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

- `accordion`
- `accordion-body`
- `accordion-item`
- `accordion-label`
- `accordion-panel`
- `accordion-trigger`
- `alert`
- `alert-body`
- `alert-description`
- `alert-dialog`
- `alert-dialog-actions`
- `alert-dialog-cancel`
- `alert-dialog-confirm`
- `alert-dialog-confirmation`
- `alert-dialog-layer`
- `alert-icon`
- `alert-title`
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
- `card`
- `card-body`
- `card-description`
- `card-footer`
- `card-header`
- `card-title`
- `code-block`
- `collapsible`
- `collapsible-body`
- `collapsible-label`
- `collapsible-panel`
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
- `empty`
- `empty-actions`
- `empty-description`
- `empty-title`
- `field`
- `field-description`
- `field-error`
- `field-label`
- `field-save-state`
- `icon`
- `inline-code`
- `kbd`
- `message`
- `message-actions`
- `message-row`
- `part`
- `plan-checklist`
- `plan-count`
- `plan-rollup`
- `plan-title`
- `progress`
- `progress-bar`
- `reasoning`
- `reasoning-body`
- `scrim`
- `scroll-to-bottom`
- `segmented`
- `segmented-icon`
- `segmented-indicator`
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
- `skeleton`
- `spinner`
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
- `tooltip-anchor`
- `transcript`
- `transcript-root`
- `trigger-menu`
- `trigger-menu-empty`
- `visually-hidden`
