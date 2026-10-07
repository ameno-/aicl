# Development workflow

## Branch

Branch off `main` with a short descriptive name:

```bash
git checkout main
git pull --rebase
git checkout -b <short-name>
```

## Code

- Place package code under `packages/<pkg>/src/`. Keep `packages/core/src/` framework-free; see `docs/ARCHITECTURE.md`.
- Place app code under `apps/workspace/server/` (Node), `apps/workspace/web/` (Vite + React), or one of the `examples/` directories.
- Place new docs under `docs/`, `docs/domains/`, `docs/evaluation/`, or `docs/qa/` depending on the audience.
- Use full repo-root paths in commit messages and PR descriptions when referencing files (`packages/core/src/chat.ts`, not `packages/core/src/chat.ts`'s bare name).

## Test

Run the package's test script before pushing:

```bash
# From packages/core or packages/server:
npm run test
# From packages/react:
npm run test
# From apps/workspace:
npm run test
```

Each script compiles to `dist-test/` (or runs `node --experimental-strip-types` for `apps/workspace`) and then invokes `node --test`. See [Testing](testing.md) for the matrix and the E2E fixtures.

## PR

```bash
bd sync
git push -u origin <branch>
```

Open the PR with a one-paragraph summary, the bead id, and a list of test commands you ran locally.

## Merge

No CI workflow is configured in this repository (`.github/workflows/` does not exist). Reviewers must run the workspace commands locally before approval:

```bash
npm run typecheck
npm run test
```

`npm run typecheck` is a forwarder; each package runs `tsc --noEmit`. `npm run test` compiles and runs `node --test` per workspace that defines the script.
