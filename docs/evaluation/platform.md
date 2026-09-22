# Evaluation: platform & configuration surfaces

Phase 1 comparative evaluation of how Cofounder, Devin, Lovable, and Manus
implement settings, overlays, and form controls, following the method in
`docs/evaluation/CRITERIA.md`. Every divergent choice ends in exactly one
target behavior for the library. Input to `docs/BLUEPRINT.md`.

Related: `docs/domains/platform.md` (inventory and contract),
`docs/DECISIONS.md` (D7 headless `data-*`, D10 primitives-in/pages-out),
`docs/ARCHITECTURE.md` (three-layer split). D10 already fixed scope — only
`Dialog`/`AlertDialog`, `Drawer`, `Toast`/`ToastRegion`, `Field`, `Switch`,
`Select`, `SegmentedControl` ship — so this evaluation scores the *behavior*
of those primitives, not whether pages belong in the library. No evidence
found that challenges D10.

## 1. Scope and data

| Source | Extent |
|---|---|
| `_corpus/labels/*.json` | 1,262 screens — Cofounder 385, Devin 250, Lovable 339, Manus 288 |
| Overlay component tags | `modal` 488 (C133/D63/L160/M132), `dropdown` 191 (4/4), `toast` 6 (all Devin), `drawer` 7, `banner_upsell` 1 — all re-derived from labels |
| Platform archetypes | `settings_appearance` 146 (see Caveat 1), `settings_account` 37, `automation_editor` 32 (Devin only), `settings_billing` 32, `modal_dialog` 23, `settings_model` 21, `knowledge_base` 10, `template_gallery` 10, `integration_detail` 9, `notifications_center` 3 |
| `_corpus/ocr/*.json` | Full-text phrase scan over all 1,262 screens plus geometry scan for toast-shaped blocks |
| Screenshots read directly | 8 — Cofounder 349, Devin 41/194/225, Lovable 282/303, Manus 196/260 |

**Caveat 1 — `settings_appearance` is over-applied `[label-floor]`.** OCR over
the 146 labeled screens: only 1 contains the word "appearance" and 17 contain
"theme", while "account" hits 70, "secret" 62, "plan" 52, "connector" 49,
"env" 48, "repositories" 40, "billing" 23. The labeler absorbed generic
project/org config pages. True appearance-specific screens are ≈17–20. The
146 count is used nowhere below.

