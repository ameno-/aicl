# Evaluation: navigation & session management

Phase 1 comparative evaluation of how Cofounder, Devin, Lovable, and Manus
implement the navigation domain — sidebars, session lists, search, grouping,
workspace switching — following the method in `docs/evaluation/CRITERIA.md`.
Every divergent choice ends in exactly one target behavior. Input to
`docs/BLUEPRINT.md`.

Related: `docs/domains/navigation.md` (inventory and contract),
`docs/DECISIONS.md` (D10 primitives in / pages out, D11 session metadata is
its own model), `docs/ARCHITECTURE.md` (store layer, `data-*` contract, open
question 3 on the command palette).

## 1. Scope and data

| Source | Extent |
|---|---|
| `_corpus/labels/*.json` | 1,262 screens — Cofounder 385, Devin 250, Lovable 339, Manus 288 |
| Navigation-matched frames | 694 (55.0%) — Cofounder 202, Devin 181, Lovable 163, Manus 148 |
| `_corpus/analysis/capabilities.json` | Product spreads, re-derived and verified |
| `_corpus/ocr/*.json` | Geometry-level reading of 12 frames; phrase scans over all 1,262 |
| Screenshots read directly | 4 — Devin 40, Lovable 187, Manus 165, Manus 171 |

Re-running the spec's match rule reproduces it exactly: 694 frames, 55.0%. So
do the component counts `[label]` — `sidebar_nav` 315 (83/82/75/75),
`workspace_switcher` 205 (78/24/79/24), `session_list_item` 118 (3/95/8/12),
`tab_bar` 40 (4/30/5/1), `session_search` 26 (0/23/3/0), `breadcrumb` 26
(10/5/11/0), `command_palette` 0 — and the shell layouts
(`sidebar_main_aside` 450, `sidebar_main` 236, `centered_column` 5,
`marketing_page` 3): 98.8% of navigation frames are sidebar-hosted.
Vocabulary counts reproduce within rounding (workspace 49/15/46/33 exact), so
D11's divergence argument stands.

### Corrections to the domain spec

| # | Spec claim | Finding |
|---|---|---|
| 1 | `session_list_item` is 4/4 | **3/4** `[observed]`. Cofounder's three frames are mislabels: 191 a draft-post editor, 176 a content-calendar modal, 334 a *billing transaction history* — which is also the corpus's only `session_list` archetype frame. Cofounder's task history is a right-aside panel (232) and an archive modal (99) |
| 2 | Lovable 258 shows an icon rail and the switcher with checkmark + "Create workspace" | 258 is a fully expanded sidebar with the *user-card* menu open (Settings, Appearance → Light/Dark/System, Support, Documentation, Community, Sign out). The switcher-open frame is **Lovable 245**: plan + member count, Settings, Invite members, "Credits · 105 left", an "All workspaces" list with PRO/FREE badges, "+ Create new workspace" |
| 3 | Collapsed mode renders an icon rail `[observed]` | No frame in the corpus shows a collapsed sidebar. Toggles are observed (Manus 171 panel icon plus footer cluster; Lovable 187 panel icon); the rail is `[inferred]` |
| 4 | The search modal shows "2 projects found" and filter pills | Neither exists. Lovable 187 at rest is a zero-query recents list under "RECENT PROJECTS": thumbnail, title, owner chip, relative time, first row pre-highlighted. No "N found" count anywhere in 1,262 frames; the only "found" strings are empty states ("No public projects found", "No events found", "No users found") |
| 5 | Lovable search groups by date ("Today", "May 2025") | Those hits are calendar widgets inside generated app previews (227, 178, 179). The corpus's only date-grouped session list is **Manus 165** |
| 6 | `session_search` is 2/4 | **3/4 observed** `[label-floor]`. Manus 165 carries an unlabeled search overlay ("Search tasks…"); the frame's components omit both `session_search` and `modal` |
| 7 | Row anatomy is title + status line + timestamp + dot | One secondary line, not stacked fields. Devin 40 has a constant row pitch of 0.044, title at *y* and one line at *y*+0.019: five rows read "Working · ⎇1" or "PR is ready · ⎇1", the sixth "4 days ago" (Devin 28: "1 hour ago"). Trailing dots sit on the title row of three items, x≈0.178 in a 0.19-wide sidebar |

