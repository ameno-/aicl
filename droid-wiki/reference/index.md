# Reference

The reference pages point at the canonical sources for configuration, data models, and external dependencies. Each item below names the file you should open first; the linked files contain the full surface area.

## Configuration

- `./package.json` — workspace declaration (`packages/*`) and the forwarding scripts (`build`, `typecheck`, `test`).
- `packages/core/package.json`, `packages/react/package.json`, `packages/server/package.json`, `packages/styles/package.json` — per-package scripts, exports, and peer dependencies.
- `apps/workspace/package.json` — workspace app scripts (`dev`, `server`, `web`, `build`, `typecheck`, `test`, `e2e`).
- `apps/workspace/vite.config.ts` — Vite config for the workspace app. Dev server port (`5181`, overridable with `AICL_WEB_PORT`), proxy target (`AICL_PORT`, default `5180`), and aliases that resolve `@aicl/core` and `@aicl/react` to source.
- `examples/slice-1/vite.config.ts` — Vite config for the slice-1 fixture with the same alias strategy.
- `.beads/config.yaml` and `.beads/issues.jsonl` — Beads issue tracker state.
- `packages/core/tsconfig.json`, `packages/core/tsconfig.test.json` — TypeScript settings for the engine and its tests.
- `apps/workspace/tsconfig.json` — TypeScript settings for the workspace app.

## Data models

- `packages/core/src/types.ts` — `Message`, the discriminated `Part` union, `StreamEvent`, `ChatState`, `ChatStatus`, `ChatTransport`, `ReadableStore`, `SessionMeta`, `Attachment`, and the `Attachment → FilePart` converter.
- `packages/core/src/chat.ts` — `ChatController`, `ChatOptions`, the `BUSY` set, and the stream reducer.
- `packages/core/src/store.ts` — `WritableStore`, `batched`, `derived`.
- `packages/core/src/registry.ts` — `RendererRegistry` and `createRendererRegistry`.
- `packages/core/src/combobox.ts` — `ComboboxModel`, `ComboboxState`, `createComboboxModel`.
- `packages/core/src/session.ts` — `SessionMeta`, `SessionGroup`, `SessionState`, `SessionStore`, `createSessionStore`, `bucketByRecency`.
- `packages/core/src/toast.ts` — `ToastInput`, `ToastState`, `ToastQueue`, `createToastQueue`, `ToastVariant`.
- `packages/server/src/handler.ts` — `ChatHandler`, `ChatHandlerRequest`, `ChatHandlerResult`, `ChatHandlerError`, `ChatResponse`, `createChatHandler`.

## External dependencies

| Dependency | Declared in | Why it is there |
| --- | --- | --- |
| `lucide-react` | `packages/react/package.json` | Icons (`ArrowUp`, `Square`, `Plus`, `ChevronLeft`, `ChevronRight`, `ArrowDown`) for the composer and transcript primitives. |
| `react-markdown` | `packages/react/package.json` | Markdown rendering in `packages/react/src/markdown.tsx`. |
| `remark-gfm` | `packages/react/package.json` | GitHub-flavoured markdown for the same. |
| `@earendil-works/pi-coding-agent` | `apps/workspace/package.json` | The Pi agent the workspace server wraps (`apps/workspace/server/agent.ts`). |
| `tldraw` | `apps/workspace/package.json` | The scratchpad canvas the workspace web client renders. |
| `typebox` | `apps/workspace/package.json` | Schema typing for the workspace agent. |
| `playwright-core` | `apps/workspace/package.json`, `examples/slice-1/package.json` | E2E driver. |
| `vite` | `apps/workspace/package.json`, `examples/slice-1/package.json` | Dev server and bundler for the two reference consumers. |
| `@vitejs/plugin-react` | `apps/workspace/package.json`, `examples/slice-1/package.json` | React Fast Refresh for the Vite dev server. |
| `react`, `react-dom` | several | React 18 peer runtime for `@aicl/react` and the reference consumers. |
| `@types/node`, `@types/react`, `@types/react-dom`, `@types/react-test-renderer` | several | TypeScript types for the same. |
| `typescript` | root and per-package `devDependencies` | Build, typecheck, and test compilation. |

`@aicl/core`, `@aicl/server`, and `@aicl/styles` ship zero of their own; `@aicl/core` is intentionally framework-free, and `@aicl/styles` is a CSS-only package.
