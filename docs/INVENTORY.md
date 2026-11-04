# The inventory

A deep inventory of what LooseLeaf and Fluid Functionalism offer, what AICL
has, and where the shapes differ.

Everything below was extracted from the two projects' `registry.json` files
rather than from their documentation sites, so the counts and the file
lists are what the registries actually contain.

**What this document is for.** It is the reference for the plan in
[`ROADMAP.md`](ROADMAP.md): what to create, what to expose, and what to
refactor so AICL's own components carry the shapes these two libraries
established.

---

## 1. The numbers

| | LooseLeaf | Fluid Functionalism | AICL |
|---|---|---|---|
| Registry items | **213** | **83** | 0 (not published) |
| Components | 123 | 49 (25 base + 24 radix) | 18 primitives |
| Blocks | 62 | 7 | 0 |
| Libraries / systems | 19 | 17 | 2 (`motion`, the contract) |
| Hooks | 5 | 5 | 4 |
| Themes / tokens | 2 + 1 style + 1 font | 2 | 1 contract + 1 skin |
| Icons | 160 (drawn) | 4 icon packs | 1 (Lucide) |

---

## 2. LooseLeaf

`registry.json`: 123 `registry:ui`, 62 `registry:block`, 19 `registry:lib`,
5 `registry:hook`, 2 `registry:theme`, 1 `registry:style`, 1 `registry:font`.

### 2.1 The AI-chat components

The six that matter for AICL, and what each one is:

| Component | Shape | Notes |
|---|---|---|
| `message` | compound: `MessageGroup`, `Message`, `MessageAvatar`, `MessageContent`, `MessageHeader`, `MessageFooter`, `MessageText` | A bubble with a header, an avatar, a content slot and a footer. **No streaming, no parts.** |
| `message-scroller` | provider + `MessageScroller`, `MessageScrollerViewport`, `MessageScrollerContent`, `MessageScrollerItem`, `MessageScrollerButton` | Built on a `message-scroller-primitive` lib. Owns stick-to-bottom. |
| `prompt-input` | compound: `PromptInput`, `PromptInputBody`, `PromptInputTextarea`, `PromptInputFooter`, `PromptInputTools`, `PromptInputButton`, `PromptInputSubmit`, `PromptInputAttachments`, `PromptInputSuggestions`, `PromptInputSuggestion`, `PromptInputHint` | The composer, modelled as slots. `PromptInputStatus = "ready" \| "submitted" \| "streaming" \| "error"` — the same four states AICL uses. |
| `typing-indicator` | single | |
| `typewriter` | single | |
| `attachment` | single | |
| `code-block` | single | |

### 2.2 The canvas components

This is the family that makes LooseLeaf distinctive, and the one the
sketchpad belongs to.

| Component | What it is |
|---|---|
| `sketchpad` | A drawing surface. 983 lines. Six tools (felt, brush, pencil, marker, highlighter, eraser), ten colours, three sizes, undo/redo/clear, stroke replay, palm rejection, point thinning, export to SVG/PNG. |
| `signature-pad` | The same engine, narrowed to one stroke and one purpose. |
| `corkboard` | A pinboard surface. |
| `sticker-board` | A surface you drop stickers on. |
| `sticker-picker`, `sticker-sheet`, `sticker` | The sticker system: choose, lay out, place. |
| `page`, `paper`, `notebook`, `napkin`, `index-card`, `polaroid`, `receipt`, `ticket`, `seal`, `stamp`, `stamp-button`, `tape`, `ribbon`, `envelope`, `folder`, `label-tag`, `peel-corner`, `tear-off` | The **paper objects**. A family of surfaces that share one base. |

### 2.3 The drawing primitives

`doodle`, `scribble`, `squiggle`, `strike`, `underline`, `highlight`,
`handwritten`, `marker`, `lettering`, `asterisk`, `bracket`, `circled`,
`direction`, `arrow`, `flip-card`, `boil`, `marquee`, `reveal`, `confetti`,
`tally`, `bubble`, `callout`, `quote`, `bookmark`, `rating`, `item`.

Each is a **seeded TypeScript function** that writes SVG. The same seed
draws the same line on the server and in the browser. States are CSS.

### 2.4 The generic components

61 of the 123, grouped by what they are:

**Overlays** — `dialog`, `alert-dialog`, `drawer`, `sheet`, `popover`,
`hover-card`, `context-menu`, `dropdown-menu`, `menubar`, `navigation-menu`,
`tooltip`, `command`.