Smaller notes: Devin's `+`/search/`…` cluster is a section-header group on
"Recent" (y=0.217), not a per-item control; and 30 of the 40 `tab_bar` frames
are Devin `automation_editor` screens, so no product uses tabs to switch
sessions. **Caveat:** stills cannot show motion, hover, or keystrokes —
debouncing, hover reveal, dot-clearing, and all keyboard rules are `[inferred]`.

## 2. Settled conventions (4/4, not matrixed)

| Convention | Evidence | Library consequence |
|---|---|---|
| Navigation lives in a persistent sidebar | `[label]` `sidebar_nav` 315, 4/4; 686 of 694 matched frames are `sidebar_main*` | Primitives assume a vertical nav host, render none of its chrome |
| Session history is one click from any screen | `[observed]` Devin 40, Manus 171, Lovable 18, Cofounder 232 | The list is a component, not a route |
| Exactly one row is active and visually distinct | `[observed]` Manus 171, Devin 40 | `role="option"` + `aria-selected`; `data-active` on one row |
| The new-session affordance is pinned outside the scroll area | `[observed]` Manus 171, Devin 40, Cofounder 232, Lovable 18 | Pinned `header` slot outside the scroll container |
| Row titles truncate to one line | `[observed]` Devin 40, Manus 171, Lovable 187 | Single-line title slot; truncation is CSS, full text stays in the a11y tree |
| Per-row overflow actions exist | `[observed]` Devin 40, Manus 171, Lovable 187 | Generic `onAction(action: string)`; contents are the consumer's |
| Section headers carry trailing actions | `[observed]` Manus 171 (`+`, filter), Devin 40 (search/`+`/`…`) | Header slot accepts trailing controls |
| Empty is a first-class list state | `[observed]` Devin 8 "No sessions"; `[label]` 11 of 118 session-list frames are `empty` | `data-empty` plus an `empty` slot |
| Skeleton rows, not spinners, cover loading | `[label]` `skeleton_loader` 85 (3/4), 10 with `session_list_item` | `data-loading` with a skeleton slot |

## 3. Divergent choices

### 3.1 Where does session history live?

| Product | Answer | Evidence |
|---|---|---|
| Devin | A "Recent" list in the sidebar under the nav items; 95 of 118 row labels corpus-wide | `[observed]` Devin 40, 28; `[label]` 95 |
| Manus | An "All tasks" sidebar section (icon + title), and the same list again in a search overlay with richer rows | `[observed]` Manus 171, 165 |
| Lovable | No sidebar list — "All projects / Starred / Shared with me" are filter routes; the list is a card grid on workspace home plus modal recents | `[observed]` Lovable 18, 187 |
| Cofounder | No sidebar list — tasks sit in a right-aside panel with count badges ("Tasks 2") and "Select all"; projects are cards; archive is a modal | `[observed]` Cofounder 232, 99 |

Scores — convention strength: "a list exists" 4/4, sidebar-hosted 2/4. UX
heuristics: sidebar hosting is **strong** on switching cost, **weak** when
rows need width (thumbnails, checkboxes) — which is why two products moved it
out. Accessibility **neutral**: a listbox works in any container that is not
itself one. Headless fit **strong** only if the list renders no width,
placement, or chrome; **weak** the moment it assumes a sidebar. Ergonomics:
one component for three hosts beats `SidebarSessionList` + `SessionGrid`.

**Verdict.** The list is universal; its host is not. Encoding "sidebar" into
the primitive makes half the corpus unbuildable.

**Recommendation `[adjusted]`.** `<SessionList>` is host-agnostic: it owns
listbox semantics, group structure, active tracking, and keyboard navigation,
and renders no width, orientation, or chrome, mounting unchanged in a sidebar,
a modal, or a page. The adjustment: the spec's sketch nests `SessionListItem`
inside a sidebar-shaped list, an assumption only 2/4 products satisfy.

**Dissent — Cofounder.** A bulk-selection management view is a different
component (checkbox column, "Select all", range selection) and is worse forced
through a single-select listbox; consumers build it from the item slot.

