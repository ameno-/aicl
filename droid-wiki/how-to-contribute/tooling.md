# Tooling

## Build

- TypeScript compiler, no bundler. Each package builds with `tsc -p tsconfig.json`. Output goes to `dist/` (libraries) or `dist-test/` (compiled tests). See `packages/core/package.json`, `packages/react/package.json`, and `packages/server/package.json`.
- The root script `npm run build` (defined in `./package.json`) forwards to every workspace that declares a `build` script.

## Linters and formatters

- No ESLint or Prettier config is committed at this stage. The package scripts run `tsc` only; type errors are the formatter's responsibility today.
- When a formatter is added, the existing `tsconfig` strictness flags are the baseline to preserve.

## Generators (issue tracking)

- The bead CLI (`bd`) drives issue generation and sync. It reads `.beads/config.yaml`, writes `.beads/issues.jsonl`, and uses Dolt objects under `refs/dolt/data` for sync. See the upstream [sync concepts](https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md).
- The repository's `./AGENTS.md` lists the quick reference: `bd ready`, `bd show <id>`, `bd update <id> --status in_progress`, `bd close <id>`, `bd sync`.

## CI

- No GitHub Actions workflow is configured (`.github/workflows/` does not exist in this repository).
- Reviewers run `npm run typecheck` and `npm run test` from the repo root before approving.

## Test runner

- Node's built-in `node --test` is the only test runner used by the libraries. `apps/workspace` uses `node --experimental-strip-types` so it can run TypeScript tests directly against `apps/workspace/server/*.test.ts`.
- Playwright (`playwright-core`) drives the two E2E fixtures (`apps/workspace/e2e/canvas.mjs` and `examples/slice-1/e2e/`); both declare `playwright-core` in their `devDependencies`.

## Dev servers

- `apps/workspace/scripts/dev.mjs` starts the agent server and Vite together; Ctrl-C sends `SIGTERM` to both.
- `examples/slice-1` uses Vite directly (`npm run dev`). The dev script is the default `vite` command declared in `examples/slice-1/package.json`.
- `examples/server-node` is a single-process Node script (`examples/server-node/src/server.ts`) launched by `node --experimental-strip-types`.

## Workspace wiring

- `apps/workspace/vite.config.ts` aliases `@aicl/core` and `@aicl/react` to the source tree (`packages/core/src/index.ts` and `packages/react/src/index.ts`) so changes to the library are reflected immediately, no rebuild step required.
- `examples/slice-1/vite.config.ts` applies the same aliases (read `examples/slice-1/vite.config.ts` for the exact mapping).
- The root `./package-lock.json` and the per-package `packages/*/package-lock.json` files pin transitive dependencies.
