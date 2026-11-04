# Transcript

The conversation: a scroller, the rows, and jump-to-latest. One live region for the thread.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** chat

## Install

```bash
npx aicl add transcript
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/transcript.json
```

## npm import

```ts
import { Transcript } from '@aicl/react';
```

## Usage

```tsx
import { Transcript } from '@aicl/react';

<Transcript messages={chat.messages} status={chat.status} streamingId={chat.streamingId} />
```

## Slots

- `transcript-root`
- `transcript`
- `message-row`
- `message`
- `status-line`
- `day-separator`
- `scroll-to-bottom`
- `branch-switcher`

## States

| Attribute | Values |
| --- | --- |
| `data-status` | `idle` `submitted` `streaming` `aborted` `error` |
| `data-empty` | `true` |
| `data-at-bottom` | `true` |
| `data-role` | `user` `assistant` `system` |
| `data-alignment` | `end` `full` |
| `data-state` | `streaming` `complete` `aborted` |

## Files

- `packages/react/src/Transcript.tsx` → `components/aicl/Transcript.tsx`

## Registry dependencies

`icon-slots`, `message-actions`, `part-renderer`

## npm dependencies

`react`, `@aicl/core`