### 3.2 What does a row's secondary line carry?

| Product | Answer | Evidence |
|---|---|---|
| Devin | One slot: live status while active ("Working · ⎇1", "PR is ready · ⎇1"), relative time otherwise ("4 days ago") | `[observed]` Devin 40, 28 + OCR pitch |
| Manus | Nothing in the sidebar; a preview of the agent's last message in the overlay ("I have generated professional speaker notes…") | `[observed]` Manus 171, 165 |
| Lovable | Owner chip + relative time ("Samlee", "2 hours ago") | `[observed]` Lovable 187 |
| Cofounder | Status badge on cards ("• READY"); archive date in the archive modal ("Archived Jun 16") | `[observed]` Cofounder 232, 99 |

Scores — convention strength: the line exists 4/4, its content is 4-way
divergent. UX heuristics: the status line is the only variant that shows
system status without opening the session — **strong** for an agent product;
previews are **strong** on recall, **weak** on scanning. Accessibility: the
content must join the option's accessible name or an `aria-describedby`
target, or the listbox announces title-only and drops live state. Headless fit
**strong** as a slot, **weak** as a fixed field; one slot with a resolution
order beats three exclusive props.

**Verdict.** Each product reserves one line under the title and fills it with
what its domain makes urgent. The library cannot pick content, but the corpus
fixes the arbitration rule: liveness wins — Devin drops its timestamp the
moment a session is working.

**Recommendation `[observed-default]`.** One `secondary` region per row,
resolved in order: `statusLine` when `status !== 'idle'`, else `preview`, else
relative time from `updatedAt`, else nothing. The resolved source is exposed
as `data-secondary="status | preview | time | none"` and wired into the
option's accessible description; a slot overrides the region entirely.

**Dissent — Lovable.** In a shared workspace ownership outranks liveness;
passing an owner string as `preview` reproduces it only while a session is
idle, so consumers who need it always pass the slot.

### 3.3 Relative or absolute timestamps?

| Product | Answer | Evidence |
|---|---|---|
| Devin | Relative and coarse ("1 hour ago", "4 days ago"), one per list | `[observed]` Devin 40, 28 |
| Lovable | Relative and fine ("4 minutes ago", "2 hours ago") on every result | `[observed]` Lovable 187 |
| Manus | Absolute time-of-day ("23:08", "22:42", "20:12") — under a "Today" group header | `[observed]` Manus 165 |
| Cofounder | Absolute date, and a different field: "Archived Jun 16" / "Archived Jun 12" | `[observed]` Cofounder 99 |

Scores — convention strength: relative 2/4, absolute 2/4 on the surface. UX
heuristics: relative is **strong** for recency judgement, **weak** for
identification; Manus's clock times are legible only because the group header
supplies the date. Accessibility: `<time dateTime>` settles it — the
machine-readable value is invariant, the printed form is a rendering choice.
Portability **weak** for a built-in formatter (locale data, clock ticks),
**strong** for a formatter hook.

**Verdict.** Not a real 2/2 split: three products print one timestamp whose
precision complements the group header, and the fourth prints a different
field (archive date, not last activity).

**Recommendation `[adjusted]`.** Rows emit `<time dateTime={ISO}>` and format
through one `formatTime(ts, ctx)` hook — relative by default, time-of-day when
the item sits inside a date-labeled group. No locale data and no
`Intl.RelativeTimeFormat` dependency in core. The adjustment: no product
switches formats dynamically; this generalises Manus's static pairing into the
rule that produced it.

**Dissent — Cofounder.** Archive and audit dates must never go relative;
"Archived Jun 12" is a record, "3 months ago" is not. Those fields belong in
`metadata` with a consumer formatter, not in `updatedAt`.

### 3.4 How is search surfaced?

| Product | Answer | Evidence |
|---|---|---|
| Lovable | Sidebar nav row "Search" opens a centered modal: query field, close X, zero-query recents, first row pre-highlighted | `[observed]` Lovable 187; `[label]` 3 |
| Manus | Sidebar nav row "Search" opens an overlay: query field, an action row ("+ New task"), then a "Today"-grouped list with previews and times; plus a scoped "Search files" input in Library | `[observed]` Manus 165, 171; `[label-floor]` 0 |
| Devin | An inline search icon in the "Recent" section header — filters in place, no overlay | `[observed]` Devin 40, 28; `[label]` 23 |
| Cofounder | A top-bar search icon; scope unobserved | `[observed]` Cofounder 232; `[label]` 0 |

