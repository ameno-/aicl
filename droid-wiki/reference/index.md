# Reference

Pointers to the canonical sources. Each item names the file to open first.

## Configuration

- `./package.json`: workspace declaration (`packages/*`) and forwarding scripts (`build`, `typecheck`, `test`).
- `packages/*/package.json`: per-package scripts, `exports`, peer dependencies. `core`, `react` and `server` export `dist/`; `styles` and `fx` export `src/`.
- `apps/workspace/package.json`: app scripts (`dev`, `server`, `web`, `start`, `build`, `typecheck`, `test`, `e2e`, `e2e:app`) and the `aicl` / `aicl-mcp` bins.
- `apps/workspace/vite.config.ts`: Vite root `web/`, port 5181 (`AICL_WEB_PORT`), proxy of `/api` and `/ws` to `AICL_PORT` (5180), aliases from `@aicl/{core,react,react/markdown,fx}` to package sources, dedupe list, and a second entry `gallery.html`.
- `apps/workspace/tsconfig.json`: `paths` to package sources, `allowImportingTsExtensions`, `verbatimModuleSyntax` (strip-types compatible).
- Environment variables for the app: `apps/workspace/AGENTS.md#environment`.
- `.beads/`: historical research tasks (`bd`). Current work: Linear team `AICL`.

## Data models

- `packages/core/src/types.ts`: `Message`, `Part`, `StreamEvent`, `ChatState`, `ChatStatus`, `ChatTransport`, `ReadableStore`, `Attachment`, `toFilePart`.
- `packages/core/src/chat.ts`: `ChatController`, `ChatOptions`, `BUSY`, the reducer.
- `packages/core/src/store.ts`, `registry.ts`, `session.ts`, `toast.ts`, `combobox.ts`.
- `packages/server/src/handler.ts`: `ChatHandler`, `ChatHandlerRequest`, `ChatHandlerError`, `ChatResponse`, `createChatHandler`.
- `apps/workspace/shared/runtime.ts`: `SessionInfo`, applets, `WorkspaceAddress` (`aicl:/…`), `CanvasContext`, `ServerEvent`, and the HTTP index.
- `apps/workspace/shared/surfaces.ts`, `shared/agentic.ts`, `shared/components.ts`, `shared/ui-spec.ts`: surfaces, HITL and live state, the canvas component catalog, and UI screen specs.

## External dependencies

| Dependency | Declared in | Why |
| --- | --- | --- |
| `lucide-react` | react, fx, workspace | Icons |
| `react-markdown`, `remark-gfm` | `packages/react` | `@aicl/react/markdown` |
| `motion`, `class-variance-authority`, `clsx`, `tailwind-merge`, `shaders` | `packages/fx` | Animation, class utilities, WebGPU ambience |
| `@earendil-works/pi-coding-agent` | workspace | The embedded agent runtime (`server/agent.ts`) |
| `typebox` | workspace | Tool parameter schemas |
| `tldraw`, `rbush` | workspace | The canvas, and the spatial index behind the canvas graph (`shared/canvas-graph.ts`) |
| `node-pty`, `@xterm/*`, `ws` | workspace | Terminal surface over WebSocket |
| `playwright-core` | workspace, slice-1 | Browser surface and e2e |
| `@codemirror/*`, `@lezer/highlight` | workspace | File surface editor |
| `@pierre/diffs`, `@pierre/trees` | workspace | Diff and file-tree views |
| `@modelcontextprotocol/sdk` | workspace | `bin/aicl-mcp.mjs` |
| `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `esbuild` | workspace (dev) | Bundling, Tailwind for `@aicl/fx`, applet builds |
| `react-test-renderer` | `packages/react` (dev) | Unit tests |

`@aicl/core`, `@aicl/server` and `@aicl/styles` have no third-party runtime dependencies.
