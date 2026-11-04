# PartRenderer

Dispatches one part to its renderer. The default renderers follow.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** chat

## Install

```bash
npx aicl add part-renderer
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/part-renderer.json
```

## npm import

```ts
import { PartRenderer } from '@aicl/react';
```

## Usage

```tsx
import { PartRenderer } from '@aicl/react';

<PartRenderer part={part} />
```

## Slots

- `part`
- `reasoning`
- `reasoning-body`
- `tool-call`
- `tool-call-body`
- `artifact-card`
- `artifact-icon`
- `artifact-title`
- `artifact-meta`
- `artifact-kind`
- `artifact-version`
- `artifact-open`
- `code-block`
- `inline-code`
- `terminal-output`

## States

| Attribute | Values |
| --- | --- |
| `data-part` | `text` `reasoning` `tool-call` `tool-result` `artifact` `file` `error` `data-suggested-followups` `unknown` |
| `data-format` | `markdown` |
| `data-state` | `pending` `open` `closed` `uploading` `uploaded` |
| `data-status` | `pending` `running` `success` `error` `cancelled` |
| `data-open` | `true` |
| `data-is-error` | `true` |
| `data-retryable` | `true` |
| `data-raw-type` | `true` |
| `data-behavior` | `insert` |
| `data-language` | `true` |
| `data-copied` | `true` |
| `data-inline` | `true` |
| `data-streaming` | `true` |
| `data-following` | `true` |
| `data-openable` | `true` |

## Files

- `packages/react/src/parts.tsx` → `components/aicl/parts.tsx`
- `packages/react/src/markdown.tsx` → `components/aicl/markdown.tsx`

## Registry dependencies

`icon-slots`

## npm dependencies

`react`, `@aicl/core`, `react-markdown`, `remark-gfm`