Scores — convention strength: search exists 4/4 after correction 6; overlay
2/4, inline 2/4. UX heuristics: the overlay is **strong** on focus and on rows
the sidebar cannot fit, and is the only variant where either product shows
results; inline is **strong** on context preservation. Accessibility: the
overlay needs dialog semantics, a focus trap, and restore-on-close around a
listbox tracked by `aria-activedescendant` while focus stays in the input;
inline needs the same minus the trap. Ergonomics: two components for one
behavior is the failure mode.

**Verdict.** Overlay and inline are the same combobox in different
containers. The corpus fixes one hard requirement: no submit affordance
anywhere, and both overlays show results before a query is typed.

**Recommendation `[observed-default]`.** One `<SessionSearch>` — controlled
`value`, `onChange`, consumer-filtered `results: SessionGroup[]`, and
`data-variant="inline | modal"` selecting only whether it mounts in place or
inside `Dialog` (shipping under D10). Incremental-only: no submit, no
Enter-to-search; Enter activates the active option. An empty query renders
whatever `results` holds, which is how both products show recents. Debouncing
is the consumer's.

**Dissent — Devin.** Filtering in place preserves scroll position and avoids a
dialog, which is better in a narrow sidebar and for keyboard users;
`variant="inline"` is the supported way to get it, not a workaround.

### 3.5 How are sessions grouped and ordered?

| Product | Answer | Evidence |
|---|---|---|
| Devin | One flat "Recent" group, newest first, no date headers | `[observed]` Devin 40, 28 |
| Manus | Flat "All tasks" in the sidebar with a trailing filter control; day-bucketed ("Today") in the overlay; "Projects" is a sibling section, not a bucket | `[observed]` Manus 171, 165 |
| Lovable | Grouping is routing: "All projects / Starred / Shared with me" nav rows plus home tabs "Recently viewed / My projects / Shared with me / Templates" | `[observed]` Lovable 18, 187 |
| Cofounder | Status-partitioned surfaces: active tasks in the aside panel, archived items in a separate modal | `[observed]` Cofounder 232, 99 |

Scores — convention strength: date-grouped headers 1/4 `[observed]` (the spec
claims 2/4; correction 5), starred-as-section 1/4, starred-in-row 1/4, and
project-as-parent-not-group **4/4** — no product groups the list by project.
UX heuristics: date buckets are **strong** at scale, **weak** for a six-item
list, which is why Manus shows them only in the overlay. Accessibility: groups
must be `role="group"` with an `aria-label`, or the list is one
undifferentiated run of options. Headless fit: accepting pre-grouped data is
**strong**, sorting inside the library **weak** — locale-aware bucketing and
star policy are app decisions.

**Verdict.** Ordering is the thing all four disagree about and none exposes to
the user, a reliable signal of product policy. The corpus fixes one negative:
a project is a filter or a parent, never a group header.

**Recommendation `[observed-default]`.** `<SessionList groups={...}>` renders
groups in the order given and never sorts, buckets, or pins. Each group is
`role="group"` + `aria-label`, headers are a slot with room for trailing
controls, and `parentId` is data the consumer filters on. A pure
`bucketByRecency(sessions, now)` helper is exported from `@aicl/core` —
exported, not applied.

**Dissent — Manus.** Day bucketing is the one grouping rule that generalises,
and making every consumer reimplement "Today / Yesterday / Last 7 days" is a
papercut; the helper is one line from being the default.

### 3.6 Where does new-session creation start?

| Product | Answer | Evidence |
|---|---|---|
| Manus | "New task" is the first sidebar row, above Search and Library — and the first row inside the search overlay | `[observed]` Manus 171, 165 |
| Devin | A `+` in the "Recent" section header, beside search and `…` | `[observed]` Devin 40, 28 |
| Lovable | No button — the workspace-home composer *is* creation ("Let's create, Samlee") | `[observed]` Lovable 18 |
| Cofounder | "+ New Agent" in the right aside, plus per-section `+` controls | `[observed]` Cofounder 232 |

