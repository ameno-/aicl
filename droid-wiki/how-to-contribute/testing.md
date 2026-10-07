# Testing

## Frameworks

- Node's built-in `node --test` runs every library package and the workspace server.
- `react-test-renderer` (declared in `packages/react/package.json`) drives the React adapter's unit tests.
- Playwright (`playwright-core`, declared in `apps/workspace/package.json` and `examples/slice-1/package.json`) drives the two end-to-end fixtures.

## Per-package commands

| Path | Command | What it runs |
| --- | --- | --- |
| `packages/core/package.json` | `npm run test` | `tsc -p tsconfig.test.json` compiles `packages/core/src/chat.test.ts` and `packages/core/src/services.test.ts` into `packages/core/dist-test/`, then `node --test dist-test/chat.test.js dist-test/services.test.js`. |
| `packages/server/package.json` | `npm run test` | Compiles `packages/server/src/handler.test.ts` into `packages/server/dist-test/`, then `node --test dist-test/handler.test.js`. |
| `packages/react/package.json` | `npm run test` | Compiles every `*.test.tsx` under `packages/react/src/` (composer-surface, markdown, platform, sessions, slice) into `packages/react/dist-test/`, then `node --test dist-test/*.test.js`. |
| `apps/workspace/package.json` | `npm run test` | `node --experimental-strip-types --no-warnings --test server/*.test.ts` against the workspace server tests (`apps/workspace/server/pi-mapper.test.ts`, `apps/workspace/server/scratch-components.test.ts`). |

## End-to-end

```bash
cd apps/workspace
npm run e2e        # runs apps/workspace/e2e/canvas.mjs
```

```bash
cd examples/slice-1
npm run e2e        # runs examples/slice-1/e2e/components.mjs then examples/slice-1/e2e/shell.mjs
```

Both fixtures need a Chromium-based browser available to Playwright.

## Patterns

- Engine tests construct a `ChatController` directly with an in-memory transport that yields `StreamEvent` values; see `packages/core/src/chat.test.ts`.
- Handler tests construct a `ChatHandler` as an async generator and assert against the `data: ...` SSE frames; see `packages/server/src/handler.test.ts`.
- React tests use `react-test-renderer` to assert DOM output and DOM-mounted behaviour against the real primitives; see `packages/react/src/composer-surface.test.tsx` and `packages/react/src/platform.test.tsx`.

## Coverage expectations

- Every public export added in `@aicl/core` (re-exported through `packages/core/src/index.ts`) needs at least one test.
- Handlers wired through `@aicl/server` should cover the success path, a `ChatHandlerError` (status code mapping), a malformed body (400), and a thrown stream error (which becomes a `{ type: 'error' }` `StreamEvent` frame on the wire).
- DOM-touching changes in `@aicl/react` should add a render-based test in the same file rather than a separate fixture.
