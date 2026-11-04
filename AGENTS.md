# Agent Instructions

AICL is an open-source, framework-agnostic UI component library for AI chat applications,
derived from a survey of 1,262 screens of four shipping agentic-chat products
([`docs/CORPUS.md`](docs/CORPUS.md)). The repo also ships a large reference application
(`apps/workspace`) that uses the library, but the library is the product; the application is a
worked example, not a starting point for your own chat UI.

## Repo map

| Path | What | Guide |
|---|---|---|
| `packages/core` | `@aicl/core`: message model, `ChatController`, SSE transport. No DOM, no deps | `packages/core/README.md` |
| `packages/react` | `@aicl/react`: `useChat` + unstyled accessible primitives | `packages/react/README.md` |
| `packages/server` | `@aicl/server`: `createChatHandler`, SSE framing | `packages/server/README.md` |
| `packages/styles` | `@aicl/styles`: the token contract + component surfaces over `[data-aicl]`, plus skins in `src/themes/` | `packages/styles/README.md` |
| `packages/motion` | `@aicl/motion`: the motion system — spring tiers, fluid hover, weight without reflow | `packages/motion/README.md` |
| `packages/fx` | `@aicl/fx`: animated, styled components (Tailwind v4, source-only) | `packages/fx/README.md` || `packages/svelte`, `packages/vue` | **Empty placeholders.** No adapter exists yet | — |
| `apps/workspace` | Reference application built on the library: chat + tldraw canvas + live tools + exporter | `apps/workspace/AGENTS.md` |
| `examples/slice-1` | Vite gallery of every React primitive in every state, plus e2e | — |
| `examples/server-node` | Minimal `@aicl/server` handler on Node `http` | — |
| `docs/` | Architecture, decisions, corpus method, per-domain specs, evaluations, QA notes | see below |
| `droid-wiki/` | Contributor wiki (may lag the code; the guides above win) | — |
| `pipeline/` | Empty (corpus pipeline lives outside this repo; see `docs/CORPUS.md`) | — |

When you are about to work in `apps/workspace`, switch into that subtree: it has its own
lockfile, its own `npm run` scripts, and its own conventions (`apps/workspace/AGENTS.md`).

## Commands (all verified)

```bash
npm install            # root: npm workspaces over packages/*
npm run build          # REQUIRED before running apps/examples: they resolve packages' dist/ (git-ignored)
npm run typecheck      # tsc --noEmit in every package
npm test               # node --test per package (core, react, server)

cd apps/workspace && npm install    # the app is NOT a root workspace; it has its own lockfile
npm run typecheck && npm test       # app: tsc over server/shared/web; node --test server/*.test.ts
```

Node ≥ 22.6 (the app runs TypeScript with `--experimental-strip-types`). There is **no CI**
(`.github/` does not exist), so run these gates yourself before opening a PR.

## Invariants (library)

These hold for the `packages/*` library and **never** for `apps/workspace`:

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

Start with the library. Move to the app only when the change is about that specific app.

| Task | Start here |
|---|---|
| Message/part model, stream reduction, branching | `packages/core/src/types.ts`, `packages/core/src/chat.ts` |
| A React primitive's markup, ARIA, keyboard | `packages/react/src/*.tsx`, then `examples/slice-1` to see it |
| A primitive's slots and states | `packages/react/src/contract.ts` — the contract is the source of truth; `docs/components.md` is generated from it |
| Icons | `packages/react/src/icons.tsx` — the slot names and the Lucide defaults |
| Default theme / tokens / a skin | `packages/styles/src/contract.css`, `packages/styles/src/themes/*.css`, `components.css` |
| Springs, easings, hover, weight | `packages/motion/src/springs.ts` (the source of truth), `scripts/generate-motion-css.mjs` |
| Server framing / error mapping | `packages/server/src/handler.ts` |
| Animated/styled components | `packages/fx/src/components/*`, then the gallery at `apps/workspace/web/gallery.html` |
| A new framework adapter | create `packages/<framework>/` next to `packages/react` and follow the same layout |
| The reference app (tools, surfaces, canvas, chat product) | `apps/workspace/AGENTS.md` |
| Integrating AICL into another app | `docs/ADOPTION.md` |
| Exporting designed screens as apps (targets, templates, backends) | `apps/workspace/AGENTS.md#export-pipeline` |

## Docs index

- `docs/ADOPTION.md`: wiring AICL into an app, with verified examples and every known sharp
  edge. **Read this before writing integration code.**
- `docs/DESIGN-SYSTEM.md`: the four layers — protocol, behaviour, system, skin — the token
  contract, the motion system, and the shipping model.
- `docs/LIBRARY.md`: how the library is organised — systems, components, blocks — and what is
  planned. `docs/components.md`: the component contract, generated. `docs/llms.txt`: the
  library, indexed for an agent.
- `docs/ARCHITECTURE.md`: the layer split and why. `docs/DECISIONS.md`: D1–D18 (binding).
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
2. Run the gates above (root and, if touched, `apps/workspace`).
3. Update the Linear issue (state and a comment with the PR link).
4. Push your branch and confirm `git status` says it is up to date with its upstream, then open
   or update the PR.
5. Hand off: what changed, what was verified, what was not.

## Cursor Cloud specific instructions

The default image already has Node 22. Root `npm ci` and `npm run build` have to finish before the apps, because `core`, `react`, and `server` resolve to gitignored `dist/`. `apps/workspace`, `examples/slice-1`, and `examples/server-node` are outside the root workspaces and each need their own `npm ci`. Slice-1 and workspace e2e use `playwright-core`, which does not download a browser; install Chromium with `npx playwright-core install chromium` from `examples/slice-1` (the workspace app pins the same version).

On boot, the echo chat server listens on port 5174, the slice-1 gallery on 5179 (its `/api` proxy targets 5174), and the workspace API on 5180 with Vite on 5181. Workspace state is `AICL_WORKSPACE=/tmp/aicl-workspace`.

Do not start the workspace with `npm run dev` unless `AICL_MODEL` is a model Pi can resolve. That script defaults `AICL_MODEL` to `ap-codex/gpt-6-luna`, which exists only on the author's machine, and the API process exits. `npm run server` and `npm run web` start with no model (`unknown/unknown`) when `AICL_MODEL` is unset. Library tests, workspace `npm test`, the slice-1 gallery, and the echo server do not need a provider. A live workspace chat turn does: Pi reads `~/.pi/agent` (or `PI_CODING_AGENT_DIR`) and the provider keys documented in `@earendil-works/pi-coding-agent`.