Scores — convention strength: an always-visible creation affordance 4/4,
outside-the-scroll-area 4/4, placement 4-way. UX heuristics: a pinned row is
**strong** on discoverability; composer-first is **strong** on time-to-value,
**weak** on discoverability from an empty state. Accessibility: it must be a
`button` outside the listbox — an action rendered *inside* the options list,
as Manus's overlay does, is defensible only if announced as an option.
Headless fit: a `NewSessionButton` is **weak** (a button with an icon); a
pinned slot is **strong**.

**Verdict.** Every product agrees creation is always reachable and never
scrolls away; none agrees where it sits and one has no control at all. There
is no component here, only a structural guarantee.

**Recommendation `[observed-default]`.** `<SessionList>` exposes a `header`
slot rendered outside the scroll container and marked `data-pinned`; the
library ships no creation button and no creation event. Composer-first
creation and overlay action rows stay app composition, with one rule: an
action inside the results listbox is an `option` carrying
`data-kind="action"`, so keyboard traversal stays coherent.

**Dissent — Lovable.** Composer-first creation is the better default when the
first message defines the session, and a pinned "New" button there is dead
chrome; the slot is optional so that shape costs nothing.

### 3.7 Is the workspace switcher a navigation primitive?

| Product | Answer | Evidence |
|---|---|---|
| Lovable | A true switcher: plan and member count, Settings, Invite members, credits, an "All workspaces" list with PRO/FREE badges and the active workspace first, "+ Create new workspace" | `[observed]` Lovable 245 |
| Devin | A top-left org slug button ("samleemobbin-dot ∨"); joining and creating happen in a centered dialog ("Join Devin workspace", "Create workspace"), not the menu | `[observed]` Devin 40, 8 |
| Manus | No workspace concept in the chrome — a brand mark and a collapse toggle; the top-bar chip is a *model* picker ("Manus 1.6 Lite ∨") | `[observed]` Manus 171, 165 |
| Cofounder | An account initial ("AS ∨") plus a breadcrumb ("AS Mobbin › Engineering") in the top bar | `[observed]` Cofounder 232 |

Scores — convention strength: the 205-frame 4/4 label count collapses to
**1/4 for actual workspace switching** once spot-checked — here the labeler
*over*-detects, counting brand rows, an account chip, and a model picker. What
is 4/4 is placement: whatever occupies the slot is the first interactive
element of its container. UX heuristics **neutral** — plan, credits, and
invites are billing IA. Headless fit **weak**: a switcher is a `Select`/menu
bound to app routing, and D10 already ships `Select`, `Dialog`, and menus; a
typed alias would invite plan badges and credit counters into the library.

**Verdict.** Read frame by frame, the corpus does not support a
workspace-switching convention: one product switches workspaces, one has a
join/create dialog, two have chrome mistaken for a switcher. What generalises
is position, and position is layout.

**Recommendation `[adjusted]`.** No `WorkspaceSwitcher` primitive in v1; it
ships as a recipe over the existing `Select`/menu primitives, carrying the one
behavior the corpus fixes — the active entry is `aria-checked` and sorted
first, an optional create row sits last. The adjustment: the spec lists it
among the primitives on a 4/4 count that does not survive inspection.

**Dissent — Lovable.** Its menu is real and fiddly (active check, badges,
create row, keyboard loop). Consumers get the keyboard and ARIA behavior from
`Select`; only the payload is theirs, and that payload is billing IA.

### 3.8 Sidebar collapse: what is actually observed?

| Product | Answer | Evidence |
|---|---|---|
| Manus | Two triggers: a panel icon at the sidebar's top-right and a footer icon cluster | `[observed]` Manus 171, 165 |
| Lovable | One panel icon at the sidebar's top-right | `[observed]` Lovable 187 |
| Devin | A collapse control is claimed by the spec but is not visible in OCR or the read frames | `[label-floor]` |
| Cofounder | No collapse control across 83 `sidebar_nav` frames; the sidebar is fixed and tabs live in the top bar | `[observed]` Cofounder 232 |
| All | No frame anywhere shows the collapsed state | `[observed]` (absence) |

