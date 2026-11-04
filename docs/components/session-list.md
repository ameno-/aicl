# SessionList

A host-agnostic session listbox, grouped by recency.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** navigation

## Install

```bash
npx aicl add session-list
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/session-list.json
```

## npm import

```ts
import { SessionList } from '@aicl/react';
```

## Usage

```tsx
import { SessionList } from '@aicl/react';

<SessionList ariaLabel="Sessions" groups={groups} byId={byId} activeId={id} onSelect={setId} />
```

## Slots

- `session-list`
- `session-list-header`
- `session-listbox`
- `session-list-empty`
- `session-list-skeleton`
- `session-list-sentinel`
- `session-skeleton`
- `session-item`
- `session-actions`
- `session-title`
- `session-secondary`
- `session-group`
- `session-group-label`

## States

| Attribute | Values |
| --- | --- |
| `data-empty` | `true` |
| `data-active` | `true` |
| `data-selected` | `true` |

## Files

- `packages/react/src/sessions.tsx` → `components/aicl/sessions.tsx`

## Registry dependencies

`icon-slots`, `use-readable`

## npm dependencies

`react`, `@aicl/core`
