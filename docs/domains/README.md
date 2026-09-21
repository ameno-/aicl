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
