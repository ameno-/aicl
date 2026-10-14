# AICL

**An open-source, framework-agnostic UI component library for AI chat applications.**

AICL is a set of small, well-typed packages that you drop into your own app to build the chat
surface. The library handles the model wire format, the streaming state machine, accessible
primitives, an optional theme and an optional set of animated, opinionated components. You bring
the backend, the auth and the visual design (or use the default).

The library was derived from a survey of 1,262 screens of four shipping agentic-chat products
([method](docs/CORPUS.md)) and crystallised into 14 [design decisions](docs/DECISIONS.md). It
runs the same in the browser and in Node and ships with end-to-end tests.

![Two chat surfaces built on the library: a dark "Build studio" and a Cofounder-style research panel](docs/screenshots/canvas-screens.png)

## The packages

| Package | Purpose | Runtime deps |
|---|---|---|
| [`@aicl/core`](packages/core/README.md) | Message model, `ChatController` state machine, SSE transport, session and toast stores. No DOM, no framework | none |
| [`@aicl/react`](packages/react/README.md) | `useChat` hook and unstyled, accessible primitives (`Transcript`, `Composer`, part renderers, sessions, dialogs, toasts) | `@aicl/core`, `lucide-react`, `react-markdown`, `remark-gfm` |
| [`@aicl/server`](packages/server/README.md) | `createChatHandler`: turns an async iterable of `StreamEvent` into SSE frames | `@aicl/core` |
| [`@aicl/styles`](packages/styles/README.md) | Optional CSS-variable theme for every `[data-aicl]` primitive, light and dark | none (CSS) |
| [`@aicl/fx`](packages/fx/README.md) | Optional animated, styled components (Tailwind v4, motion, WebGPU ambient). Source only | see package README |

Svelte and Vue adapters are placeholders for now (see `packages/svelte`, `packages/vue`).

## Install

The packages are unpublished (`version: 0.0.0`). Consume them from a checkout:

```jsonc
// your app's package.json
"dependencies": {
  "@aicl/core":   "file:../aicl/packages/core",
  "@aicl/react":  "file:../aicl/packages/react",
  "@aicl/server": "file:../aicl/packages/server",
  "@aicl/styles": "file:../aicl/packages/styles"
}
```

Then build the library once, because `core`, `react` and `server` resolve to `dist/`, which is
git-ignored:

```bash
cd aicl && npm install && npm run build
```

`@aicl/styles` and `@aicl/fx` ship source and need no build. If you bundle with Vite you can
alias the packages to their `src/` instead and skip the build for browser code; Node code still
needs `dist/`. Full adoption notes, including a Vite alias snippet: [`docs/ADOPTION.md`](docs/ADOPTION.md).

## A 30-second React chat

```tsx
import { createSseTransport } from '@aicl/core';
import { Composer, Transcript, useChat } from '@aicl/react';
import '@aicl/styles';

const transport = createSseTransport({ url: '/api/chat' });

export function Chat() {
  const chat = useChat({ transport, body: { model: 'my-model' } });
  return (
    <div data-theme="light">
      <Transcript
        messages={chat.messages}
        status={chat.status}
        streamingId={chat.streamingId}
      />
      <Composer
        status={chat.status}
        onSubmit={(text) => void chat.send(text)}
        onStop={chat.stop}
      />
    </div>
  );
}
```

The server side, custom message parts, styling, testing and every known sharp edge are covered
in [`docs/ADOPTION.md`](docs/ADOPTION.md). The wire contract and the conventions every adapter
agrees on live in [`docs/api/README.md`](docs/api/README.md).

## The rest of the repo

| Path | |
|---|---|
| `examples/slice-1` | Vite gallery of every React primitive in every state, plus an e2e suite |
| `examples/server-node` | Minimal `@aicl/server` handler on Node `http` |
| `apps/workspace` | Reference application built on the library: a chat, an infinite canvas, live tools and an exporter. Not part of the library API. |
| `docs/` | Architecture, decisions, corpus method, per-domain specs, evaluations, adoption guide |
| `droid-wiki/` | Contributor wiki, regenerated on demand; may lag the code |

The reference application is useful as a worked example of the library in a large app, but it
is not a starting point for your own chat UI. Start from `examples/slice-1` and `docs/ADOPTION.md`.

## Why it is built this way

- **Messages are ordered parts, not strings.** A reply interleaves reasoning, tool calls,
  results, prose and artifacts in one stream, and every surveyed product needs that
  ([D1](docs/DECISIONS.md)).
- **Three layers that change at different rates.** Conversation semantics in a dependency-free
  core, framework bindings in adapters, visuals in an optional theme
  ([architecture](docs/ARCHITECTURE.md)).
- **One wire.** A backend that yields AICL `StreamEvent`s drives every adapter
  ([wire contract](docs/api/README.md)).
- **Accessibility is behaviour, not a checklist.** IME-safe Enter, a single live region per
  transcript, `submitted` kept distinct from `streaming` so a send button never fires twice.
- **Primitives are unstyled.** The library ships no CSS beyond the optional theme. Every
  primitive marks itself with `data-aicl="<name>"` and exposes state as `data-*` attributes.
  Those attribute names are public API, because `@aicl/styles` and consumer CSS select on them.

## Develop

```bash
npm install            # root: npm workspaces over packages/*
npm run build          # tsc → packages/*/dist/  (required before running apps/examples)
npm run typecheck      # tsc --noEmit in every package
npm test               # node --test per package (core, react, server)
```

Node ≥ 22.6. There is no CI, so run these gates yourself before opening a PR. Per-package
READMEs list the tests and the sharp edges.

Contributing, or an AI agent working in this repo? Read [`AGENTS.md`](AGENTS.md) first.

## Status

Pre-release. Packages are `version: 0.0.0` and unpublished, so consume them from a checkout.
MIT licensed.