Scores — convention strength: a toggle is 2/4 `[observed]` (3/4 per the spec);
the collapsed rail is 0/4. UX heuristics **strong** for user control.
Accessibility decides this one: the toggle must be a `button` with
`aria-expanded` and `aria-controls`, and a collapsed rail must keep each
item's accessible name — tooltips are not accessible names, and a rail that
demotes labels to `title` is unusable with a screen reader. Headless fit
**strong** for state, **weak** for rendering a rail (CSS on a data attribute).

**Verdict.** The corpus proves the control exists and proves nothing about
what collapsing looks like — including in the one frame the spec cites as
evidence for the rail.

**Recommendation `[adjusted]`.** `<SidebarNav>` takes `collapsed` /
`defaultCollapsed` / `onCollapsedChange`, exposes `data-state="expanded |
collapsed"` on the root and `data-collapsed` on items, renders the same DOM in
both states, and keeps every item label in the accessible tree. Any number of
consumer triggers may drive the state; no persistence — storage is the app's.
The adjustment: the spec's "labels become tooltips" is unobserved and is an
accessibility regression.

**Dissent — Manus.** Two triggers in one product signals consumers want the
toggle in several places; because the state is controlled that costs nothing,
but a library owning the trigger would have gotten it wrong.

### 3.9 Does a `CommandPalette` ship in v1?

| Product | Answer | Evidence |
|---|---|---|
| Manus | The closest thing in the corpus: an overlay mixing an **action** row ("+ New task") with session results under a date group | `[observed]` Manus 165 |
| Lovable | A search overlay with zero-query recents and a pre-highlighted first option — palette ergonomics, single source | `[observed]` Lovable 187 |
| Devin | No palette; the `@repo` mention combobox supplies the listbox contract (arrow keys, active row, typeahead) | `[observed]` Devin 28 |
| Cofounder | No palette; a top-bar search icon | `[observed]` Cofounder 232 |
| All | `command_palette` component 0 frames; `command_palette` archetype 0; `search_results` archetype 0 | `[label]` |

Scores — convention strength **0/4** for a palette, 3/4 for the combobox it
would be built from. UX heuristics: a palette's value is multi-source ranking,
exactly the part the corpus cannot specify — correction 4 removes even the
result-count evidence. Accessibility **neutral**: identical to the combobox
already required by `SlashMenu`, `MentionMenu`, and `SessionSearch`. Headless
fit **weak** as a separate component — a second vocabulary (`CommandSource`,
`Command`) for behavior already shipping, and a fourth keyboard implementation
to keep in sync.

**Verdict.** The decisive argument is not that the corpus lacks a palette; it
is that the one product edging toward one built it by adding an action row to
a search overlay — a composition the library can already express. A palette
primitive would add API surface and no new behavior in exchange for a ranking
policy nobody can evidence.

**Recommendation `[extrapolation]`.** No `CommandPalette` in v1. Factor the
listbox contract that `SlashMenu`, `MentionMenu`, and `SessionSearch` share
into one internal combobox (ArrowUp/Down move the active option, Enter
activates, Esc closes and restores focus, typeahead refines,
`aria-activedescendant` while focus stays in the input), and let
`SessionSearch` accept non-session groups so an actions group sits beside
results — exactly Manus 165. Cmd-K ships as a recipe: bind a shortcut, render
`SessionSearch` in `Dialog` with an actions group. **Falsified if** a captured
product ranks across heterogeneous sources (files, settings, docs, sessions)
with scoring the recipe cannot express. Resolves ARCHITECTURE.md open question
3 and DECISIONS.md open question 3.

**Dissent — Manus.** Its overlay is a palette in all but name, and a consumer
wanting Cmd-K today gets only a recipe. If palettes prove table stakes, the
recipe becomes the component against the same contract.

## 4. Session model and the primitives/app split

### 4.1 `SessionMeta` — the minimal API for any of the four lists

Per D11: a separate model with its own store, never inside `ChatState`.
Fields survive only where a product is observed rendering them.

