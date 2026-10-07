# Getting started

## Prerequisites

- Node.js 20 or later. The packages use `crypto.randomUUID` at runtime and rely on Node's built-in `node --test` runner; the workspace server uses `--experimental-strip-types` to run TypeScript tests directly.
- npm 10 or later, for the workspace forwarding scripts declared in `./package.json`.
- A POSIX shell for the workspace dev script (`apps/workspace/scripts/dev.mjs`).
- A Chromium-based browser if you plan to run the Playwright fixtures under `apps/workspace/e2e/` or `examples/slice-1/e2e/`.

## Install

The repository declares `packages/*` as workspaces in `./package.json`, with `./package-lock.json` committed for reproducible installs.

```bash
cd aicl
npm install
```

For a clean install that ignores any drift in `node_modules`, use `npm ci`.

## Build all packages

```bash
npm run build
```

The root script forwards to every workspace that declares `build`. Each package compiles with `tsc -p tsconfig.json` and writes to `dist/`.

## Typecheck and test

```bash
npm run typecheck
npm run test
```

`npm run typecheck` runs `tsc --noEmit` per workspace. `npm run test` runs each package's `test` script, which compiles to `dist-test/` first and then invokes `node --test`. See [Testing](../how-to-contribute/testing.md) for the full matrix.

## Run the workspace app

```bash
cd apps/workspace
npm install
npm run dev
```

This starts two processes (see `apps/workspace/scripts/dev.mjs`):

- The Pi-driven agent server on `127.0.0.1:5180` (override with `AICL_PORT`). It exposes `/api/chat`, `/api/events`, `/api/scratch`, and `/api/info`.
- The Vite dev server on `127.0.0.1:5181` (override with `AICL_WEB_PORT`). It proxies `/api/*` to the server; the proxy and port discipline are in `apps/workspace/vite.config.ts`.

The web entry loads `apps/workspace/web/main.tsx`. Run the two halves separately with `npm run server` and `npm run web` when you need a different restart cadence.

## Run the slice-1 gallery

```bash
cd examples/slice-1
npm install
npm run dev
```

Append a `?view=` query parameter to switch routes (`Shell`, `Components`, `Gallery`, or `Scenarios`). The dispatch is in `examples/slice-1/main.tsx`.

## Run the server-node example

```bash
cd examples/server-node
npm install
npm run dev
```

`examples/server-node` is a minimal `@aicl/server` handler wired into a Node script (`examples/server-node/src/server.ts`). Use `npm run start` for the same command outside of a dev shell.

## Per-package scripts

| Path | Build | Typecheck | Test |
| --- | --- | --- | --- |
| `./package.json` (forwards) | `npm run build --workspaces --if-present` | `npm run typecheck --workspaces --if-present` | `npm run test --workspaces --if-present` |
| `packages/core/package.json` | `tsc -p tsconfig.json` | `tsc -p tsconfig.json --noEmit` | `tsc -p tsconfig.test.json && node --test dist-test/chat.test.js dist-test/services.test.js` |
| `packages/react/package.json` | `tsc -p tsconfig.json` | `tsc -p tsconfig.json --noEmit` | `tsc -p tsconfig.test.json && node --test dist-test/*.test.js` |
| `packages/server/package.json` | `tsc -p tsconfig.json` | `tsc -p tsconfig.json --noEmit` | `tsc -p tsconfig.test.json && node --test dist-test/handler.test.js` |
| `apps/workspace/package.json` | `vite build` | `tsc -p tsconfig.json` | `node --experimental-strip-types --no-warnings --test server/*.test.ts`; E2E: `node e2e/canvas.mjs` |

`packages/styles/` ships CSS only and has no build script; import `packages/styles/src/index.css` directly.
