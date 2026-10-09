# Getting started

## Prerequisites

- **Node.js 22.6 or later.** The workspace app and `examples/server-node` run TypeScript directly with `--experimental-strip-types`. Development uses Node 22.23.
- npm 10 or later.
- For e2e suites and the workspace's browser surface: a Playwright Chromium. `playwright-core` downloads none, so run `npx playwright-core install chromium` once.
- For the workspace agent: a [Pi](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) model with credentials (`~/.pi/agent`).

## Install and build the library

```bash
cd aicl
npm install          # npm workspaces over packages/*
npm run build        # tsc → packages/*/dist (git-ignored). Required before running apps or examples
npm run typecheck
npm test
```

Apps and examples depend on the packages via `file:` links, and Node resolves those to `dist/`. Skipping `npm run build` produces `Cannot find module …/dist/index.js`.

## Run the workspace app

```bash
cd apps/workspace
npm install                                  # separate lockfile; postinstall fixes node-pty
AICL_MODEL=<provider>/<model-id> npm run dev # API on :5180, Vite on :5181 (open http://localhost:5181)
```

`scripts/dev.mjs` defaults `AICL_MODEL` to `ap-codex/gpt-6-luna`, which only exists on the author's machine, so set it explicitly. All variables, the HTTP surface, tools and tests are in `apps/workspace/AGENTS.md`.

## Run the slice-1 gallery

```bash
cd examples/slice-1 && npm install && npm run dev
```

Opens on http://localhost:5179. `?view=` picks a route: `components`, `gallery`, `scenarios`, or none for the shell (see `examples/slice-1/main.tsx`).

## Run the server-node example

```bash
cd examples/server-node && npm install && npm run dev   # POST http://127.0.0.1:5174/chat
curl -N -X POST http://127.0.0.1:5174/chat -H 'content-type: application/json' \
  -d '{"messages":[{"id":"u1","role":"user","parts":[{"type":"text","text":"hi"}]}]}'
```

## Per-package scripts

| Path | Build | Typecheck | Test |
| --- | --- | --- | --- |
| `./package.json` (forwards) | `npm run build --workspaces --if-present` | `npm run typecheck --workspaces --if-present` | `npm run test --workspaces --if-present` |
| `packages/core` | `tsc -p tsconfig.json` | `tsc --noEmit` | compile to `dist-test/`, `node --test` (files listed explicitly) |
| `packages/react` | `tsc -p tsconfig.json` | `tsc --noEmit` | compile to `dist-test/`, `node --test dist-test/*.test.js` |
| `packages/server` | `tsc -p tsconfig.json` | `tsc --noEmit` | compile to `dist-test/`, `node --test dist-test/handler.test.js` |
| `packages/fx` | — (source-only) | `tsc --noEmit` | — |
| `packages/styles` | — (CSS only) | — | — |
| `apps/workspace` | `vite build` | `tsc -p tsconfig.json` | `node --experimental-strip-types --test server/*.test.ts`. See its `AGENTS.md` for e2e |