**Form** — `input`, `textarea`, `input-group`, `input-otp`, `native-select`,
`checkbox`, `radio-group`, `switch`, `toggle`, `toggle-group`, `slider`,
`select`, `combobox`, `date-picker`, `calendar`, `field`, `form`,
`dropzone`, `label`, `label-tag`, `signature-pad`.

**Layout & content** — `card`, `card-group`, `tabs`, `accordion`,
`collapsible`, `table`, `resizable`, `scroll-area`, `sidebar`, `separator`,
`aspect-ratio`, `chart`, `carousel`, `stepper`, `empty`, `breadcrumb`,
`pagination`, `progress`, `skeleton`, `badge`, `avatar`, `button`,
`button-group`, `kbd`, `typography`, `alert`, `alert-dialog`, `sonner`,
`spinner`, `icon`, `aspect-ratio`, `clipboard`, `boil`.

### 2.5 The blocks

62, in four families:

- **Marketing** — `landing-hero-01/02`, `cta-01`, `features-01`, `faq-01`,
  `pricing-01`, `testimonials-01`, `footer-01`, `logos-01`, `newsletter-01`.
- **Auth** — `login-01..05`, `signup-01..05`, `forgot-password-01`,
  `reset-password-01`, `otp-01`.
- **App shells** — `chat-app`, `notes-app`, `inbox`, `file-explorer`,
  `kanban-board`, `calendar-planner`, `dashboard-01`,
  `dashboard-analytics`, `dashboard-finance`, `checkout-01`,
  `announcement-bar`, `error-404`, `error-500`, `empty-inbox`, `empty-search`,
  `onboarding-01`, `profile-page`, `settings-appearance`, `settings-billing`,
  `settings-notifications`, `settings-profile`.
- **Sidebars** — `sidebar-01` through `sidebar-16`, plus `sidebar-shared`.

### 2.6 The systems

19 libs, and the split is the interesting part:

| Lib | What it is |
|---|---|
| `ink`, `ink-art`, `ink-doodles`, `ink-icons`, `ink-mascots`, `ink-paper`, `ink-paper-textures`, `ink-props`, `ink-recipes`, `ink-scenes`, `ink-stickers`, `ink-grain-textures` | **The art layer.** Twelve libs, one concern: every drawn thing. |
| `chat-align`, `message-scroller-primitive`, `code-highlight`, `field-class`, `menu-styles`, `sketch-export`, `utils` | The behavioural helpers. |

Five hooks: `use-form-reset`, `use-live-motion`, `use-mark-ink`,
`use-mobile`, `use-paper-object`.

**The `x.tsx` + `x-ink.ts` pairing is LooseLeaf's structural signature.**
Roughly 70 of the 123 components ship a second file whose only job is to
draw them. The DOM and the drawing never mix.

---

## 3. Fluid Functionalism

`registry.json`: 49 `registry:ui`, 7 `registry:block`, 17 `registry:lib`,
5 `registry:hook`, 3 `registry:item`, 2 `registry:theme`.

### 3.1 The components

25 components, each shipped twice — once on Radix (the bare name) and once
on Base UI (`base/` prefix) — with the same API:

`accordion`, `ask-user-questions`, `badge`, `banner`, `button`,
`carousel-dots`, `chat-message`, `checkbox-group`, `color-picker`,
`command-menu`, `combobox`, `date-picker`, `dialog`, `dropdown`,
`file-thumbnail`, `input-copy`, `input-group`, `input-message`, `radio-group`,
`scroll-area`, `select`, `slider`, `switch`, `table`, `tabs`, `tabs`,
`thinking-indicator`, `thinking-steps`, `tooltip`.

**The AI-chat components**, and their shapes:

| Component | Shape | Notes |
|---|---|---|
| `chat-message` | flat | `from: "user" \| "assistant"`, `files`, `thumbnailSize`, `time`, `actions`, `size`. The actions and the timestamp live in a **hover-revealed meta row**. |
| `input-message` | flat with slots | `value`/`onValueChange`, `onSend(value, files, meta)`, `leftSlot`/`rightSlot` (each a render prop), `files`/`onFilesChange`, `accept`, `maxFiles`, `filePreviewSize`, `textareaProps`, `clickToFocus`, `minRows`/`maxRows`, `sendLabel`, `size`. **The send button becomes a Stop control while streaming, or a Queue action when the draft is non-empty.** |
| `thinking-steps` | flat | A collapsible chain of thought, with a sequential animation. |
| `thinking-indicator` | flat | An animated status indicator with a morphing SVG and cycling text. |
| `ask-user-questions` | flat | A **structured question flow**: `AskUserQuestion[]`, `AskUserOption`, `AskUserAnswer`. Single or multi select, an inline "other" input, skip, multi-question navigation. |
| `file-thumbnail` | flat | PDF first-page rendering via `pdfjs-dist`. |
| `command-menu` | compound | `CommandMenu`, `CommandMenuInput`, `CommandMenuTabs`, `CommandMenuFilters`, `CommandMenuList`, `CommandMenuEmpty`, plus `parseShortcut`, `matchesShortcut`, `formatShortcut`, `useIsMac`, `defaultCommandMenuFilter`, `sectionRows`. |
| `banner` | compound | `Banner`, `BannerTitle`, `BannerDescription`, `BannerActions`, `BannerAction`, plus an exported `bannerMotion` config. |

