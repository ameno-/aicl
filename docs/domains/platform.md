# Domain: Platform & Configuration Surfaces

Settings, integrations, secrets, knowledge/memory, automations, templates, notifications,
and the overlay system (modals, drawers, toasts, upsell banners). Derived from the labeled
corpus of 1,262 screenshots across Cofounder, Devin, Lovable, and Manus. See
`docs/ARCHITECTURE.md` for the library's north star (pluggable UI for AI chat, three-layer
split, headless primitives with `data-*` state).

## 1. Inventory

### 1.1 Archetypes matched (labels filtered by `screen_archetype`)

Counts are exact label matches over the corpus. Two caveats: the corpus labeler was
generous with `settings_appearance` (it absorbed many project-settings and config pages
that are not "appearance"), and archetypes are per-screenshot primary classification, so
overlays that appear *on top of* a chat screen are counted under the chat archetype, not
here.

| Archetype | Count | Products present |
|---|---|---|
| `settings_appearance` | 146 | all 4 |
| `settings_account` | 37 | all 4 |
| `automation_editor` | 32 | Devin only |
| `settings_billing` | 32 | all 4 |
| `modal_dialog` | 23 | Cofounder, Manus |
| `settings_model` | 21 | Devin, Manus |
| `knowledge_base` | 10 | Cofounder, Devin, Manus |
| `template_gallery` | 10 | Lovable, Manus |
| `integration_detail` | 9 | Devin, Lovable, Manus |
| `notifications_center` | 3 | Manus only |
| `settings_team` | 1 | Devin only |
| `settings_advanced` | 1 | Cofounder only |
| `sidepanel_drawer`, `toast_notification` | 0 as primary archetype | — |

Settings categories per product (archetype-level view):

- **Devin**: account, appearance, billing, model, team — plus automation_editor (32 shots) and a settings search box.
- **Lovable**: account, appearance, billing — plus connectors section inside the settings modal (incl. GitHub) and template galleries.
- **Cofounder**: account, appearance, billing, advanced — its settings sub-nav includes "Env Files & Secrets", "Repositories", "Stripe", "Support", "Inbox".
- **Manus**: account, appearance, billing, model — plus Connectors, Integrations, Scheduled tasks, Data controls, Skills, Personalization, Cloud browser; secrets live inside project settings ("Add Secret" modal).

### 1.2 Overlay components (corpus-wide, per-screenshot component tags)

| Component tag | Screenshots containing it |
|---|---|
| `modal` | 488 |
| `dropdown` | 191 |
| `toast` | 6 |
| `drawer` | 7 |
| `banner_upsell` | 1 |

`modal` at 488/1,262 (~39%) is the single most common component tag in the corpus —
modals carry settings pages, confirmations, connector pickers, secrets, plan upgrades,
and permission grants. Toasts and drawers are real but rare in the captures; upsell is
expressed through billing pages and plan cards rather than inline banners.

### 1.3 Observed patterns from spot-checks (10 screenshots across 4 products)

**Settings information architecture** — two dominant patterns:

1. **Dedicated route with in-page sub-nav** (Devin, Cofounder): left sub-nav inside the
   app shell, grouped ("Personal" / "Organization" in Devin), with breadcrumb
   "Settings / Preferences" and (Devin) a "Search settings…" filter box. Content column
   is sectioned cards.
2. **Settings-as-modal** (Manus, Lovable): a large dialog (~80–90% viewport) over a
   dimmed workspace, with its own internal left nav and a close `X`. Manus packs 12+
   entries into the modal nav; Lovable splits nav into "Workspace" / "Account" /
   "Connectors" groups.