```ts
// @aicl/core — sibling to the conversation model, outside ChatState
interface SessionMeta {
  id: string;
  title: string;                // consumer-supplied; the library never derives it
  updatedAt?: number;           // epoch ms — relative time and consumer sorting
  createdAt?: number;
  status?: 'idle' | 'running' | 'awaiting-input' | 'error' | `data-${string}`;
  statusLine?: string;          // Devin "PR is ready · ⎇1" — composite, product-authored
  preview?: string;             // Manus snippet of the agent's last message
  unread?: boolean;             // Devin's trailing dot
  starred?: boolean;            // Manus in-row star, Lovable "Starred" route
  parentId?: string;            // project/workspace parent — a filter, never a group
  archivedAt?: number;          // Cofounder "Archived Jun 12"
  metadata?: Record<string, unknown>;   // owner, thumbnail, badges, branch counts
}

interface SessionGroup {
  id: string;                   // 'actions' | 'today' | 'starred' | …
  label?: string;               // rendered as the group's aria-label
  sessions: SessionMeta[];
}
```

Against the candidate fields: `id`/`title` are 4/4 and required; `updatedAt`
(not `lastActiveAt`) drives both relative time and the consumer's sort and
matches `Message.createdAt` naming, but stays optional because Manus's sidebar
rows print no time. `status` **and** `statusLine` are the one addition to the
spec's sketch — the enum drives `data-status` and §3.2's resolution order
while the string carries "PR is ready · ⎇1", which no library can compose from
an enum; the `data-${string}` escape mirrors `Part`. `preview` is content
rather than state (Manus 165). `unread` is 1/4 but a cheap boolean behind
`data-unread`, cleared by the consumer. `starred` is 2/4 and painted at rest
(Manus 171's gold star), so it is not hover state. `parentId`, not
`projectId`, for D11's neutrality reason. `archivedAt` is a timestamp, not a
boolean, because Cofounder renders the date. **Rejected:** `thumbnailUrl`
(Lovable and Cofounder show thumbnails — as an item slot; a URL field drags
image policy into core), `owner` (Lovable only → `metadata`), `messageCount`,
`model`, and `branchCount` (inside `statusLine`).

`createSessionStore()` returns a `ReadableStore` over `{ byId:
Record<string, SessionMeta>; groups: { id; label?; ids: string[] }[] }` — the
transcript's normalisation rule, so a status tick touches one row and an
append is O(1). A consumer running a live list beside an open chat holds one
`ChatController` and one session store; neither knows about the other.

### 4.2 Primitives in, recipes out (D10)

| Headless primitive | App-level recipe |
|---|---|
| `SessionList` (listbox, groups, active tracking, keyboard) | Workspace home (composer + list + tabs composition) |
| `SessionListItem` (`data-status`, `data-unread`, `data-starred`, `data-active`, `data-secondary`) | Workspace switcher (§3.7 — `Select` + menu) |
| `SessionSearch` (combobox, inline or `Dialog`) | Template gallery (10 frames, 2/4 — a card grid) |
| `SidebarNav` + collapse state (§3.8) | Breadcrumb (`nav` + `ol`; 26 frames, 3/4) |
| The shared combobox contract (§3.9) | Tab bar (40 frames, 30 of them automation editors) |
| | Archive/delete confirmation (`AlertDialog`, shipping under D10) |
| | Bulk-select management view (§3.1 dissent) |

### 4.3 Virtualization

The session list shares the transcript's open question but not its difficulty:
rows are fixed-height (Devin's pitch is a constant 0.044 of the viewport) with
no stick-to-bottom, no live region, and no find-in-page — the three hard parts
are absent. Against that, the corpus shows no scale: `pagination` is 65 frames
and 4/4 but never on a session list, and the longest observed list is six rows.

**Recommendation `[extrapolation]`, matching the transcript.** Virtualization
does not ship inside `<SessionList>` in v1. The primitive renders what
`groups` contains, exposes `onLoadMore` with a sentinel and
`data-loading-more`, and keeps DOM order stable so a consumer's windowing
wrapper composes over it; the normalised store already makes appends and
per-row updates O(1), so deferring costs rendering, not state. **Falsified if**
a captured account shows hundreds of rows in an unpaginated sidebar — then
windowing becomes a built-in opt-in, matching whatever the transcript decides.

## 5. Target-behavior summary

| Choice | Target behavior | Tag | Deciding criteria |
|---|---|---|---|
| List host | `SessionList` is host-agnostic: listbox semantics and grouping, zero width/placement/chrome | `[adjusted]` | Headless fit; convention strength |
| Secondary line | One region resolved status → preview → relative time, surfaced as `data-secondary` and in the accessible description | `[observed-default]` | UX heuristics (system status); accessibility |
| Timestamps | `<time dateTime>` plus a `formatTime` hook; relative by default, time-of-day inside date-labeled groups | `[adjusted]` | Accessibility; portability |
| Search | One `SessionSearch` combobox, `data-variant="inline \| modal"`, incremental-only, renders results with an empty query | `[observed-default]` | Convention strength; ergonomics |
| Grouping | Pre-grouped `groups` rendered in order, `role="group"` + `aria-label`; library never sorts; `bucketByRecency` exported but unapplied | `[observed-default]` | Headless fit; ergonomics |
| New-session entry | Pinned `header` slot outside the scroll container; no creation button or event in the library | `[observed-default]` | Convention strength; headless fit |
| Workspace switcher | Not a primitive — a `Select`/menu recipe with active-first + `aria-checked` | `[adjusted]` | Headless fit (D10); corrected convention strength |
| Sidebar collapse | Controlled `collapsed` state, identical DOM in both states, labels stay in the a11y tree, no persistence, no rail CSS | `[adjusted]` | Accessibility (veto); portability |
| Command palette | No primitive in v1; factor the shared combobox, let `SessionSearch` take an actions group, ship Cmd-K as a recipe | `[extrapolation]` | Convention strength (0/4); ergonomics |

All nine compose with D11's separate session model (every row-level divergence
is a `SessionMeta` field or a slot), with D10's split (three of the spec's five
proposed primitives survive; two become recipes), and with the headless
`data-*` contract — no recommendation prescribes layout.