### 3.2 The systems

17 libs, and they are the reason Fluid's library holds together:

| Lib | What it is |
|---|---|
| `springs` | The three spring tiers, as Motion presets. |
| `font-weight` | Inter's `wght`/`opsz` pairs. |
| `surface-context`, `surface-classes`, `elevated` | The eight-level elevation ladder, with the level re-provided to descendants. |
| `size-context` | The two-step size ladder: control height, type, padding, gap and icon, together. |
| `shape-context` | A runtime shape variant (pill or rounded). |
| `icon-context` | Named icon slots with a Lucide default set. |
| `icons-tabler`, `icons-phosphor`, `icons-hugeicons`, `icons-untitledui` | Four alternative icon packs. |
| `fluid-provider` | One wrapper for the whole system: reduced motion, radius, size. |
| `popup` | Shared popup chrome for dropdown, select and combobox. |
| `sidebar-menu-grid` | Shared popup geometry for sidebar-anchored menus. |
| `use-merge-split` | The selected-background merge/split animation. |
| `omit`, `utils` | The small ones. |

Five hooks: `use-fluid-hover`, `use-fluid-hover-standard`, `use-touch-primary`,
`use-keyboard-nav-gate`, `use-merge-split`.

Three items: `type-scale`, `typography`, `reveal`. Two themes: `surfaces`,
`tokens`.

### 3.3 The blocks

Seven, and each declares the components it needs:

| Block | Depends on |
|---|---|
| `sidebar-app` | sidebar, sidebar-workspace-header, sidebar-user-footer, sidebar-search-field, sidebar-inset-topbar, dropdown, tooltip, utils, and four systems |
| `dialog-sidebar` | dialog, sidebar, scroll-area, button, switch, select, input-group, tooltip, font-weight, icon-context, size-context, type-scale |
| `queued-stack` | input-message, file-thumbnail, tooltip, springs, shape-context, size-context, icon-context, type-scale |
| `sidebar-workspace-header` | sidebar, dropdown, sidebar-menu-grid, type-scale, three systems |
| `sidebar-user-footer` | sidebar, dropdown, sidebar-menu-grid, type-scale, two systems |
| `sidebar-search-field` | sidebar, type-scale, size-context, icon-context |
| `sidebar-inset-topbar` | sidebar, utils |

`queued-stack` is the one AICL should study hardest: **a block that is one
component's worth of behaviour** — messages queued while a turn streams,
fanning out on hover, reordering by drag, and morphing into the sent
message.

---

## 4. The shapes

The thing both libraries actually agree on is not a component list. It is a
set of **shapes** — the ways a component's API can be built. This is the
vocabulary the plan is written in.

| # | Shape | LooseLeaf | Fluid | AICL today |
|---|---|---|---|---|
| **S1** | Flat primitive | `Badge` | `Badge` | `PlanChecklist` |
| **S2** | Compound, named subparts | `Dialog.Title`, `PromptInput.Textarea` | `Banner.Title` | `Dialog.Title` only |
| **S3** | Provider + context hook | `MessageScroller` | `fluid-provider` | — |
| **S4** | Controlled **and** uncontrolled | every input | every input | `Composer` only |
| **S5** | Imperative handle (`apiRef`) | `Sketchpad` | — | `ComposerHandle` (a ref) |
| **S6** | Render-prop slots | `leftSlot` / `rightSlot` | `slot` props | `Composer`'s `children` |
| **S7** | Slot DOM contract | `data-slot` | `data-slot` | `data-aicl` ✓ |
| **S8** | Size ladder | 3 densities | 2-step context | `data-aicl-density` ✓ |
| **S9** | Icon slot context | — | `icon-context` | ✓ (last change) |
| **S10** | Surface / elevation context | — | `surface-context` | shadow ladder (CSS only) |
| **S11** | Exported motion config | — | `bannerMotion` | `@aicl/motion` tokens |
| **S12** | Ink companion file | `x.tsx` + `x-ink.ts` | — | — |
| **S13** | Primitive → object family | `paper` → 18 paper objects | `shape-context` | — |
| **S14** | Block with a dependency manifest | 62 blocks | 7 blocks | — |
| **S15** | Preset | — | URL-encoded config | — |

