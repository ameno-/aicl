# Agent Instructions

AICL is an open-source, framework-agnostic UI component library for AI chat applications,
derived from a survey of 1,262 screens of four shipping agentic-chat products
(`docs/CORPUS.md`). The repo also contains a large reference application built on it.

## Repo map

| Path | What | Guide |
|---|---|---|
| `packages/core` | `@aicl/core`: message model, `ChatController`, SSE transport. No DOM, no deps | `packages/core/README.md` |
| `packages/react` | `@aicl/react`: `useChat` + unstyled accessible primitives | `packages/react/README.md` |
| `packages/server` | `@aicl/server`: `createChatHandler`, SSE framing | `packages/server/README.md` |
| `packages/styles` | `@aicl/styles`: optional CSS-variable theme over `[data-aicl]` | `packages/styles/README.md` |
| `packages/fx` | `@aicl/fx`: animated, styled components (Tailwind v4, source-only) | `packages/fx/README.md` |
| `packages/svelte`, `packages/vue` | **Empty placeholders.** No adapter exists yet | — |
| `apps/workspace` | Reference app: Pi agent + tldraw canvas + live surfaces + CLI/MCP, and the screen exporter | `apps/workspace/AGENTS.md` |
| `apps/workbench` | Nasir Workbench: self-hosted Rivet engine + RivetKit worker (Nasir `pi()` agent, credentials, Codex runner in Docker sandboxes), chat UI, durability drill. Runs live on ai-lab | `apps/workbench/README.md` |
| `examples/slice-1` | Vite gallery of every React primitive in every state, plus e2e | — |
| `examples/server-node` | Minimal `@aicl/server` handler on Node `http` | — |
| `docs/` | Architecture, decisions, corpus method, per-domain specs, evaluations, QA notes | see below |
| `droid-wiki/` | Contributor wiki (refreshed against `c113e9b` in AICL-53; may lag the code, and the guides above win) | — |
| `pipeline/` | Empty (corpus pipeline lives outside this repo; see `docs/CORPUS.md`) | — |

## Commands (all verified)

```bash
npm install            # root: npm workspaces over packages/*
npm run build          # REQUIRED before running apps/examples: they resolve packages' dist/ (git-ignored)
npm run typecheck      # tsc --noEmit in every package
npm test               # node --test per package (core, react, server)

cd apps/workspace && npm install    # the app is NOT a root workspace; it has its own lockfile
npm run typecheck && npm test       # app: tsc over server/shared/web; node --test server/*.test.ts

cd apps/workbench && npm install    # also NOT a root workspace; needs Docker
npm run typecheck                   # then `npm run up` + `npm run drill` for actor lifecycle changes
```

Node ≥ 22.6 (the app runs TypeScript with `--experimental-strip-types`). There is **no CI**
(`.github/` does not exist), so run these gates yourself before opening a PR.

## Invariants

1. `@aicl/core` never imports a framework and never touches `document`/`window`. Enforced by
   review only.
2. `@aicl/core`, `@aicl/react` and `@aicl/server` ship **no CSS**. Primitives expose state as
   `data-aicl` / `data-*` attributes. Those attribute names are public API, because
   `@aicl/styles` and consumers select on them.
3. Messages are ordered `Part[]`, never strings. Extend with `data-${string}` parts. Changing
   the core union, `StreamEvent`, or `ChatStatus` needs an entry in `docs/DECISIONS.md`.
4. `submitted` ≠ `streaming`. Abort keeps partial output (tools become `cancelled`). Do not
   collapse these states.
5. Public exports get a test in the same package. `packages/core` and `packages/server` list test
   files explicitly in their `test` script, so add new files there.
6. Vendored code in `packages/fx/src/vendor` keeps its source header and an `ATTRIBUTION.md` row.

## Where to change things

| Task | Start here |
|---|---|
| Message/part model, stream reduction, branching | `packages/core/src/types.ts`, `packages/core/src/chat.ts` |
| A React primitive's markup, ARIA, keyboard | `packages/react/src/*.tsx`, then `examples/slice-1` to see it |
| Default theme / tokens | `packages/styles/src/tokens.css`, `components.css` |
| Server framing / error mapping | `packages/server/src/handler.ts` |
| Anything in the app (tools, surfaces, canvas, chat product) | `apps/workspace/AGENTS.md` |
| Integrating AICL into another app | `docs/ADOPTION.md` |
| Exporting designed screens as apps (targets, templates, backends) | `apps/workspace/AGENTS.md#export-pipeline` |

## Docs index

- `docs/ADOPTION.md`: wiring AICL into an app, with verified examples and every known sharp
  edge. **Read this before writing integration code.**
- `docs/ARCHITECTURE.md`: the three-layer split and why. `docs/DECISIONS.md`: D1–D14
  (binding).
- `docs/api/README.md`: the wire contract and handler conventions.
- `docs/BLUEPRINT.md`: target-state component inventory and token contract (design, partly
  ahead of the code).
- `docs/domains/*.md`: corpus-derived specs per domain. `docs/evaluation/*.md`: corrections
  that **supersede** the domain specs where they disagree.
- `docs/CORPUS.md`: how the screenshot corpus was labelled. `docs/qa/`: QA passes.

## Workflow

- **Tracker: Linear**, workspace `acids`, team `AICL` (`linear issue list --team AICL`). There is
  no `.linear.toml`, so pass `--team AICL`. `.beads/` (`bd`) holds the original corpus and
  blueprint tasks (one review gate, `aicl-fur`, is still open). New work goes to Linear.
- **Never commit to `main`.** Branch `linear/AICL-<n>-<slug>`, push, open a PR against `main`
  with `gh pr create`, and merge it as a PR (merge commit). Reference issue keys in commit
  subjects, for example `… (AICL-44)`.
- Commit messages: imperative, say what changed and where (see `git log`).
- `logs/` directories anywhere in the tree are written by local Claude Code hooks and are
  git-ignored. Ignore them.

### Landing the plane

Work is complete only when the PR is pushed:

1. File Linear issues for anything left over.
2. Run the gates above (root and, if touched, `apps/workspace` or `apps/workbench`).
3. Update the Linear issue (state and a comment with the PR link).
4. Push your branch and confirm `git status` says it is up to date with its upstream, then open
   or update the PR.
5. Hand off: what changed, what was verified, what was not.
