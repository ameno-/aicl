# Domain spec: Navigation & session history

Sidebars, session/task/project lists, search, command palettes, workspace switchers,
breadcrumbs, tabs, template galleries, and workspace home.

Evidence: `_corpus/labels/*.json` (1,262 labelled screenshots), filtered to frames whose
`components` include `sidebar_nav`, `session_list_item`, `session_search`,
`workspace_switcher`, `breadcrumb`, or `tab_bar`, or whose `screen_archetype` is
`workspace_home`, `session_list`, `template_gallery`, `search_results`, or
`command_palette`. 694 frames matched (~55% of the corpus). Counts below are exact
label counts, not estimates.

## Inventory

### Component frequency and product spread

| Component | Frames | Cofounder | Devin | Lovable | Manus |
|---|---:|---|---|---|---|
| `sidebar_nav` | 315 | yes | yes | yes | yes |
| `workspace_switcher` | 205 | yes | yes | yes | yes |
| `session_list_item` | 118 | yes | yes | yes | yes |
| `tab_bar` | 40 | yes | yes | yes | yes |
| `session_search` | 26 | no | yes | yes | no |
| `breadcrumb` | 26 | yes | yes | yes | no |
| `command_palette` | 0 | — | — | — | — |

`screen_archetype` distribution within the matched set is dominated by
`workspace_home` (383 frames, all four products). `session_list` appears only once
(Cofounder) as a standalone archetype — in practice the session list lives *inside*
the sidebar on `workspace_home` and chat frames, not on its own screen.
`template_gallery` appears 10 times (Lovable, Manus). `search_results` and
`command_palette` never appear as archetypes: search is a sidebar field (Lovable) or
a modal overlay (Lovable "Search projects"), and no product in the corpus ships a
visible command palette.

### Shell layout

Matched frames: `sidebar_main_aside` 450, `sidebar_main` 236, `centered_column` 5,
`marketing_page` 3. The sidebar + main (+ optional right aside) shell is effectively
universal; navigation components must assume a sidebar host but tolerate its absence.

### Per-product vocabulary for the same concepts

Quantified from `notes`, `flow_name`, and `primary_action` text on session-list and
workspace-home frames (substring counts, one frame may hit multiple terms):

| Concept | Cofounder | Devin | Lovable | Manus |
|---|---|---|---|---|
| Unit of work | "task" (51 task / 39 tasks) | "session" (52 session / 18 sessions) | "project" (49 project / 25 projects) | "task" (40 task / 23 tasks) |
| Container | "workspace" (49) | "workspace" (15, e.g. `samllemobbin-dot`) | "workspace" (46, e.g. "Samlee's Lovable") | "workspace" (33) |
| History | "history" (4) | "history" (12), "Recent" heading | date groups ("Today", "May 2025") | "All tasks" list |

Observed UI strings, directly from screenshots:

- **Devin**: sidebar header "Sessions"; nav items Ask / Automations / Review / Wiki;
  "Recent" list with per-item search icon, `+`, and `…`; workspace switcher at
  top-left showing org slug; item anatomy = title, status line (`PR is ready · ⎇1`,
  `Working · ⎇1`), relative timestamp ("1 hour ago", "4 days ago"), blue unread dot.
- **Lovable**: switcher "Samlee's Lovable" (dropdown with active-workspace checkmark
  and "Create workspace"); nav Home / Search; grouped sections "Projects" (All
  projects, Starred, Shared with me) and "Resources" (Discover, Templates, Learn);
  user-card footer with Settings/Appearance/Support/Sign out; search opens a modal
  ("Search projects", "2 projects found", filter pills, results with thumbnail,
  owner, relative date); workspace home has tab bar "Recently viewed / My projects /
  Shared with me / Templates".