**Where AICL is ahead:** S7 and S8. `data-aicl` is a *published, machine-
readable* contract with a drift test; LooseLeaf and Fluid both ride
shadcn's `data-slot` names, which are inherited rather than owned. The
density ladder is a CSS scope rather than a React context, so it works
across adapters.

**Where AICL is behind:** S2, S4, S5, S6, S10, S13, S14.

---

## 5. AICL today

The numbers in §1 are the snapshot this inventory was written from. The
live list — every sample component, and the decision about it — is
[`catalog/index.md`](catalog/index.md). One page per primitive AICL ships
is in [`components/`](components/).

### 5.1 The library primitives

The full list, with slots, states and motion, is in
[`components.md`](components.md). That page is generated from the contract,
so a name kept here would only drift.

### 5.2 What exists but is not in the library

**`@aicl/fx`** — 22 animated components, Tailwind-coupled:

- *stream*: `StreamingText`, `ThinkingIndicator`, `WorkSummary`,
  `ToolCallCard`, `AnimatedPlan`, `RollingNumber`, `LiveTerminal`,
  `StatusIsland`, `CodeBlock`, `BorderBeam`
- *input*: `PromptComposer`, `ModelPicker`, `SmoothDropdown`,
  `SuggestionStack`, `ApprovalCard`, `QuestionCard`, `Toaster`,
  `SegmentedTabs`, `CommandMenu`, `SidePanel`, `InlineEdit`, `Kbd`

**`apps/workspace/web/surfaces/`** — the seven live surfaces, and the most
distinctive thing AICL has:

`terminal`, `diff`, `file`, `browser`, `process`, `review`, `sideshow`.

**`apps/workspace/web/`** — `applets/` (agentic mini-apps), `agentic/`
(`hitl`, `live`, `toolRenderers`), `swarm/`, `kits/` (the theme system),
`Scratchpad.tsx`, `ChatPanel.tsx`, `agentSteps.tsx`, `graph.ts`,
`changes.ts`.

**`apps/workspace/web/kits/`** is a second, parallel theming system —
per-kit token sets applied as `--aicl-*` variables. It is the same idea as
`@aicl/styles/themes/`, arrived at separately.

### 5.3 The gap

The gap is no longer a table maintained by hand. A sample component AICL
has incorporated is in the catalog as `incorporated`, with a link to the
primitive. One AICL has not built, and that a chat app needs, is a
`candidate` with a roadmap wave. Marketing pages, paper toys and drawn art
are `out-of-scope`, on purpose, so they are not rediscovered as missing
buttons.

---

## 6. The sketchpad, and why it is the right example

The sketchpad is the best single component in either library, and it is not
because of drawing. It is because of its **shape**:

- A **headless core** with the drawing in a separate file — `sketchpad.tsx`
  and `sketchpad-ink.ts` never mix.
- **Controlled and uncontrolled** at once (`value` / `defaultValue` /
  `onValueChange`).
- **Compound**: the root, a canvas, a toolbar, and named tool / colour /
  size groups, plus undo, redo and clear as their own components.
- **An imperative handle** (`apiRef`) for undo, redo, clear, replay,
  strokes, and export to SVG, PNG or a data URL.
- **A context hook** (`useSketchpad()`) so a custom toolbar can read the
  state.
- **A model, not a picture**: six tools, ten colours, three sizes, each
  named and each swappable.

AICL's equivalent of the sketchpad is not a drawing surface. It is the
**live surface**: the terminal, the diff, the file view, the browser, the
process list, the review surface, the sideshow. Those are AICL's most
distinctive capability, they are the thing neither reference library has,
and they currently live in `apps/workspace` with no contract at all.

**That is the shape to aim for**: a *surface* contract — compound,
controlled, with an imperative handle and a named model — that the
workspace surfaces conform to, so a consumer can build their own.

---

## Appendix: how to reproduce this inventory

```bash
git clone --depth 1 https://github.com/kevintngo/looseleaf.git
git clone --depth 1 https://github.com/mickadesign/fluid-functionalism.git

python3 -c "
import json, collections
for repo in ['looseleaf', 'fluid-functionalism']:
    items = json.load(open(f'{repo}/registry.json'))['items']
    print(repo, len(items), collections.Counter(i['type'] for i in items))
"
```

Both registries are the source of truth. Their documentation sites describe
a subset; the registries are the whole catalogue.
