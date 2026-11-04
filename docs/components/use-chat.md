# useChat

Binds a ChatController to React. Status, messages, send, stop, and the streaming id.

**Type.** `registry:hook` · **Package.** `@aicl/react` · **Category.** hook

## Install

```bash
npx aicl add use-chat
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/use-chat.json
```

## npm import

```ts
import { useChat } from '@aicl/react';
```

## Usage

```tsx
import { useChat } from '@aicl/react';
import { createSseTransport } from '@aicl/core';

const chat = useChat({ transport: createSseTransport({ url: '/api/chat' }) });
```

## Files

- `packages/react/src/useChat.ts` → `hooks/use-chat.ts`

## Registry dependencies

_none_

## npm dependencies

`react`, `@aicl/core`
