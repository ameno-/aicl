# Development workflow

## Branch

```bash
git checkout main && git pull --rebase
git checkout -b linear/AICL-<n>-<slug>
```

## Code

- Library code goes in `packages/<pkg>/src/`. Keep `packages/core/src/` framework- and DOM-free (`docs/ARCHITECTURE.md`).
- App code goes in `apps/workspace/server/` (Node, run with strip-types), `apps/workspace/shared/` (pure, imported by both sides), or `apps/workspace/web/` (Vite + React). How to add a tool, feature module, canvas component or surface: `apps/workspace/AGENTS.md#recipes`.
- Design docs go in `docs/`: decisions in `DECISIONS.md`, per-domain specs in `domains/`, corrections in `evaluation/`, QA notes in `qa/`.
- Reference files by repo-root path in commits and PRs (`packages/core/src/chat.ts`).

## Inner loop

- Library + React: `cd examples/slice-1 && npm run dev`. Vite aliases resolve `@aicl/*` to sources, so edits hot-reload.
- Workspace web: `npm run dev` in `apps/workspace`, which also hot-reloads package sources. The workspace **server** resolves `@aicl/server` from `packages/server/dist`, so re-run the root `npm run build` after changing `packages/server`.
- Run a destructive app session on spare ports against a throwaway folder: `AICL_PORT=5192 AICL_WEB_PORT=5193 AICL_WORKSPACE=$(mktemp -d) npm run dev`.

## Test

See [Testing](testing.md). Minimum before a PR: root `npm run build && npm run typecheck && npm test`, and `apps/workspace` `npm run typecheck && npm test` when relevant.

## PR and merge

```bash
git push -u origin linear/AICL-<n>-<slug>
gh pr create --base main
```

There is no CI workflow, so the PR description must list the gates you ran. PRs are merged on GitHub with a merge commit.
