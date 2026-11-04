# The catalog

Every item in the pinned LooseLeaf and Fluid Functionalism registries, and
the decision AICL made about it. 296 items.

- **looseleaf** [`4bdb647940e2`](https://github.com/kevintngo/looseleaf/commit/4bdb647940e2fefb3cebb394f3bad25c766a27d2)
- **fluid** [`168d8d498265`](https://github.com/mickadesign/fluid-functionalism/commit/168d8d4982654f72da8f76df169eafb20e825409)

| Incorporated | Candidate | Reference | Out of scope |
| --- | --- | --- | --- |
| 46 | 92 | 74 | 84 |

An item is **incorporated** when a primitive names it. The primitive's own
page says what was taken. A **candidate** is a component a chat app will
want and AICL has not built. A **reference** is a system or a flavour we
study. **Out of scope** is a page, a drawing, or a paper toy this library
does not ship.

The policy lives in `packages/react/src/catalog.ts`. An item with no
decision fails the build.

## Incorporated

These sample components have an AICL primitive.

| Source | Item | Type | AICL | Decision |
| --- | --- | --- | --- | --- |
| looseleaf | `accordion` | ui | [Accordion](../components/accordion.md) | Incorporated as Accordion. The record on that primitive says what was taken. |
| looseleaf | `alert-dialog` | ui | [AlertDialog](../components/alert-dialog.md) | Incorporated as AlertDialog. The record on that primitive says what was taken. |
| looseleaf | `alert` | ui | [Alert](../components/alert.md) | Incorporated as Alert. The record on that primitive says what was taken. |
| looseleaf | `attachment` | ui | [PartRenderer](../components/part-renderer.md), [ComposerSurface](../components/composer-surface.md) | Incorporated as PartRenderer, ComposerSurface. The record on that primitive says what was taken. |
| looseleaf | `badge` | ui | [Badge](../components/badge.md) | Incorporated as Badge. The record on that primitive says what was taken. |
| looseleaf | `button` | ui | [Button](../components/button.md) | Incorporated as Button. The record on that primitive says what was taken. |
| looseleaf | `card` | ui | [Card](../components/card.md) | Incorporated as Card. The record on that primitive says what was taken. |
| looseleaf | `code-block` | ui | [PartRenderer](../components/part-renderer.md) | Incorporated as PartRenderer. The record on that primitive says what was taken. |
| looseleaf | `collapsible` | ui | [Collapsible](../components/collapsible.md) | Incorporated as Collapsible. The record on that primitive says what was taken. |
| looseleaf | `dialog` | ui | [Dialog](../components/dialog.md) | Incorporated as Dialog. The record on that primitive says what was taken. |
| looseleaf | `drawer` | ui | [Drawer](../components/drawer.md) | Incorporated as Drawer. The record on that primitive says what was taken. |
| looseleaf | `empty` | ui | [Empty](../components/empty.md) | Incorporated as Empty. The record on that primitive says what was taken. |
| looseleaf | `field` | ui | [Field](../components/field.md) | Incorporated as Field. The record on that primitive says what was taken. |
| looseleaf | `kbd` | ui | [Kbd](../components/kbd.md) | Incorporated as Kbd. The record on that primitive says what was taken. |
| looseleaf | `label` | ui | [Field](../components/field.md) | Incorporated as Field. The record on that primitive says what was taken. |
| looseleaf | `message-scroller` | ui | [Transcript](../components/transcript.md) | Incorporated as Transcript. The record on that primitive says what was taken. |
| looseleaf | `message` | ui | [Transcript](../components/transcript.md), [MessageActions](../components/message-actions.md) | Incorporated as Transcript, MessageActions. The record on that primitive says what was taken. |
| looseleaf | `progress` | ui | [Progress](../components/progress.md) | Incorporated as Progress. The record on that primitive says what was taken. |
| looseleaf | `prompt-input` | ui | [Composer](../components/composer.md), [ComposerSurface](../components/composer-surface.md) | Incorporated as Composer, ComposerSurface. The record on that primitive says what was taken. |
| looseleaf | `select` | ui | [Select](../components/select.md) | Incorporated as Select. The record on that primitive says what was taken. |
| looseleaf | `separator` | ui | [Separator](../components/separator.md) | Incorporated as Separator. The record on that primitive says what was taken. |
| looseleaf | `sheet` | ui | [Drawer](../components/drawer.md) | Incorporated as Drawer. The record on that primitive says what was taken. |
| looseleaf | `sidebar` | ui | [SessionList](../components/session-list.md), [SidebarNav](../components/sidebar-nav.md) | Incorporated as SessionList, SidebarNav. The record on that primitive says what was taken. |
| looseleaf | `skeleton` | ui | [Skeleton](../components/skeleton.md) | Incorporated as Skeleton. The record on that primitive says what was taken. |
| looseleaf | `sonner` | ui | [ToastRegion](../components/toast-region.md), [Toast](../components/toast.md) | Incorporated as ToastRegion, Toast. The record on that primitive says what was taken. |
| looseleaf | `spinner` | ui | [Spinner](../components/spinner.md) | Incorporated as Spinner. The record on that primitive says what was taken. |
| looseleaf | `switch` | ui | [Switch](../components/switch.md) | Incorporated as Switch. The record on that primitive says what was taken. |
| looseleaf | `tabs` | ui | [SegmentedControl](../components/segmented-control.md), [Tabs](../components/tabs.md) | Incorporated as SegmentedControl, Tabs. The record on that primitive says what was taken. |
| looseleaf | `toggle-group` | ui | [SegmentedControl](../components/segmented-control.md) | Incorporated as SegmentedControl. The record on that primitive says what was taken. |
| looseleaf | `tooltip` | ui | [Tooltip](../components/tooltip.md) | Incorporated as Tooltip. The record on that primitive says what was taken. |
| looseleaf | `typing-indicator` | ui | [PartRenderer](../components/part-renderer.md) | Incorporated as PartRenderer. The record on that primitive says what was taken. |
| fluid | `accordion` | ui | [Collapsible](../components/collapsible.md), [Accordion](../components/accordion.md) | Incorporated as Collapsible, Accordion. The record on that primitive says what was taken. |
| fluid | `badge` | ui | [Badge](../components/badge.md) | Incorporated as Badge. The record on that primitive says what was taken. |
| fluid | `banner` | ui | [Toast](../components/toast.md), [Alert](../components/alert.md) | Incorporated as Toast, Alert. The record on that primitive says what was taken. |
| fluid | `button` | ui | [Button](../components/button.md) | Incorporated as Button. The record on that primitive says what was taken. |
| fluid | `dialog` | ui | [Dialog](../components/dialog.md), [AlertDialog](../components/alert-dialog.md) | Incorporated as Dialog, AlertDialog. The record on that primitive says what was taken. |
| fluid | `mobile-drawer` | ui | [Drawer](../components/drawer.md) | Incorporated as Drawer. The record on that primitive says what was taken. |
| fluid | `input-message` | ui | [Composer](../components/composer.md), [ComposerSurface](../components/composer-surface.md) | Incorporated as Composer, ComposerSurface. The record on that primitive says what was taken. |
| fluid | `file-thumbnail` | ui | [PartRenderer](../components/part-renderer.md) | Incorporated as PartRenderer. The record on that primitive says what was taken. |
| fluid | `chat-message` | ui | [Transcript](../components/transcript.md), [MessageActions](../components/message-actions.md) | Incorporated as Transcript, MessageActions. The record on that primitive says what was taken. |
| fluid | `tabs` | ui | [SegmentedControl](../components/segmented-control.md), [Tabs](../components/tabs.md) | Incorporated as SegmentedControl, Tabs. The record on that primitive says what was taken. |
| fluid | `switch` | ui | [Switch](../components/switch.md) | Incorporated as Switch. The record on that primitive says what was taken. |
| fluid | `card` | ui | [Card](../components/card.md) | Incorporated as Card. The record on that primitive says what was taken. |
| fluid | `sidebar` | ui | [SessionList](../components/session-list.md), [SidebarNav](../components/sidebar-nav.md) | Incorporated as SessionList, SidebarNav. The record on that primitive says what was taken. |
| fluid | `select` | ui | [Select](../components/select.md) | Incorporated as Select. The record on that primitive says what was taken. |
| fluid | `tooltip` | ui | [Tooltip](../components/tooltip.md) | Incorporated as Tooltip. The record on that primitive says what was taken. |

## Candidates

Not built yet. The wave is the coordinate in [the roadmap](../ROADMAP.md).

| Source | Item | Type | Wave | Decision |
| --- | --- | --- | --- | --- |
| looseleaf | `aspect-ratio` | ui | 2 · C4 | A layout primitive. The shells in wave 4 are built out of these. |
| looseleaf | `avatar` | ui | 2 · C4 | A content primitive for lists, tables and media the transcript renders. |
| looseleaf | `breadcrumb` | ui | 2 · C4 | A navigation primitive. The sidebar and the session list are the ones that exist today. |
| looseleaf | `bubble` | ui | 3 | A chat component AICL has not given a primitive yet. |
| looseleaf | `button-group` | ui | 2 · C4 | An action primitive. It composes Button, which is the one that exists today. |
| looseleaf | `calendar` | ui | 2 · C3 | A form control. The settings surface and the composer are where it lands. |
| looseleaf | `carousel` | ui | 2 · C4 | A content primitive for lists, tables and media the transcript renders. |
| looseleaf | `checkbox` | ui | 2 · C3 | A form control. The settings surface and the composer are where it lands. |
| looseleaf | `combobox` | ui | 2 · C3 | A form control. The settings surface and the composer are where it lands. |
| looseleaf | `command` | ui | 2 · C5 | The command palette. @aicl/fx has a Tailwind-coupled one; the library primitive is the roadmap's C5. |
| looseleaf | `context-menu` | ui | 2 · C2 | An overlay. One shared popup chrome comes first, then the menus that sit on it. |
| looseleaf | `date-picker` | ui | 2 · C3 | A form control. The settings surface and the composer are where it lands. |
| looseleaf | `dropdown-menu` | ui | 2 · C2 | An overlay. One shared popup chrome comes first, then the menus that sit on it. |
| looseleaf | `dropzone` | ui | 2 · C3 | A form control. The settings surface and the composer are where it lands. |
| looseleaf | `form` | ui | 2 · C3 | A form control. The settings surface and the composer are where it lands. |
| looseleaf | `handwritten` | ui | 2 · C4 | A type treatment. AICL's type roles cover the scale; this is the component on top. |
| looseleaf | `hover-card` | ui | 2 · C2 | An overlay. One shared popup chrome comes first, then the menus that sit on it. |
| looseleaf | `input-group` | ui | 2 · C3 | A form control. The settings surface and the composer are where it lands. |
| looseleaf | `input-otp` | ui | 2 · C3 | A form control. The settings surface and the composer are where it lands. |
| looseleaf | `input` | ui | 2 · C3 | A form control. The settings surface and the composer are where it lands. |
| looseleaf | `item` | ui | 2 · C4 | A content primitive for lists, tables and media the transcript renders. |
| looseleaf | `lettering` | ui | 2 · C4 | A type treatment. AICL's type roles cover the scale; this is the component on top. |
| looseleaf | `marker` | ui | 3 | A chat component AICL has not given a primitive yet. |
| looseleaf | `menubar` | ui | 2 · C4 | A navigation primitive. The sidebar and the session list are the ones that exist today. |
| looseleaf | `native-select` | ui | 2 · C3 | A form control. The settings surface and the composer are where it lands. |
| looseleaf | `navigation-menu` | ui | 2 · C4 | A navigation primitive. The sidebar and the session list are the ones that exist today. |
| looseleaf | `pagination` | ui | 2 · C4 | A navigation primitive. The sidebar and the session list are the ones that exist today. |
| looseleaf | `popover` | ui | 2 · C2 | An overlay. One shared popup chrome comes first, then the menus that sit on it. |
| looseleaf | `radio-group` | ui | 2 · C3 | A form control. The settings surface and the composer are where it lands. |
| looseleaf | `rating` | ui | 2 · C3 | A form control. The settings surface and the composer are where it lands. |
| looseleaf | `resizable` | ui | 2 · C4 | A layout primitive. The shells in wave 4 are built out of these. |
| looseleaf | `reveal` | ui | 3 | An interactive surface. Study the shape before giving it a primitive. |
| looseleaf | `scroll-area` | ui | 2 · C4 | A layout primitive. The shells in wave 4 are built out of these. |
| looseleaf | `slider` | ui | 2 · C3 | A form control. The settings surface and the composer are where it lands. |
| looseleaf | `stepper` | ui | 2 · C3 | A form control. The settings surface and the composer are where it lands. |
| looseleaf | `table` | ui | 2 · C4 | A content primitive for lists, tables and media the transcript renders. |
| looseleaf | `textarea` | ui | 2 · C3 | A form control. The settings surface and the composer are where it lands. |
| looseleaf | `toggle` | ui | 2 · C4 | An action primitive. It composes Button, which is the one that exists today. |
| looseleaf | `typewriter` | ui | 2 · C4 | A type treatment. AICL's type roles cover the scale; this is the component on top. |
| looseleaf | `typography` | ui | 2 · C4 | A type treatment. AICL's type roles cover the scale; this is the component on top. |
| looseleaf | `calendar-planner` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `chat-app` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `empty-inbox` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `empty-search` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `error-404` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `error-500` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `file-explorer` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `inbox` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `kanban-board` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `notes-app` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `profile-page` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `settings-appearance` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `settings-billing` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `settings-notifications` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `settings-profile` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `sidebar-01` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `sidebar-02` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `sidebar-03` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `sidebar-04` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `sidebar-05` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `sidebar-06` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `sidebar-07` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `sidebar-08` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `sidebar-09` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `sidebar-10` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `sidebar-11` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `sidebar-12` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `sidebar-13` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `sidebar-14` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `sidebar-15` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `sidebar-16` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| looseleaf | `sidebar-shared` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| fluid | `ask-user-questions` | ui | 3 · E3 | A structured question flow. @aicl/fx has a question card; the library primitive is the roadmap's question flow. |
| fluid | `dropdown` | ui | 2 · C2 | A menu. The roadmap builds one popup chrome and composes the menu, the select and the combobox from it. |
| fluid | `checkbox-group` | ui | 2 · C3 | A checkbox group with a merging selection. The form set, after Button. |
| fluid | `radio-group` | ui | 2 · C3 | A radio group. The segmented control covers a single-choice row; this is the labelled group. |
| fluid | `input-copy` | ui | 2 · C3 | A read-only field with copy. The code block already copies; this is the field form of it. |
| fluid | `input-group` | ui | 2 · C3 | An input with a leading icon and a trailing button. The form set. |
| fluid | `queued-stack` | block | 3 · E4 | Messages queued while a turn streams. The suggestion stack in @aicl/fx is the same idea without the queue. |
| fluid | `table` | ui | 2 · C4 | A table with a hover row. The corpus has tables inside transcripts; the primitive is still open. |
| fluid | `sidebar-workspace-header` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| fluid | `sidebar-user-footer` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| fluid | `sidebar-search-field` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| fluid | `sidebar-inset-topbar` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| fluid | `sidebar-app` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| fluid | `dialog-sidebar` | block | 4 | An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace. |
| fluid | `slider` | ui | 2 · C3 | A slider. The form set, for settings that are a range rather than a switch. |
| fluid | `thinking-indicator` | ui | 3 · E2 | A morphing status with cycling text. The spinner covers the plain working state; this is the thinking family. |
| fluid | `scroll-area` | ui | 2 · C4 | A scroll container with its own bar. The transcript scroller is the one AICL owns today. |
| fluid | `combobox` | ui | 2 · C3 | A type-ahead over a list. createComboboxModel exists in core; the primitive does not. |
| fluid | `command-menu` | ui | 2 · C5 | The command palette: input, list, empty, and shortcut helpers. Session search is the narrower combobox that exists today. |
| fluid | `thinking-steps` | ui | 3 · E2 | A collapsible chain of thought. The reasoning disclosure is the chat row; the sequential family is still open. |

## Reference

Studied, not shipped as that item.

| Source | Item | Type | AICL | Decision |
| --- | --- | --- | --- | --- |
| looseleaf | `looseleaf` | style |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `looseleaf-blocks` | block |  | An umbrella that installs every block. AICL does not publish a registry yet. |
| looseleaf | `looseleaf-theme` | theme |  | Shipped as packages/styles/src/themes/looseleaf.css. Tokens only, not the ink. |
| looseleaf | `font-kevin-sans` | theme |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `font-ibm-plex-mono` | font |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `utils` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `chat-align` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `code-highlight` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `field-class` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `ink` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `ink-art` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `ink-doodles` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `ink-grain-textures` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `ink-icons` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `ink-mascots` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `ink-paper` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `ink-paper-textures` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `ink-props` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `ink-recipes` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `ink-scenes` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `ink-stickers` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `menu-styles` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `message-scroller-primitive` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `sketch-export` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `use-form-reset` | hook |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `use-live-motion` | hook |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `use-mark-ink` | hook |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `use-mobile` | hook |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `use-paper-object` | hook |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| looseleaf | `sketchpad` | ui |  | The shape the surface contract is aiming at: compound, controlled, an imperative handle, a model. The drawing surface itself is not incorporated. |
| fluid | `surfaces` | theme |  | Shipped as the elevation ladder on the token contract. |
| fluid | `tokens` | theme |  | Shipped as the --aicl-* token contract. |
| fluid | `type-scale` | item |  | Shipped as the six type roles on the token contract. |
| fluid | `typography` | item |  | Shipped as the type roles. Prose styles stay with the markdown renderer. |
| fluid | `utils` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `springs` | lib |  | Shipped as the three spring tiers in @aicl/motion. The sample stays the reference, not a dependency. |
| fluid | `font-weight` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `surface-context` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `surface-classes` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `elevated` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `popup` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `omit` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `shape-context` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `size-context` | lib |  | Shipped as the CSS size ladder. AICL does not re-provide size through React context. |
| fluid | `icon-context` | lib |  | Shipped as the icon slots in @aicl/react. |
| fluid | `icons-tabler` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `icons-phosphor` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `icons-hugeicons` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `icons-untitledui` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `fluid-provider` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `use-fluid-hover` | hook |  | Shipped as useFluidHover in @aicl/motion. |
| fluid | `use-fluid-hover-standard` | hook |  | The non-gliding sibling of fluid hover. AICL ships the gliding one. |
| fluid | `use-touch-primary` | hook |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `use-keyboard-nav-gate` | hook |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `use-merge-split` | hook |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `accordion-base` | ui |  | Base UI flavour of `accordion`. AICL ships one binding, not a second primitive library. |
| fluid | `button-base` | ui |  | Base UI flavour of `button`. AICL ships one binding, not a second primitive library. |
| fluid | `dropdown-base` | ui |  | Base UI flavour of `dropdown`. AICL ships one binding, not a second primitive library. |
| fluid | `checkbox-group-base` | ui |  | Base UI flavour of `checkbox-group`. AICL ships one binding, not a second primitive library. |
| fluid | `radio-group-base` | ui |  | Base UI flavour of `radio-group`. AICL ships one binding, not a second primitive library. |
| fluid | `dialog-base` | ui |  | Base UI flavour of `dialog`. AICL ships one binding, not a second primitive library. |
| fluid | `mobile-drawer-base` | ui |  | Base UI flavour of `mobile-drawer`. AICL ships one binding, not a second primitive library. |
| fluid | `tabs-base` | ui |  | Base UI flavour of `tabs`. AICL ships one binding, not a second primitive library. |
| fluid | `switch-base` | ui |  | Base UI flavour of `switch`. AICL ships one binding, not a second primitive library. |
| fluid | `sidebar-base` | ui |  | Base UI flavour of `sidebar`. AICL ships one binding, not a second primitive library. |
| fluid | `sidebar-menu-grid` | lib |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `slider-base` | ui |  | Base UI flavour of `slider`. AICL ships one binding, not a second primitive library. |
| fluid | `reveal` | item |  | A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so. |
| fluid | `scroll-area-base` | ui |  | Base UI flavour of `scroll-area`. AICL ships one binding, not a second primitive library. |
| fluid | `select-base` | ui |  | Base UI flavour of `select`. AICL ships one binding, not a second primitive library. |
| fluid | `combobox-base` | ui |  | Base UI flavour of `combobox`. AICL ships one binding, not a second primitive library. |
| fluid | `date-picker-base` | ui |  | Base UI flavour of `date-picker`. AICL ships one binding, not a second primitive library. |
| fluid | `tooltip-base` | ui |  | Base UI flavour of `tooltip`. AICL ships one binding, not a second primitive library. |
| fluid | `thinking-steps-base` | ui |  | Base UI flavour of `thinking-steps`. AICL ships one binding, not a second primitive library. |

## Out of scope

Named so they are not rediscovered as gaps.

| Source | Item | Type | AICL | Decision |
| --- | --- | --- | --- | --- |
| looseleaf | `annotate` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `arrow` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `asterisk` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `boil` | ui |  | A paper toy. The motion is charming and the component is not a chat primitive. |
| looseleaf | `bookmark` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `bracket` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `callout` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `chart` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `circled` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `clipboard` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `confetti` | ui |  | A paper toy. The motion is charming and the component is not a chat primitive. |
| looseleaf | `corkboard` | ui |  | A paper toy. The motion is charming and the component is not a chat primitive. |
| looseleaf | `desk` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `direction` | ui |  | A direction provider for LooseLeaf's drawn pages. AICL does not ship a second writing-direction system. |
| looseleaf | `doodle` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `envelope` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `flip-card` | ui |  | A paper toy. The motion is charming and the component is not a chat primitive. |
| looseleaf | `folder` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `highlight` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `icon` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `index-card` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `label-tag` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `marquee` | ui |  | A paper toy. The motion is charming and the component is not a chat primitive. |
| looseleaf | `mascot` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `napkin` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `notebook` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `page` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `paper` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `peel-corner` | ui |  | A paper toy. The motion is charming and the component is not a chat primitive. |
| looseleaf | `polaroid` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `quote` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `receipt` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `ribbon` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `scribble` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `seal` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `signature-pad` | ui |  | A drawing surface for a signature. The shape is the sketchpad's, and the component is not a chat field. |
| looseleaf | `signature` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `squiggle` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `stamp-button` | ui |  | A rubber-stamp button. The button primitive covers the control; the stamp is ink. |
| looseleaf | `stamp` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `sticker-board` | ui |  | A paper toy. The motion is charming and the component is not a chat primitive. |
| looseleaf | `sticker-picker` | ui |  | A picker for LooseLeaf's sticker sheet. The stickers are the ink layer. |
| looseleaf | `sticker-sheet` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `sticker` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `sticky-note` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `strike` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `tally` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `tape` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `tear-off` | ui |  | A paper toy. The motion is charming and the component is not a chat primitive. |
| looseleaf | `ticket` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `underline` | ui |  | Drawn art. The ink layer is a later package, and this component is the drawing. |
| looseleaf | `announcement-bar` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `checkout-01` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `cta-01` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `dashboard-01` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `dashboard-analytics` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `dashboard-finance` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `faq-01` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `features-01` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `footer-01` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `forgot-password-01` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `landing-hero-01` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `landing-hero-02` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `login-01` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `login-02` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `login-03` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `login-04` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `login-05` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `logos-01` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `newsletter-01` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `onboarding-01` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `otp-01` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `pricing-01` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `reset-password-01` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `signup-01` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `signup-02` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `signup-03` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `signup-04` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `signup-05` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| looseleaf | `testimonials-01` | block |  | A marketing, auth, commerce or dashboard block. AICL does not ship those pages. |
| fluid | `carousel-dots` | ui |  | Carousel chrome. AICL does not ship a carousel. |
| fluid | `calendar` | ui |  | A month grid. A chat library does not ship a date picker. |
| fluid | `date-picker` | ui |  | A date field on the calendar. A chat library does not ship a date picker. |
| fluid | `color-picker` | ui |  | A color field. Not a chat primitive. |
