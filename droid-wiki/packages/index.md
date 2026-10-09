# Packages

`./package.json` declares `packages/*` as npm workspaces. Each package has its own `package.json`, `tsconfig.json` and `src/`, and each now has a README with its API and known sharp edges.

| Package | Summary | README |
| --- | --- | --- |
| `@aicl/core` | Framework-agnostic engine: `ChatController`, the `Message`/`Part` model, `StreamEvent`, renderer registry, SSE transport, stores for sessions and toasts. Zero runtime dependencies | `packages/core/README.md` |
| `@aicl/react` | `useChat`, `useReadable`, and unstyled accessible primitives: transcript, parts, composer and menus, sessions, dialogs, toasts, form controls. `@aicl/react/markdown` adds opt-in Markdown | `packages/react/README.md` |
| `@aicl/server` | `createChatHandler`, which returns `(body, headers, signal) => Promise<ChatResponse>` with `toSse()` framing and `ChatHandlerError`. You mount it and map statuses | `packages/server/README.md` |
| `@aicl/styles` | CSS-variable theme (light/dark) plus reset plus `[data-aicl]` component styles. CSS only | `packages/styles/README.md` |
| `@aicl/fx` | Animated, styled components on AICL tokens (motion, Tailwind v4, WebGPU ambience). Source-only, needs a bundler | `packages/fx/README.md` |
| `packages/svelte`, `packages/vue` | Empty placeholders | — |

All packages are at `0.0.0` and unpublished. Consume them through `file:` links after `npm run build` (`docs/ADOPTION.md` §1).
