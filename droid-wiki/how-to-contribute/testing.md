# Testing

## Frameworks

- Node's built-in `node --test` for every library package and the workspace server.
- `react-test-renderer` for `@aicl/react` unit tests.
- Playwright (`playwright-core`) for e2e in `apps/workspace/e2e/` and `examples/slice-1/e2e/`. `playwright-core` downloads no browsers, so run `npx playwright-core install chromium` once.

## Unit tests

| Path | Command | What it runs |
| --- | --- | --- |
| `packages/core` | `npm test` | compiles `src/*.test.ts` to `dist-test/`, then `node --test dist-test/chat.test.js dist-test/services.test.js` (16 tests). **Add new test files to the script** |
| `packages/server` | `npm test` | `dist-test/handler.test.js` (4). Same rule |
| `packages/react` | `npm test` | every `dist-test/*.test.js`: composer-surface, markdown, platform, sessions, slice (28) |
| `apps/workspace` | `npm test` | `node --experimental-strip-types --test server/*.test.ts`: 28 files, 188 tests, Pi replaced by fakes |
| `apps/workspace` | `node --experimental-strip-types --no-warnings e2e/codegen-check/check.ts` | generated screen code typechecks against `@aicl/react` |

Root `npm test` runs the three library packages. The app is not a root workspace, so run its tests from `apps/workspace`.

## End-to-end

- `examples/slice-1`: `npm run dev` (port 5179), then `npm run e2e` in a second shell (`e2e/components.mjs`, `e2e/shell.mjs`).
- `apps/workspace`: 13 suites against a **live** dev server with a **real model**. Each refuses to run without a safety flag (`--clears-canvas` or `--scratch-workspace`), because it clears the canvas or writes into the workspace. The suite table, flags and port recipe are in `apps/workspace/AGENTS.md#testing`.

## Patterns

- Engine: construct a `ChatController` with an in-memory `ChatTransport` (`packages/core/src/chat.test.ts`).
- Handler: an async-generator `ChatHandler`, asserting on the `data:` frames (`packages/server/src/handler.test.ts`).
- React: render with `react-test-renderer` and assert on `data-aicl` attributes (`packages/react/src/platform.test.tsx`).
- Workspace server: modules take their collaborators as arguments (relay, hub, `createAgent`), so tests pass fakes. See `server/sessions.test.ts` and `server/hitl.test.ts`.

## Coverage expectations

- Every public export of a package gets a test.
- Handler changes cover success, `ChatHandlerError` status mapping, a malformed body (400), and a thrown stream error (in-band `error` frame).
- New workspace tools and routes get a `server/<module>.test.ts` case.
