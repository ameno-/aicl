# Tooling

## Build

- Libraries: `tsc -p tsconfig.json` into `dist/` (`core`, `react`, `server`). `styles` (CSS) and `fx` (TS source, consumed by a bundler) have no build.
- `apps/workspace`: `vite build` into `dist/` (two entries: `index.html`, `gallery.html`). The server is never built: it runs from source with `--experimental-strip-types`. Applets are bundled at runtime with esbuild (`server/applets.ts`).
- Root `npm run build` forwards to every workspace with a `build` script.

## Linters and formatters

None committed. `tsc` with `strict` and `noUncheckedIndexedAccess` is the only static check, so match the surrounding style.

## Issue tracking

- Linear: workspace `acids`, team `AICL`, through the `linear` CLI (`linear issue list --team AICL`). There is no `.linear.toml`, so pass `--team`.
- `.beads/` + `bd`: the original corpus/blueprint tasks. Kept for history, with one review gate (`aicl-fur`) still open.

## CI

None (`.github/` does not exist). Run the gates locally (see [Testing](testing.md)).

## Dev servers

| Command | Ports |
| --- | --- |
| `apps/workspace`: `npm run dev` (`scripts/dev.mjs`, API + Vite, Ctrl-C stops both) | 5180 / 5181 |
| `apps/workspace`: `npm start` (built web served by the API) | 5180 |
| `examples/slice-1`: `npm run dev` | 5179 |
| `examples/server-node`: `npm run dev` | 5174 (`AICL_PORT`) |

## Workspace wiring

- `apps/workspace/vite.config.ts` and `tsconfig.json` map `@aicl/core`, `@aicl/react`, `@aicl/react/markdown` and `@aicl/fx` to package sources. The aliases are exact-match regexes, so `@aicl/react/markdown` does not resolve through `@aicl/react`.
- At runtime the server resolves `@aicl/server` through `node_modules` to `packages/server/dist`.
- External agents: `apps/workspace/bin/aicl.mjs` (CLI, zero deps) and `bin/aicl-mcp.mjs` (MCP stdio). Usage: `apps/workspace/skill/aicl-canvas/SKILL.md`.
