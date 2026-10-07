# By the numbers

Data collected on 2026-10-05 from the working tree at `/tmp/janitor-work/aicl/`. Run `git -C /tmp/janitor-work/aicl log --reverse --format='%cI' -n 1` and `git -C /tmp/janitor-work/aicl log --format='%H' -n 1` to refresh the dates and head; rerun the recursive file listing to update the counts.

## Repository

| Metric | Value |
| --- | --- |
| Total commits | 1 |
| Contributors | 1 (`Ameno`) |
| First commit | `2026-10-05T01:52:50-07:00` |
| Last commit | `2026-10-05T01:52:50-07:00` |
| Default branch | `main` |
| Head | `118f39478dcecd5de413e5ae97680b2c17e2badb` |
| License | MIT (declared in `./package.json` and every `packages/<pkg>/package.json`) |

## File tree

| Metric | Value |
| --- | --- |
| Files (excluding `.git`, `node_modules`) | 153 |
| `md` files | 40 |
| `ts` files | 35 |
| `tsx` files | 29 |
| `json` files | 22 |
| `png` files | 9 |
| `css` files | 7 |
| `mjs` files | 4 |
| `html` files | 2 |
| `gitignore` files | 2 |
| `yaml` files | 1 |
| `jsonl` files | 1 |
| `gitattributes` files | 1 |

The `md` total includes `./AGENTS.md`, `.beads/README.md`, the per-domain specs in `docs/domains/`, the per-domain evaluations in `docs/evaluation/`, the QA checklists in `docs/qa/`, `packages/styles/README.md`, and the wiki pages under `droid-wiki/`. The `jsonl` file is `.beads/issues.jsonl`; the `yaml` file is `.beads/config.yaml`.

## Workspaces and packages

| Metric | Value |
| --- | --- |
| Workspace declaration | `./package.json` (`packages/*`) |
| Packages | 4 (`packages/core`, `packages/react`, `packages/server`, `packages/styles`) |
| Reference apps | 1 (`apps/workspace`) |
| Reference examples | 2 (`examples/server-node`, `examples/slice-1`) |
| Domain specs | 5 (composer, transcript, agent-execution, navigation, platform — see `docs/domains/`) |
| QA checklists | 4 (backend-wire, chat-ui, corpus-alignment, design-system — see `docs/qa/`) |

## Corpus

| Metric | Value |
| --- | --- |
| Screens analysed | 1,262 |
| Products surveyed | 4 (Devin, Manus, Lovable, Cofounder) |
| Source | `docs/CORPUS.md` |
| Comparative evaluations | `docs/evaluation/` (seven files: `docs/evaluation/prior-art.md`, `docs/evaluation/CRITERIA.md`, plus one per domain and `docs/evaluation/transport.md`) |
