# Domain specifications

Five domain specs synthesized from the labelled corpus (1,262 screens, four
products). Each contains an inventory with honest counts, an interaction contract
with rules tagged `[observed]`/`[inferred]`, a headless API sketch consistent with
`../ARCHITECTURE.md`, variants/states, gaps, and reference screenshots.

| Spec | Domain | Screens analysed | Headline findings |
|---|---|---:|---|
| `composer.md` | Message entry | 211 | Three placements (docked, hero, right-rail); send→stop morph observed; attachment lifecycle with progress; zero char counters or draft persistence anywhere |
| `transcript.md` | Message rendering | 414 | User right-aligned bubbles everywhere except Devin; reasoning blocks double as pending indicators; `message_branch_switcher` absent corpus-wide despite universal edit |
| `agent-execution.md` | Plans, tools, runs | 205 | Plan checklists are transcript-native and 4/4 universal; approval is an inline event; interrupt preserves partial output; no new core part types needed |
| `navigation.md` | Sessions & wayfinding | 694 | Vocabulary diverges (session/project/task) — library uses neutral `SessionList`; `command_palette` count is zero, spec is extrapolation |
| `platform.md` | Settings, integrations, overlays | 325 | Only overlay/form primitives belong in the library; settings pages are reference recipes, not API |

## What these specs resolved

- **Architecture open question 3 (agent surfaces)** — resolved in
  `agent-execution.md`: keep execution primitives in the chat packages, no
  `@aicl/agent` in v1. See DECISIONS.md D9.
- **Platform scope** — resolved in `platform.md`: ship primitives only. See
  DECISIONS.md D10.
- **Session metadata model** — `navigation.md` identified that `ChatState` has no
  session-list concept and proposed `SessionMeta`/`SessionGroup`. See
  DECISIONS.md D11.

## Reading the counts

Label counts are a floor, not a census. The labeler under-detects components
docked in narrow right rails and small chrome inside dense screens, and
`settings_appearance` was over-applied. Every spec annotates where its numbers
are known to under-read. Decisions in this repo rely on **product spread**
(how many of the four products show a component), which is robust to
under-counting, rather than on exact screen counts.

## Corrected by the evaluations

The comparative evaluations in `../evaluation/` re-derived the counts and
supersede these specs where the evidence changed:

- The composer is far more prevalent than labelled: **431 screens by OCR
  geometry versus 98 labelled** (383 docked, 48 hero). Manus's "4/4" chips are
  a step-progress rollup, not attachment progress; no product shows attachment
  progress anywhere.
- Devin's transcripts are labelled after all (46 screens, not 0).
- `date_separator` is mostly over-detection (chart axes, billing dates);
  verified separators exist only in Lovable and Manus.
- `rating_prompt` is Manus-only; Lovable's labels caught the model's own
  rating prose.
- Lovable renders no tool-call cards; it shows outcome rollups
  ("2 edits made / Show all") instead.
- The `cost_tokens_meter` labels were withdrawn as uncorroborated.
- `session_list_item` is **3/4, not 4/4** — Cofounder's three labels are mislabels (a draft-post editor, a content-calendar modal, a billing history).
- No frame shows a collapsed sidebar — collapse toggles are `[observed]`, the icon rail is `[inferred]`.
- Lovable 258 is the user-card menu open, not the workspace switcher; the switcher-open frame is Lovable 245.
- No "N found" counts or search filter pills exist anywhere — only empty states ("No public projects found", "No events found").
- Lovable does not date-group search results — those hits are calendar widgets in generated app previews; the corpus's only date-grouped session list is Manus 165.
- `session_search` is 3/4 observed, not 2/4 labelled — Manus 165's search overlay carries no `session_search` or `modal` label.
- Devin session rows carry one secondary line (status or relative time), not stacked fields.
- 30 of the 40 `tab_bar` frames are Devin automation editors — no product switches sessions with tabs.

Where a domain spec and an evaluation disagree, the evaluation wins.
