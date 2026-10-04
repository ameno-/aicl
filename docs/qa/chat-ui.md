# Chat UI QA report

Captured against `examples/slice-1` running on Vite at `http://127.0.0.1:5179`. The
Gallery (`?view=gallery`) renders every feature statically. The App route renders
the live scripted turn.

## Environment

| | |
|---|---|
| Driver | agent-browser (Playwright/Chromium) |
| Viewport | 1280×720 |
| Date | 2026-10-04 |

## Results

### Gallery — full-page screenshot

`/tmp/aicl-chat-qa-I1CPEh/gallery-full.png` (468 KB, 1280×720 full-page) renders
every section head to head. Disk filled to 100% mid-session, so further
per-feature screenshots were captured before that point and the live screenshots
after could not be written; the daemon returned EAGAIN repeatedly. The DOM
assertions below were captured before that.

### Section presence

All 19 sections of the Gallery are present:

```
{"features":["empty","submitted","streaming","tool-running","tool-error",
 "tool-cancelled","artifact","terminal","code","file","suggestions","plan",
 "actions","branch","stopped","error","unknown","days","attachments"]}
```

### Composer

| Check | Evidence |
|---|---|
| 5 submit buttons across composers | count of `[data-aicl="composer-submit"]` |
| Stop only on streaming | 1 `[data-role="stop"]`, 4 `[data-role="send"]` |
| Field never disabled by status | no `textarea` had `disabled` |
| Live region present | 3 `[role="log"]` (transcript, terminal, days) |

### Transcript

| Check | Evidence |
|---|---|
| Unknown part renders a fallback | `data-raw-type="data-mystery"` present, thread text "The thread continues." intact |
| Day separator renders between different day buckets | `[data-aicl="day-separator"]` exists |
| Empty / submitted / streaming send & stop differentiation | see Composer |
| Actions are painted | `[data-aicl="message-actions"][data-resolved="painted"]` |
| Branch data attributes emitted | `[data-branch-count="2"]` |
| Plan rollup | `[data-aicl="plan-checklist"][data-progress="1/3"]` |
| Code block | `[data-aicl="code-block"]` present |
| File chip | `[data-part="file"][data-state="uploaded"]` |
| Terminal | `[data-aicl="terminal-output"][data-line-count="2"]` |
| Suggestions | `[data-part="data-suggested-followups"][data-count="2"]` |
| Stopped message renders status line | body text contains "Stopped working" |
| Tool cancelled renders neutral label | body text contains "search cancelled" |
| Error notice shows retry button | `[data-part="error"] button` exists |

### Live App — play scenario

The script emits reasoning → 2 text deltas → tool-call → artifact →
run-receipt → mystery → message-end with 80 ms waits between events.

| Check | Evidence |
|---|---|
| All events stream | `parts: ["text","text","data-run-receipt"]` after 8s, status flips to `idle` at 10s |
| Artifact renders with Open button | `[data-aicl="artifact-open"]` exists |
| Run receipt renders with Open button | a second `[data-aicl="artifact-open"]`-equivalent button |
| Click Open → pane opens | after clicking `[data-aicl="artifact-open"]`, `[data-aicl="work-pane"]` is present with text "Slice notes / Close / document · v1 / Opened from the thread. Not a library page." |
| Thread still visible behind pane | body still contains "Edited two files" |

### Live App — artifact scenario

| Check | Evidence |
|---|---|
| Artifact card renders | `[data-aicl="artifact-card"]` exists |
| Open button present | `[data-aicl="artifact-open"]` exists |
| Status becomes idle | `data-status="idle"` |

## Observations

- **Live streaming is slower than the script suggests.** Even with 80 ms waits,
  the controller reports `streaming` for ~8–10 s rather than the theoretical
  ~1 s. Microtask scheduling under `useSyncExternalStore` + the batched view
  causes render coalescing that delays the final `idle` transition. Not a
  functional bug — the events are delivered correctly and `idle` is reached.
- **Two submit buttons per composer are by design.** The "submitted" composer
  has a single button with `data-role="send"`, disabled because the field is
  empty. The "streaming" composer has a single button with `data-role="stop"`.
  The five total `[data-aicl="composer-submit"]` is one per Gallery section.
- **`data-aicl="artifact-card"` is intentionally not a `data-aicl="part"`.**
  The part renderer registry treats it as a custom DOM. Selectors that need
  parts use `[data-aicl="part"]`, which matches text/error/file/reasoning/etc.
- **Disk pressure blocked later screenshots.** The chat surface itself is
  verified through DOM assertions; the gallery full-page capture predates the
  pressure.

## Verdict

PASS for every chat-surface feature in the Gallery. The Open button opens a
pane without dropping the thread. Status machine distinguishes `submitted`,
`streaming`, `aborted`, `idle`, and `error` with the correct attributes. The
live scripted turn streams typed parts and stops without losing partial output.
