# By the numbers

Measured on 2026-10-08 against `main` at `c113e9b` (before the AICL-53 docs pass). Refresh with:

```bash
git rev-list --count HEAD
git log --reverse --format=%cI | head -1; git log -1 --format='%cI %H'
git shortlog -sn HEAD
git ls-files | wc -l
git ls-files | sed -n 's/.*\.\([A-Za-z0-9]*\)$/\1/p' | sort | uniq -c | sort -rn
```

## Repository

| Metric | Value |
| --- | --- |
| Total commits | 115 |
| Authors | 1 person (two git identities: `Ameno Osman` 102, `Ameno` 13) |
| First commit | `2026-09-21T10:51:54-07:00` |
| Last commit | `2026-10-08T12:07:30-07:00` |
| Merged PRs | 16 (most recent: #16, `linear/AICL-44-assistant-shell`) |
| License | MIT |

## Tracked files

| Metric | Value |
| --- | --- |
| Tracked files (`git ls-files`) | 413 |
| `ts` / `tsx` | 159 / 124 |
| `md` | 42 |
| `json` | 26 |
| `css` | 23 |
| `mjs` | 19 |
| `png` | 11 |
| `html` | 3 |

## Packages and apps

| Metric | Value |
| --- | --- |
| Packages with code | 5 (`core`, `react`, `server`, `styles`, `fx`) |
| Placeholder packages | 2 (`svelte`, `vue`: empty `src/`) |
| Reference apps | 1 (`apps/workspace`) |
| Examples | 2 (`examples/server-node`, `examples/slice-1`) |
| Unit tests passing | core 16, react 28, server 4, workspace 188 |
| Workspace server test files | 28 (`apps/workspace/server/*.test.ts`) |
| Workspace e2e suites | 13 (`apps/workspace/e2e/*.mjs`) |
| Agent tools in the workspace | 55 custom (see `apps/workspace/AGENTS.md`) plus Pi's `read grep find ls write edit bash` |

## Docs and corpus

| Metric | Value |
| --- | --- |
| Domain specs | 5 (`docs/domains/`) |
| Evaluations | 8 files (`docs/evaluation/`: one per domain, `transport`, `prior-art`, `CRITERIA`) |
| QA notes | 4 (`docs/qa/`) |
| Decisions | D1–D14 (`docs/DECISIONS.md`) |
| Screens analysed | 1,262 across 4 products (`docs/CORPUS.md`) |