**Form patterns**: rows are `label + one-line description` on the left, control right-aligned.
Controls observed: toggle switches for boolean prefs (Devin notifications, Lovable "Chat
suggestions"), segmented controls for theme (Cofounder Light/System/Dark), dropdowns
(timezone, language, theme in Devin), inline-edit name fields, read-only values with
copy affordance (Devin User ID), action buttons for permission-gated features (browser
notifications "Enable"). **No explicit Save button appears on preference pages** — toggles,
segmented controls, and dropdowns apply immediately (auto-save); text inputs commit
implicitly. Destructive actions are isolated at the bottom ("Danger Zone", Cofounder).

**Modals**: centered, rounded, `X` top-right, footer with `Cancel` + primary action.
Destructive confirmation = small dialog, danger-colored primary button (Manus "Delete
Project", red Delete). Task modals = medium (Manus "Add Secret": name + value fields,
Done as primary). Picker modals = checkbox list + Cancel/Add (Manus connector picker).
Detail modals = icon, name, description, metadata table, primary actions (Manus Gmail
connector: "Try it out" / "Manage", Connector Type/Author/UUID/Website/Privacy rows).

**Connector auth**: OAuth flows are a button that leaves the app ("Connect"/"Try it out"),
plus permission-grant screens (Devin's Slack permissions request, Cofounder's toggle-based
permission dialog). API-key entry is a name/value secret form (Manus, Cofounder "Env Files
& Secrets").

**Billing/upsell**: plan cards in a row (Lovable Pro/Business/Enterprise), price + annual
toggle, feature checklists, per-plan CTA ("Upgrade current plan" / "Book a demo"),
credits progress bar with rollover notes. Cofounder splits balance/subscription/receipts
sections. Devin: plan comparison page.

**Automation editor** (Devin only, but 32 shots — a real product surface): page-level
multi-section form — Triggers (chips with inline condition rows, "Add trigger" secondary
button), Instructions (structured prompt blocks), MCPs (searchable checkbox list with
"Setup" per item), collapsible "Advanced". This is a full CRUD editor, not a chat feature.

## 2. Scope recommendation

The north star is "pluggable UI for AI chat" (ARCHITECTURE.md). Apply the same test used
for every other domain: does the chat surface need it, or does the app need it?

**In scope for the library** — overlay and form primitives, because the chat surface
itself needs them even in a minimal product:

- `Dialog` / `AlertDialog` — delete-session confirmation, share dialogs, model-change
  warnings, payment walls. 39% of corpus screens contain a modal; chat products cannot
  ship without one.
- `Drawer` — mobile transcript nav, session sidebar, artifact panels in narrow viewports.
- `Toast` / `ToastRegion` — "copied", "session renamed", "message failed — retry",
  stream errors. Rare as a *primary screen* (6 tags) but functionally necessary.
- Minimal form controls: `Field` (label/description/control layout), `Switch`, `Select`,
  `SegmentedControl`. The model picker, reasoning-effort selector, and theme toggle that
  live in and around the composer are exactly these controls; shipping them headless
  keeps composer-adjacent UI consistent.

**Out of scope — reference implementation (recipes), not library API:**

- `SettingsPage`, settings sub-nav, settings search. Two incompatible IA patterns
  (route vs. modal) already prove there is no canonical component; it is a composition
  of `Dialog` + nav + `Field`s. Ship as a recipe in docs, optionally as an unstyled
  example app screen.
- `IntegrationsList`, `ConnectorCard`, OAuth consent, `SecretsManager`. These are
  backend-shaped: connector catalogs, auth flows, and secret storage are app/platform
  concerns. The library has no business modeling an OAuth state machine.
- `AutomationEditor`, `TemplateGallery`, `NotificationsCenter`, `BillingPage` /
  `PlanCards`. Product surfaces with heavy domain semantics; nothing chat-specific.
- Upsell banners: 1 labeled occurrence in 1,262 screens — not a pattern worth an API.

This keeps `@aicl/core` free of routing, billing, and auth concepts, consistent with the
deliberate non-goals in ARCHITECTURE.md.

## 3. Interaction contract (in-scope primitives)

### 3.1 Overlays (Dialog, AlertDialog, Drawer)

- **Focus**: on open, focus moves to `initialFocus` target if given, else first focusable
  element, else the dialog container (`tabindex="-1"`). Focus is **trapped** while open.
  On close, focus returns to the element that opened the overlay (the trigger), unless
  `returnFocus: false`.
- **Stacking**: overlays may stack (settings modal → delete confirm). Each layer traps
  focus within itself; Escape and dismissal affect only the top layer. Background content
  gets `aria-hidden` and inert.
- **Dismissal semantics** (all configurable, defaults in parentheses):
  - `Escape` key closes non-modal... no — by default Escape closes *any* dialog
    (`dismissOnEscape: true`), except while a nested destructive confirm is pending.
  - Scrim click closes (`dismissOnScrimClick: true`) for `Dialog`; **never** for
    `AlertDialog` — destructive confirmations require an explicit choice, matching the
    corpus (Manus delete dialog has no scrim-dismiss affordance; Cancel and Delete only).
  - Close button (`X`) present on `Dialog`; optional on `AlertDialog`.
- **Dirty guard**: if the overlay contains a dirty form (see 3.2), any dismiss path
  (Escape, scrim, X) first requests confirmation via `onDismissRequest`; the consumer
  shows an inline "Discard changes?" confirm. The corpus shows task modals (Add Secret,
  connector picker with selections) where accidental dismissal loses input.
- **ARIA**: `role="dialog"` + `aria-modal="true"` + `aria-labelledby`; destructive
  confirmations use `role="alertdialog"` + `aria-describedby` for the consequence text.
- **Scroll**: body scroll locked while a modal dialog is open.

### 3.2 Form dirty/save states

Two save modes, both observed in the corpus; the library supports both, per field group:

- **Auto-save** (preference toggles, segmented controls, dropdowns — Devin/Cofounder
  pattern): control commits on change; the field exposes `saving | saved | error`
  status (inline, near the control). Toggles are optimistic with rollback + error toast
  on failure.
- **Explicit commit** (modal task forms — Manus Add Secret pattern): form tracks `dirty`;
  primary action disabled until valid; `Cancel` with dirty state triggers the dirty
  guard from 3.1. Submit puts the primary button in `loading` and disables Cancel during
  flight; errors render inline at field level, not as toasts.

Field-level contract: every field exposes `data-dirty`, `data-invalid`, and an
`aria-describedby` chain covering description text and error text.

### 3.3 Destructive actions

- Always confirmed via `AlertDialog`; never a toggle or single click.
- Consequence text is required content (not optional prop) — "This cannot be undone" is
  the norm in the corpus.
- Confirm button carries `data-variant="danger"`, is **not** auto-focused (initial focus
  lands on Cancel), and enters `loading` on confirm. For catastrophic actions
  (delete org) the recipe layer may require typed confirmation; the primitive only needs
  to disable the confirm button until `confirmationValue` matches.

### 3.4 Toasts

- `role="status"` / `aria-live="polite"` for info/success; `role="alert"` /
  `aria-live="assertive"` only for errors needing action (e.g. message send failure with
  Retry action).
- Auto-dismiss with configurable duration; paused on hover/focus; persistent when the
  toast carries an action button. Max-visible with queue (corpus shows at most one at a
  time; default 3, viewport-corner region, swipe-to-dismiss on touch).

## 4. Component API sketch (headless primitives, adapter layer)

Naming follows ARCHITECTURE.md (`@aicl/core` state + framework adapters; unstyled;
`data-*` for state).

```ts
// Dialog (core state machine + adapter primitive)
interface DialogProps {
  open: boolean;
  onOpenChange(open: boolean, reason: 'escape' | 'scrim' | 'close-button' | 'programmatic'): void;
  dismissOnEscape?: boolean;        // default true
  dismissOnScrimClick?: boolean;    // default true
  initialFocus?: Ref | 'first' | 'container';
  returnFocus?: boolean;            // default true
  dirty?: boolean;                  // enables dirty-guard on dismiss
  onDismissRequest?(reason: DismissReason): boolean | void; // return false to veto
}
// Parts: Dialog.Trigger, Dialog.Scrim, Dialog.Content, Dialog.Title,
//        Dialog.Description, Dialog.Close
// data-state="open|closed", data-modal="true", data-dirty, role + aria-* per §3.1

// AlertDialog extends Dialog with:
interface AlertDialogProps extends Omit<DialogProps, 'dismissOnScrimClick'> {
  variant: 'danger' | 'warning';
  confirmationValue?: string;       // if set, confirm disabled until input matches
}
// data-variant="danger|warning"; initial focus forced to Cancel.

// Drawer: same contract as Dialog, plus
interface DrawerProps extends DialogProps {
  side: 'left' | 'right' | 'bottom';
  size?: 'sm' | 'md' | 'lg' | string;   // data-side, data-size
  swipeToDismiss?: boolean;             // touch, default true on mobile adapters
}

// Toasts: core owns a queue store; adapter owns the region.
interface ToastInput {
  title: string;
  description?: string;
  variant?: 'info' | 'success' | 'error';
  action?: { label: string; onSelect(): void };  // action ⇒ persistent
  duration?: number;                  // ms; ignored when action present
}
const toasts = createToastQueue({ maxVisible: 3, defaultDuration: 5000 });
toasts.push(input): id;  toasts.dismiss(id);  toasts.pauseAll()/resumeAll();
// <ToastRegion> exposes role/aria-live per variant;
// each <Toast> gets data-variant, data-state="entering|open|leaving".

// Form controls
interface FieldProps {
  label: string;
  description?: string;               // rendered under label, left column
  error?: string;
  // layout: label/description left, control right — matches corpus row pattern
}
// data-dirty, data-invalid, data-saving on the field root;
// Field wires aria-describedby = description + error ids.

interface SwitchProps {
  checked: boolean;
  onCheckedChange(checked: boolean): void;   // auto-save mode: consumer commits here
  disabled?: boolean;
  status?: 'idle' | 'saving' | 'error';      // optimistic-toggle feedback
}
// role="switch", aria-checked, data-state="checked|unchecked"

interface SegmentedControlProps<T> {
  value: T; options: { value: T; label: string; icon?: unknown }[];
  onValueChange(value: T): void;
}  // role="radiogroup"; arrows move selection (roving tabindex)

interface SelectProps<T> {
  value: T; options: Option<T>[];
  onValueChange(value: T): void;
  placeholder?: string;
}  // combobox/listbox pattern; typeahead; data-state open/closed
```

Reference recipes (docs only, not packages): `SettingsDialog` (nav + Field groups),
`ConfirmDelete`, `SecretForm`, `PlanCardGrid`.

## 5. Variants & states

- **Dialog**: size sm (confirm) / md (task form) / lg (settings-as-modal, ~85% viewport);
  state open/closed/dirty/saving.
- **AlertDialog**: variant danger/warning; state idle/confirming(loading)/done.
- **Drawer**: side L/R/bottom; overlay vs. push; state open/closed/dragging.
- **Toast**: variant info/success/error; state entering/open/leaving/paused; with-action.
- **Switch**: checked/unchecked/disabled/saving/error(rolled-back).
- **Select/SegmentedControl**: open/closed, disabled, invalid, saving.
- **Field**: default/dirty/invalid/saving/saved.

## 6. Gaps

- `banner_upsell` has exactly 1 labeled screenshot — cannot ground an upsell component;
  treat plan cards as a recipe until more evidence exists.
- Toasts (6) and drawers (7) are tagged rarely, likely because labels capture primary
  archetype, not transient overlays — real frequency is higher than counts suggest, but
  we have few grounded examples of their visual variants.
- No `settings_security` / API-key-management archetype observed (secrets appear under
  project settings and Manus modals, not as dedicated pages); SSO/SCIM team-admin surfaces
  are nearly absent (settings_team: 1).
- Automation editing exists only in Devin; no cross-product grounding for any automation
  component. Correctly excluded from scope.
- Knowledge/memory: `knowledge_base` (10) is split between page-style (Devin wiki) and
  modal-style (Manus) IA — more evidence needed before claiming a canonical pattern;
  out of scope either way.
- Labels do not record keyboard/focus behavior; the interaction contract in §3 follows
  platform convention (WAI-ARIA APG), not direct corpus observation.

## 7. Reference screenshots

- `Devin web Aug 2026 (1)/Devin web Aug 2026 194.png` — settings route, searchable sub-nav, label/description/control rows, toggle auto-save
- `Cofounder web Aug 2026/Cofounder web Aug 2026 349.png` — settings route, segmented theme control, danger zone
- `Lovable web Jan 2026/Lovable web Jan 2026 277.png` — settings-as-modal with grouped internal nav, account form rows
- `Manus web Mar 2026/Manus web Mar 2026 208.png` — settings-as-modal, account + credits summary
- `Manus web Mar 2026/Manus web Mar 2026 145.png` — task modal: Add Secret (name/value, Cancel/Done)
- `Manus web Mar 2026/Manus web Mar 2026 180.png` — picker modal: connector checkbox list
- `Manus web Mar 2026/Manus web Mar 2026 267.png` — connector detail modal (Gmail, Try/Manage, metadata rows)
- `Manus web Mar 2026/Manus web Mar 2026 196.png` — destructive confirm: Delete Project, danger button
- `Devin web Aug 2026 (1)/Devin web Aug 2026 110.png` — automation editor: triggers/instructions/MCPs sections
- `Lovable web Jan 2026/Lovable web Jan 2026 232.png` — billing: plan cards, annual toggle, credits progress