**Caveat 2 — all 6 `toast` labels are false positives for product chrome
`[observed]`.** Every toast-labeled screen is a Devin capture of a *generated
todo app under test* (Devin 41 shows localhost:3001 login inside a screencast
with "toast shown" test annotations). Product-chrome toasts are instead
grounded by OCR geometry: short status phrases ("Workspace settings updated
successfully", "Task created", "Profile updated successfully", "Public link
copied") in edge zones — ≥113 toast-shaped blocks across all four products
(C12/D61/M20/L20, minus column-header false positives like "CREATED"). Toasts
are 4/4 real; the label count of 6 is noise in both directions.

**Caveat 3 — all 7 `drawer` labels are persistent right rails, not overlay
drawers `[label]`.** Every drawer-tagged screen has `shell_layout =
sidebar_main_aside` (Manus meeting panels, Cofounder project setup, Lovable
editor rails). Overlay drawers (mobile nav, slide-over dialogs) are
unobserved as labels. `banner_upsell` (1) sits on a marketing landing page,
not in-product.

**Caveat 4 — `segmented_control` is 0 labels but observed `[observed]`.**
Cofounder 349 shows Theme as Light/System/Dark segments and Shadows as
On/Off; `radio_group` (21, 3/4) partially covers the pattern. Label
vocabulary gap, not absence.

**Caveat 5.** Stills cannot show focus, keyboard handling, hover, or scrim
click behavior. All of §3.6 and the dirty-guard are `[inferred]` or
`[extrapolation]`. Counts below were re-derived from the raw labels; where a
label and OCR disagree (toasts, appearance), OCR + screenshots win.

## 2. Settled conventions (4/4, not matrixed)

| Convention | Evidence | Library consequence |
|---|---|---|
| Modal dialog is the dominant overlay for blocking work | `[label]` `modal` 488/1,262 (39%), 4/4 | `Dialog` is the core overlay primitive |
| Dialog anatomy: centered card, title, `X` top-right, footer `Cancel` + primary | `[observed]` Devin 225, Manus 196/260, Lovable 282; `[label]` `modal_dialog` 23 | Fixed part structure: Trigger/Content/Title/Description/Close |
| Destructive actions always route through a confirmation dialog | `[label]` OCR "delete" 131 screens 4/4; consequence text ("cannot be undone"/"permanently") 23 screens, 3/4 (Devin 1); `[observed]` Manus 196, Lovable 282, Cofounder 365 | `AlertDialog` ships; consequence text is required content |
| Form rows: label + one-line description left, control right | `[observed]` Devin 194/225, Cofounder 349, Lovable 303; Manus settings nav pages | `Field` owns label/description/control layout |
| Control vocabulary: text input, checkbox, toggle, dropdown | `[label]` `text_input` 448, `checkbox` 171, `dropdown` 191, `toggle_switch` 37 — all 4/4 | `Field`/`Switch`/`Select`/`SegmentedControl` set confirmed |
| Toggles/segmented/dropdowns commit immediately on change | `[observed]` Devin 225 (toggles, no save button), Cofounder 349 (segmented, no save button), Lovable 303 (toast-confirmed update) | Auto-save is the default save mode for instant controls (§3.2) |
| Secrets are name/value forms | `[label]` OCR "secret"/"environment variable" hits: Devin 10, Cofounder 6, Manus 6, Lovable 1 | `SecretForm` stays a recipe (D10) |
| Billing is plan cards + per-plan CTA | `[label]` `settings_billing` 32, 4/4; `[observed]` Lovable 232 (per domain spec) | Recipe, no API |

## 3. Divergent choices

### 3.1 Where do settings live: dedicated route or large modal?

| Product | Answer | Evidence |
|---|---|---|
| Devin | Dedicated route; left sub-nav grouped Personal/Organization, breadcrumb "Settings / General", **"Search settings…" filter box** | `[observed]` Devin 194/225; `[label]` OCR "search settings" 48 screens, Devin only |
| Cofounder | Dedicated route; flat 12-entry sub-nav (Preferences … Advanced), "Danger Zone" at page bottom | `[observed]` Cofounder 349; `[label]` settings screens mostly `sidebar_main` without `modal` tag (41 vs 13 with) |
| Manus | Settings-as-modal (~85% viewport) over dimmed workspace; internal left nav with 12+ entries; close `X` | `[observed]` Manus 260; `[label]` 54 of 72 Manus settings screens carry the `modal` tag |
| Lovable | Settings-as-modal (~90% viewport); nav grouped Workspace/Account/Connectors | `[observed]` Lovable 303; `[label]` 40 of 72 Lovable settings screens carry `modal` |

Scores — convention strength: 2/2 split, no default. UX heuristics: route
**strong** on deep-linking, search, and long forms; modal **strong** on
context preservation (workspace visible behind scrim) and **weak** on
viewport crowding at small sizes. Accessibility **neutral** — both can be
correct; the modal variant *requires* a correct focus trap to be operable,
the route variant does not. Headless fit **strong** for shipping neither:
both are compositions of `Dialog` (or a route) + nav + `Field`s; encoding
either as a component bakes in one product's IA. Portability **neutral**.
Ergonomics: a `size="lg"` dialog option plus a recipe covers both at one
concept.

**Verdict.** The products split cleanly and both patterns work; the only
load-bearing library consequence is that `Dialog` must comfortably scale to
~85–90% viewport with internal scrolling and a trapped focus region, because
two of four products put their entire settings surface inside one. Devin's
settings search is 1/4 (`[label]` 48 OCR hits, Devin only) — one product's
bet, recipe material.

**Recommendation `[observed-default]` (scope) — confirm D10.** No
`SettingsPage` component and no IA default. `Dialog` supports
`size: 'sm' | 'md' | 'lg'` where `lg` ≈ 85% viewport; both settings patterns
ship as documented recipes (`SettingsDialog` using `Dialog` at `lg`,
`SettingsRoute` using a plain layout). Settings search is an opt-in recipe,
not API.

**Dissent — Devin.** The route pattern with search is strictly better for
power-user settings surfaces (deep links, findability across 20+ entries);
nothing in the recommendation prevents it, it just declines to bless it.

### 3.2 Which controls auto-save, and which require explicit commit?

| Product | Answer | Evidence |
|---|---|---|
| Devin | Toggles auto-save in place; **text edits open a small Cancel/Save modal** ("Change organization name") | `[observed]` Devin 225; `[label]` OCR Cancel+Save co-occur on 19 Devin screens |
| Cofounder | Toggles/segmented auto-save (no Save anywhere on Preferences); text inputs commit implicitly | `[observed]` Cofounder 349; `[label]` OCR "saved"-class toast blocks, 12 Cofounder hits |
| Lovable | Everything auto-saves, incl. multi-field text forms; success acknowledged by **bottom-right toast** ("Workspace settings updated successfully") | `[observed]` Lovable 303; `[label]` 20 Lovable toast-shaped blocks, 11 bottom-right |
| Manus | Instant controls auto-save; **multi-field text forms get footer Cancel + Save** (Personalization); acknowledged by **top-center toast** ("Profile updated successfully") and a persistent "Saved" indicator | `[observed]` Manus 260; `[label]` 20 Manus toast-shaped blocks, 7 top-center |

Scores — convention strength: auto-save for instant controls is 4/4
(`[observed]` all four); text-form handling splits 2 explicit (Devin modal,
Manus footer) / 2 implicit (Lovable, Cofounder). UX heuristics: auto-save
**strong** on effort and latency perception but **weak** without visible
confirmation — every product pairs it with a toast or status indicator, which
makes the acknowledgment part of the convention, not an extra. Explicit
commit is **strong** on error prevention for multi-field forms (half-edited
state never persists) and **weak** on effort. Accessibility: explicit commit
**strong** (predictable, reviewable); auto-save needs the status announced
(`aria-live`) to stay **neutral**. Headless fit **strong** if save mode is a
per-field-group behavior flag, never a component fork. Portability **strong**
— both modes are store logic. Ergonomics: one `saveMode` union beats
per-control booleans.

**Verdict.** There is no real disagreement about instant controls — all four
auto-save them, and all four visibly acknowledge the save. The genuine split
is text forms, and both observed answers are defensible; explicit commit is
the safer default because it composes with the dirty-guard and cannot
half-persist a form, while implicit commit is a one-prop deviation that
Lovable proves viable when acknowledgment is reliable.

**Recommendation `[observed-default]` with `[adjusted]` text-form default.**
Two save modes keyed by control class: instant controls (`Switch`,
`SegmentedControl`, `Select`) commit in `onValueChange` and the field exposes
`data-saving | data-saved | data-error` with optimistic rollback + error
toast on failure; composite text forms default to **explicit commit**
(footer actions, primary disabled until valid, `data-dirty` tracked,
dirty-guard on dismiss), with `saveMode="auto"` + debounce as the documented
deviation for Lovable-style forms. Every auto-save must surface its status
through the field's live region or a toast — acknowledgment is mandatory, not
optional.

**Dissent — Lovable.** Full auto-save with toast acknowledgment is lower
effort and measurably works at scale; `saveMode="auto"` is the supported
expression of that bet.

### 3.3 How is destruction confirmed?

| Product | Answer | Evidence |
|---|---|---|
| Manus | Small centered dialog: title, "Are you sure…?" consequence text, Cancel + red **Delete** | `[observed]` Manus 196 |
| Lovable | Two tiers: plain confirm for account deletion ("This cannot be undone", red button); **typed confirmation** for workspace deletion ("Type the workspace name to confirm", confirm disabled until match) | `[observed]` Lovable 282; `[label]` typed-confirm OCR pattern on 4 Lovable screens |
| Cofounder | Danger Zone section at settings bottom + typed confirmation dialogs | `[observed]` Cofounder 349 (Danger Zone); `[label]` typed-confirm OCR on Cofounder 365/366/367 |
| Devin | Consequence text rare (1 OCR hit) but confirmation dialogs present ("delete" on 68 screens, Cancel+Save/confirm co-occurrence) | `[label]` OCR; `[label-floor]` — least evidence of the four |

Scores — convention strength: confirmed-via-dialog is 4/4; danger-colored
confirm 3/4 grounded (`[observed]` Manus, Lovable, Cofounder); typed
confirmation 2/4. UX heuristics: typed confirmation **strong** on error
prevention for irreversible shared resources, **weak** on friction for
routine deletes — matching how Lovable/Cofounder tier it. Accessibility
**strong** for keeping initial focus off the destructive button (all
observed dialogs put Cancel beside the danger button; `[inferred]` for focus
specifics). Headless fit **strong**: `confirmationValue` as an optional prop
keeps one component. Ergonomics **strong** for tiering via one optional prop
rather than a second component.

**Verdict.** Universal agreement on the dialog itself; the only divergence is
escalation. Typed confirmation is a 2/4 pattern used exactly where blast
radius warrants it (workspaces/orgs), so it belongs in the primitive as an
opt-in, not as a recipe hack.

**Recommendation `[observed-default]`.** Destructive actions always go
through `AlertDialog`: required consequence text, `data-variant="danger"`
confirm, no scrim-dismiss, initial focus on Cancel (`[inferred]` focus
detail), confirm enters `loading` on commit. `confirmationValue` opt-in:
when set, confirm stays disabled until the input matches — the Lovable/
Cofounder tier for catastrophic deletes, not the default.

**Dissent — none material.** Devin's lighter evidence trail doesn't
contradict the pattern.

### 3.4 Which overlay does which job: modal vs drawer vs toast?

| Product | Answer | Evidence |
|---|---|---|
| All | Modals carry confirmations, task forms, pickers, detail views, entire settings | `[label]` `modal` 488, 4/4; `[observed]` Manus 145/196, Devin 225, Lovable 282 |
| All | Side panels are **persistent rails**, not transient drawers | `[label]` all 7 `drawer` tags are `sidebar_main_aside` layouts; verified against screenshots per Caveat 3 |
| All | Toasts carry transient status only (save confirmations, "copied", task created) | `[label]` OCR geometry: 113+ toast-shaped blocks, 4/4 (Caveat 2) |
| All | Upsell is a billing *page* (plan cards), never an inline banner | `[label]` `banner_upsell` 1, on a marketing page; `settings_billing` 32, 4/4 |

Scores — convention strength: job assignment is 4/4 consistent (blocking →
modal, ambient panel → rail, transient status → toast). UX heuristics
**strong**: each channel matches its interruption cost. Accessibility:
modals demand trap/return `[inferred]`; toasts demand live-region discipline
(§3.5); rails are layout, **neutral**. Headless fit: `Drawer` as a primitive
is **weak** on corpus grounding (zero observed overlay drawers) but
**strong** on chat need — mobile transcript nav and narrow-viewport artifact
panels are chat-surface requirements even though desktop captures don't show
them. Portability **strong** for all three. Ergonomics: three primitives
with disjoint defaults, no overlap.

**Verdict.** The corpus is unambiguous about the modal and toast jobs and
silent — not negative — about overlay drawers. Drawers ship because the
*chat* surface needs them on narrow viewports, flagged as extrapolated from
mobile convention rather than corpus-observed.

**Recommendation `[observed-default]` (modal, toast) + `[extrapolation]`
(drawer).** `Dialog` owns all blocking overlays; `ToastRegion` owns transient
status; `Drawer` ships with the same contract as `Dialog` plus
`side`/`size`/`swipeToDismiss`, documented as grounded in mobile convention,
not the desktop corpus. No upsell component; plan cards stay a recipe.
*Falsified for drawers if* a mobile capture set shows all four products
using full-screen routes instead of slide-overs for transcript nav.

**Dissent — none.**

### 3.5 Where do toasts appear, and how many at once?

| Product | Answer | Evidence |
|---|---|---|
| Lovable | Bottom-right corner; title + body ("Success / Workspace settings updated successfully") | `[observed]` Lovable 303; `[label]` 11 of 20 Lovable toast blocks in bottom-right zone |
| Devin | Bottom-right ("Automation created successfully", x≈0.80 y≈0.87) | `[label]` OCR geometry, 7 bottom-right blocks |
| Cofounder | Bottom-left ("• Public link copied", "• Agent updated", x≈0.03 y≈0.85) | `[label]` OCR geometry, 5 bottom-left blocks |
| Manus | Top-center / top-left ("Profile updated successfully" x≈0.47 y≈0.06; persistent "Saved" top-left) | `[observed]` Manus 260; `[label]` 11 top-left + 7 top-center blocks |

Scores — convention strength: placement splits 2 BR / 1 BL / 1 TC — no
majority. Concurrency: at most one toast visible per capture across all
four `[label]` (no multi-toast stack in 113+ blocks) — that part *is* a
convention. UX heuristics: bottom corners **strong** (out of the content
flow); top-center **neutral** (collides with headers but highly visible —
Manus uses it for exactly one confirmation at a time). Accessibility
**neutral** to placement, **strong** on the shared discipline: one at a
time, polite live region, assertive only for actionable errors. Headless fit
**strong** if placement is pure styling and core owns only the queue.
Portability **strong**. Ergonomics: one `placement` attribute on the region,
not per toast.

**Verdict.** Products agree on behavior (single, transient, acknowledged,
corner-ish) and disagree only on which corner — a styling decision the
library should not make load-bearing. The durable rules are the queue, the
live-region mapping, and pause-on-hover/focus (`[inferred]`: stills can't
show hover).

**Recommendation `[adjusted]`.** `ToastRegion` renders at a viewport corner,
`placement` defaulting to bottom-end (the 2/4 majority and platform-snackbar
convention) with all four observed placements supported. Core queue defaults
to `maxVisible: 3` with FIFO overflow — the corpus shows one at a time, so 3
is headroom, not a target (`[extrapolation]` on the exact number). Variants
map to live regions: info/success → `role="status"` polite; error-with-action
→ `role="alert"` assertive and persistent until dismissed; auto-dismiss
pauses on hover/focus `[inferred]`.

**Dissent — Manus.** Top-center is more noticeable for exactly one
confirmation and avoids covering bottom-docked composers; supported via
`placement`, just not the default.

### 3.6 Focus, dismissal, and dirty-guard (corpus-silent)

No matrix: no label or OCR signal can capture keyboard or focus behavior, and
no screenshot shows a dirty-form intercept. Scoring here is `[inferred]`
throughout; the entries below are extrapolations with falsifiers, recorded in
§5 rather than matrixed. The corpus *does* ground the dismissal affordances
themselves — every observed dialog carries `X` and/or Cancel (`[observed]`
Manus 196/260, Devin 225, Lovable 282) — and shows stacking (settings modal
under a delete confirm, `[observed]` Lovable 282), so per-layer dismissal and
top-layer-only Escape follow from observed structure plus platform
convention.

## 4. Recipe inventory (D10, app-level — not matrixed)

Recorded for the blueprint's docs track; none contains chat-critical behavior
that would pull it into the library:

- **OAuth / connector auth** — "Connect" buttons leaving the app, permission
  grants. `[label]` connect/authorize text on integration screens (Lovable 8,
  Manus 2); `[observed]` Manus connector detail (267, per domain spec).
  Backend-shaped; the library models no auth state machine.
- **Secrets manager** — name/value forms, all four products (`[label]` OCR:
  Devin 10, Cofounder 6, Manus 6, Lovable 1). Uses `Dialog` at `md` +
  explicit-commit form — the Manus "Add Secret" pattern (145) is exactly the
  §3.2 explicit-commit mode, no new behavior.
- **Billing / plan cards** — 32 screens, 4/4. Pure composition.
- **Automation editor** — Devin only, 32 screens `[label]`. Single-product
  CRUD surface; correctly excluded.
- **Notifications center** — Manus only, 3 screens `[label]`.
- **Template gallery** — Lovable 6, Manus 4 `[label]`. Content browser, no
  chat behavior.
- **Knowledge/memory** — 10 screens, split page-style (Devin) vs modal-style
  (Manus) `[label]`; no canonical pattern, out of scope either way.

Explicitly checked: nothing in these surfaces carries behavior the chat
surface needs that isn't already covered by the eight primitives. The one
near-miss — settings auto-save acknowledgment — is toast behavior, already in
scope.

## 5. Target-behavior summary

| Choice | Target behavior | Tag | Deciding criteria |
|---|---|---|---|
| Settings IA | No IA component; `Dialog size="lg"` (~85% viewport) + `SettingsDialog`/`SettingsRoute` recipes; settings search is recipe-only | `[observed-default]` (confirms D10) | Headless fit; convention strength (2/2) |
| Save semantics | Instant controls auto-save with `data-saving/saved/error` + optimistic rollback; composite text forms default to explicit commit with dirty tracking, `saveMode="auto"` opt-in; acknowledgment mandatory | `[observed-default]` + `[adjusted]` text-form default | Convention strength (4/4 instant); UX heuristics |
| Destructive confirm | `AlertDialog` always: required consequence text, `data-variant="danger"`, no scrim-dismiss, focus to Cancel, `confirmationValue` opt-in for catastrophic deletes | `[observed-default]` | Convention strength; accessibility |
| Modality per job | `Dialog` = blocking, `ToastRegion` = transient status, `Drawer` = non-modal side panel (mobile/narrow), no upsell API | `[observed-default]` + `[extrapolation]` (drawer) | Convention strength; UX heuristics |
| Toast placement & concurrency | Corner region, `placement` default bottom-end; queue `maxVisible: 3`; variant-mapped live regions; pause on hover/focus | `[adjusted]` | Accessibility; headless fit |
| Focus & stacking | Trap per layer, Escape/dismiss affects top layer only, return focus to trigger, `aria-hidden` + inert background | `[extrapolation]` | Accessibility (veto power) |
| Dirty-guard | Any dismiss path on a dirty overlay fires `onDismissRequest`; consumer confirms discard | `[extrapolation]` | UX heuristics (error prevention) |

All seven compose with the headless `data-*` contract (every recommendation
is behavior + attributes; placement, tint, and radius stay in `@aicl/styles`),
with framework portability (queue, dirty tracking, and save modes are store
logic in `@aicl/core`; only trap/scroll-lock live in adapters), and with D10
(no page-level components added).

## 6. Gaps and extrapolations

Each `[extrapolation]` states what would falsify it.

- **Focus management — corpus-silent `[inferred]`.** Trap-on-open,
  focus-to-`initialFocus`, return-to-trigger, top-layer-only Escape follow
  WAI-ARIA APG, not pixels. *Falsified if* a capture shows a modal open with
  the background visibly interactive (e.g. a hover state behind the scrim) —
  then `modal: false` modeless dialogs become a first-class variant.
- **Scrim-click dismissal — corpus-silent `[inferred]`.** Default `true` for
  `Dialog`, `false` for `AlertDialog` (Manus 196 shows no scrim-dismiss hint
  and forces Cancel/Delete, `[observed]` for the affordances, `[inferred]`
  for the click behavior). *Falsified if* a product visibly documents
  click-outside-to-cancel on a destructive confirm.
- **Dirty-guard — corpus-silent `[inferred]`.** Task modals with Cancel/Done
  (Manus 145) and Cancel/Save (Devin 225) imply loss on accidental dismiss,
  but no "Discard changes?" intercept was captured. *Falsified if* a capture
  shows a dirty task modal closing on Escape/scrim with no confirm — then the
  guard becomes opt-in instead of default-when-`dirty`.
- **Drawer as overlay — 0 grounded labels (Caveat 3).** Ships for mobile
  transcript nav / narrow artifact panels on chat-surface need alone.
  *Falsified if* mobile captures show full-screen routes replacing
  slide-overs in all products.
- **`maxVisible: 3` — `[extrapolation]`.** Observed concurrency is 1; 3 is
  headroom chosen so bursts (multi-file uploads, batch failures) don't drop
  errors. *Falsified if* any capture shows a stack of ≥2 toasts — then the
  default rises to the observed stack depth.
- **Upsell surfaces — n=1, on a marketing page.** No in-product banner
  pattern exists to ground an API. *Falsified if* in-product upgrade banners
  appear in a future capture round — then a `Banner` primitive with
  dismiss-persistence joins the scope discussion.
- **Typed confirmation threshold — `[inferred]`.** Which deletes count as
  "catastrophic" is a consumer call; the primitive only gates on
  `confirmationValue`. *Falsified if* products converge on typed confirmation
  for *all* deletes — then it flips to default-on for `variant="danger"`.
- **`settings_appearance` (146) and `toast` (6) label counts must not be
  quoted downstream.** Caveats 1–2 supersede them; blueprint work should cite
  the OCR-grounded numbers (≈17–20 appearance screens; 113+ toast blocks,
  4/4).