## 6. Gaps and extrapolations

- **Collapsed sidebar — 0 frames.** Toggles are observed, the collapsed state
  never is (correction 3). `[extrapolation]` Same DOM, `data-state`, labels
  preserved. *Falsified if* a capture shows a rail that drops nav items rather
  than reducing them — then collapse is a content decision and needs a
  `collapsedItems` slot.
- **Search-as-you-type — unprovable from stills.** The real evidence is the
  absence of a submit control in both overlays; per-keystroke updating and
  debounce windows are `[inferred]`, and the "N found" live region has no
  corpus support (correction 4). `[extrapolation]` Announce result counts
  politely anyway. *Falsified if* a capture shows a search surface with a
  submit button.
- **Hover-revealed row actions.** Overflow `…` and per-row controls appear in
  Devin 40, Manus 171, and Lovable 187, but stills cannot prove what is
  hover-gated; the star on Manus 171 is painted at rest, so *set* state is
  persistent. `[inferred]` Actions stay in the DOM and reveal on hover **or**
  `focus-visible`, as transcript.md §3.3 resolved for message actions.
- **Rename, archive, delete.** Overflow menus are visible, their contents never
  are — hence the generic `onAction(action: string)`; destructive confirmation
  is already decided in platform.md.
- **Unread semantics.** The dot is observed (Devin, trailing edge, three of six
  rows); clearing on open is `[inferred]`. The library never mutates `unread`.
- **Mobile and responsive.** All 1,262 frames are desktop web. Drawers, touch
  targets, and swipe actions are unobserved; the collapse API is the only
  affordance that could serve a drawer and was not designed for one.
- **Cross-workspace search.** Unobserved. `SessionSearch` is scoped to the
  `results` the consumer passes; after §3.7 the library has no workspace
  concept at all.
- **Scale.** The longest observed session list is six rows and none paginates,
  so every claim in §4.3 is extrapolated from the data model's shape.
- **Cofounder stays structurally unlike the other three** — top-bar switcher
  and breadcrumb, top-right tabs, a right-aside task panel with bulk select,
  no sidebar list, no sidebar search. The recommendations survive it only
  because §3.1 and §3.6 removed the sidebar assumption.