- **Manus**: top-left brand + collapse toggle; primary actions "New task", "Search",
  "Library"; "Projects" section with `+` ("New project"); "All tasks" list with
  filter icon; task rows = icon + truncated title + optional star ("Holiday
  Destinations in 2025" starred); footer icon cluster.
- **Cofounder**: workspace switcher and breadcrumb ("AS Mobbin / Engineering") in a
  **top bar**, not the sidebar; right-side tab bar (Home / Cofounder / Company /
  Tasks / Library); projects shown as cards with preview thumbnails and status badge
  ("READY"); archive modal lists items with "Archived Jun 12" lines.

This is why the library uses neutral names — `SessionList`, not `TaskList` or
`ProjectList`. Three of four products call the same list something different.

### List item anatomy (observed)

Union of all four products: title (truncated with ellipsis), secondary status line
(Devin: PR/CI state; Manus: none), relative timestamp or archive date, status
indicator (Devin blue unread dot; Cofounder "READY" badge), thumbnail (Lovable
search results, Cofounder project cards), star/favorite toggle (Manus), hover
overflow menu `…` (Devin, Manus, Lovable), checkbox for bulk select (Cofounder
Tasks panel: "Select all").

### Grouping, pinning, entry points

- Grouping: Devin groups by recency ("Recent"); Lovable search groups by date
  ("Today", "May 2025"); Manus groups tasks under Projects. Date-grouped headers
  are the common pattern; none of the products groups sessions by project in the
  sidebar list itself (project is a filter/parent, not a group header).
- Pinning/starring: Manus stars tasks in-list; Lovable has a "Starred" nav section.
  Pin-first-then-recency ordering is the implied sort.
- Search placement: top of sidebar as a nav item that opens a modal (Lovable),
  inline icon within the list header (Devin's per-section search icon), top-level
  sidebar entry (Manus "Search"). Cofounder: top-bar search icon.
- Workspace switcher location: top-left of sidebar in Devin, Lovable, Manus (brand
  row); top-left of the top bar in Cofounder. Always the first interactive element
  in its container.
- Collapse behavior: every product has a collapse toggle (Manus top-right of
  sidebar and bottom footer icon; Lovable top-right panel icon; Devin top-right
  icon). Collapsed state shows icon-only rail (Lovable 258 shows icon rail with the
  same items).
- "New" entry points: Manus "New task" as the first sidebar row; Devin `+` in the
  Recent header; Lovable composer on workspace home ("What should we build?");
  Cofounder "+ New Agent" and per-section `+` buttons. A new-session affordance
  lives both in the list header and on workspace home.

## Interaction contract

Rules marked [observed] are visible in at least one screenshot; [inferred] are
consistent with observation but not directly provable from stills.

1. **Active-session highlighting** [observed]: the open session's row is visually
   distinct in the list (Devin 40: active row has selected background). Exactly one
   item is active at a time; switching sessions moves the highlight, not just the
   main pane.
2. **Unread/activity indicator** [observed]: sessions with new agent activity carry
   a dot (Devin blue dot) independent of selection; the dot clears on open
   [inferred].
3. **Live status in the row** [observed]: running sessions show a status line
   ("Working · ⎇1") that updates without opening the session. The list item must
   accept a reactive status slot, not static text.
4. **List virtualization** [inferred]: session lists are unbounded (Devin shows
   pagination-adjacent "4 of 6" onboarding but the Recent list itself scrolls;
   real accounts accumulate hundreds of sessions). Primitives must not assume
   full-DOM rendering; same open question as transcript virtualization in
   ARCHITECTURE.md.
5. **Search-as-you-type** [observed]: Lovable's modal updates results and a count
   ("2 projects found") per keystroke — no submit affordance. Debounced
   incremental search is the contract; a submit-based mode is out of scope.
6. **Keyboard navigation in palettes/menus** [inferred]: no command palette exists
   in the corpus, but Devin's `@repo` mention combobox (arrow-key list with active
   row, screenshot 28) and Lovable's search modal establish the listbox pattern:
   ArrowUp/Down move active option, Enter selects, Esc closes, typeahead refines.
   CommandPalette reuses this contract.
7. **Collapsible sidebar persistence** [inferred]: collapse toggles exist in all
   four products; collapse state must be controllable and persistable by the
   consumer (the library exposes `collapsed` + `onCollapsedChange`, storage is the
   app's job, consistent with "no persistence" non-goal).
8. **Hover-revealed actions** [observed]: overflow `…`, star, and per-item search
   appear on hover/focus (Devin, Manus, Lovable). Keyboard focus must reveal the
   same actions [inferred from a11y basics].
9. **New-session entry is always visible** [observed]: "New task"/`+` is pinned in
   the sidebar chrome, not scrolled with the list.
10. **Starred items sort first / get their own section** [observed]: Lovable
    "Starred" nav section, Manus in-list star. The primitive takes a comparator or
    pre-sorted groups; it does not impose a sort.

## Component API sketch

Consistent with ARCHITECTURE.md: headless primitives own DOM structure, ARIA, focus,
and keyboard; state exposed via `data-*`; no CSS shipped.

**Where session metadata lives.** `packages/core/src/types.ts` models a conversation
as `Message`/`MessageNode` + `ChatState` — there is deliberately no `Conversation`
or `Session` type (verified: no such interface). Session metadata (title, updatedAt,
status, starred, unread) is a *list-model* concern, not a transcript concern.
Recommendation: add a `SessionMeta` type in `@aicl/core` alongside (not inside) the
conversation model, and keep it out of `ChatState`:

```ts
// @aicl/core — new, sibling to the conversation model
interface SessionMeta {
  id: string;
  title: string;                 // consumer-generated; library never derives it
  createdAt?: number;
  updatedAt?: number;
  status?: 'idle' | 'running' | 'awaiting-input' | 'error' | `data-${string}`;
  starred?: boolean;
  unread?: boolean;
  preview?: string;              // secondary line (Devin's "PR is ready · ⎇1")
  metadata?: Record<string, unknown>; // extension point, mirrors Message.metadata
}

interface SessionGroup {
  id: string;                    // e.g. 'starred', 'today', 'older'
  label?: string;
  sessions: SessionMeta[];
}
```

A `SessionStore` (same `ReadableStore` contract as the transcript store) holds a
normalised map + id array per group. Navigation primitives consume it; the
transcript never does. This keeps the core rule intact: components are driven by
stores, transports do I/O, and the session list works against an in-memory mock.

### Primitives

```ts
<SidebarNav
  sections: NavSection[]            // { id, label?, items: NavItem[], collapsible? }
  collapsed?: boolean               // controlled
  defaultCollapsed?: boolean        // uncontrolled
  onCollapsedChange?: (v: boolean) => void
  activeId?: string
  onSelect?: (id: string) => void
/>
```
- `role="navigation"`; expanded/collapsed via `data-state="expanded|collapsed"`.
- Collapsed mode renders icon-only rail; labels become tooltips [observed in
  Lovable 258].
- Sections render as `aria-labelledby` groups; section headers may carry trailing
  actions (`+`, filter icon) via a slot.

```ts
<SessionList
  groups: SessionGroup[]            // pre-grouped; library does not sort
  activeId?: string
  virtualized?: boolean             // default true over a threshold
  onSelect: (id: string) => void
  onLoadMore?: () => void           // infinite scroll sentinel
>
  <SessionListItem
    session: SessionMeta
    active?: boolean
    onStar?: (starred: boolean) => void
    onAction?: (action: string) => void   // overflow menu: rename/archive/delete
  />
</SessionList>
```
- `role="listbox"` with `aria-activedescendant`; items `role="option"`,
  `aria-selected` on the active session.
- Item anatomy is slotted: title, preview/status line, timestamp, badge/dot,
  thumbnail, hover actions. `data-status`, `data-unread`, `data-starred`,
  `data-active` on the row.
- Hover actions must also appear on `focus-visible` (contract rule 8).

```ts
<SessionSearch
  value?: string
  onChange: (q: string) => void     // debounced by consumer or via `debounceMs`
  results: SessionGroup[]           // consumer filters; library renders
  resultCount?: number              // for "N projects found" live region
  open?: boolean
  onOpenChange?: (v: boolean) => void
/>
```
- Search-as-you-type only (contract rule 5); renders in place or as a modal
  (`data-variant="inline|modal"`); modal is `role="dialog"` containing a
  `role="listbox"`.

```ts
<WorkspaceSwitcher
  workspaces: { id: string; name: string; icon?: unknown }[]
  activeId: string
  onSelect: (id: string) => void
  onCreate?: () => void             // renders "Create workspace" row
/>
```
- Button + listbox popup; active workspace gets `aria-checked` / checkmark
  [observed in Lovable 258]. Mounts at the top of `SidebarNav` or a top bar —
  placement is the consumer's layout choice (Cofounder top-bar case).

```ts
<CommandPalette
  open: boolean
  onOpenChange: (v: boolean) => void
  sources: CommandSource[]          // sessions, actions, workspaces
  onSelect: (cmd: Command) => void
  shortcut?: string                 // consumer binds, e.g. cmd-k
/>
```
- No corpus evidence in any product — ship as the same combobox contract as
  `SlashMenu`/`MentionMenu` (already specified in ARCHITECTURE.md), not as a new
  interaction model. Consider deferring to a later minor release (see Gaps).

Also observed but out of scope for v1 primitives: `Breadcrumb` (26 frames; a plain
`nav` + `ol` is sufficient — document a recipe, not a component) and `TabBar`
(40 frames; use the platform/consumer's tabs with `aria-selected`; Cofounder's
right-panel tabs and Lovable's home tabs are layout-specific).

## Variants & states

- **SidebarNav**: expanded / collapsed(icon rail); section expanded / collapsed
  (Lovable "Projects" chevron); mobile overlay drawer [inferred — corpus is
  desktop-only].
- **SessionListItem**: default, active, hover/focus (reveals actions), unread
  (dot), running (live status line, possibly animated), starred, archived
  (muted, "Archived Jun 12" — Cofounder), skeleton loading.
- **SessionList**: grouped by recency headers, flat, empty state, loading-more
  sentinel.
- **SessionSearch**: closed (nav row), open inline, open modal; with-results,
  empty-results, result-count announcement.
- **WorkspaceSwitcher**: single-workspace (renders static label), multi with
  active checkmark, with-create action.
- **Workspace home**: composer-first (Lovable "What should we build?"), card
  gallery (Cofounder projects, Manus Library), tab-filtered (Lovable). The library
  ships no WorkspaceHome component — it is composition of Composer + SessionList +
  TabBar recipe.

## Gaps

1. **No command palette anywhere in 1,262 frames.** `command_palette` count is 0.
   Specifying `CommandPalette` is extrapolation from industry convention, not
   corpus evidence; mark it experimental or defer.
2. **No mobile/responsive frames.** All screenshots are desktop web; drawer and
   touch behavior is unobserved.
3. **Search ranking is invisible.** Incremental filtering is observed, but match
   highlighting, fuzzy ranking, and recency weighting cannot be confirmed from
   stills — left to the consumer's filter function.
4. **Cofounder is structurally different** (top-bar switcher, right-panel tabs, no
   sidebar search). The primitives tolerate this via composition, but the "sidebar
   is the nav host" assumption covers only 3 of 4 products' primary pattern.
5. **Rename/inline-edit of session titles** never appears in the corpus; overflow
   menus are visible but their contents are not captured. The `onAction` event is
   generic for this reason.
6. **Cross-workspace session search** is unobserved; scope of `SessionSearch` is
   the active workspace only [inferred].

## Reference screenshots

- `Devin web Aug 2026 (1)/Devin web Aug 2026 40.png` — sidebar anatomy: switcher,
  Sessions nav, Recent list with status lines, unread dots, timestamps; active-row
  highlight.
- `Devin web Aug 2026 (1)/Devin web Aug 2026 28.png` — `@repo` combobox keyboard
  pattern; Recent list header with search/`+`/`…`.
- `Lovable web Jan 2026/Lovable web Jan 2026 187.png` — search modal with recent
  projects, thumbnails, relative dates.
- `Lovable web Jan 2026/Lovable web Jan 2026 18.png` — full sidebar: switcher,
  grouped sections, footer user card; home tab bar.
- `Lovable web Jan 2026/Lovable web Jan 2026 258.png` — workspace switcher open
  with active checkmark + "Create workspace"; settings submenu.
- `Manus web Mar 2026/Manus web Mar 2026 171.png` — New task / Search / Library
  rows, Projects section with `+`, All tasks with starred item, collapse toggles.
- `Manus web Mar 2026/Manus web Mar 2026 170.png` — Library filter dropdown;
  task-star in list.
- `Cofounder web Aug 2026/Cofounder web Aug 2026 232.png` — top-bar switcher +
  breadcrumb, right-panel tab bar, project card with status badge.
- `Cofounder web Aug 2026/Cofounder web Aug 2026 99.png` — archive modal: archived
  item state with dates.
