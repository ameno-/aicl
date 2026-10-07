# Packages

Four packages ship from `./package.json`'s `packages/*` workspace. Each is a separate npm package with its own `packages/*/package.json`, `packages/*/tsconfig.json`, and `packages/*/src/` directory.

## `@aicl/core`

Framework-agnostic conversation engine. Exports `ChatController`, the `Message` and `Part` unions, `StreamEvent`, the renderer registry, the SSE transport, and the framework-free observable store. Zero runtime dependencies; the engine never imports a framework and never touches `document`. See `packages/core/src/`.

## `@aicl/react`

React adapter. Hooks (`useChat`, `useReadable`) and headless, accessible primitives (`Composer`, `Transcript`, `MessageItem`, `PartRenderer`, `composer-surface`, `sessions`, `platform`). Bundles `lucide-react`, `react-markdown`, and `remark-gfm`. Peer-depends on `react` and `react-dom` (`>=18`). See `packages/react/src/`.

## `@aicl/server`

Framework-free server-side helpers: `createChatHandler`, `ChatResponse` (SSE framing), `ChatHandlerError`, and the `ChatHandlerRequest` contract. Mount the wrapped handler in any HTTP framework; the wrapper owns SSE framing, JSON serialisation, and 400/401 mapping. Depends only on `@aicl/core`. See `packages/server/src/`.

## `@aicl/styles`

Optional CSS-variable theme. Two themes (`light`, `dark`) plus a chat-shell reset and the `[data-aicl]` selector surface. Consumes nothing from the other packages; the React adapter exposes matching `data-*` attributes for state. See `packages/styles/src/`.
