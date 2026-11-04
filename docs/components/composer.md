# Composer

The field, the submit action, the toolbar slots and the above-band.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** chat

## Install

```bash
npx aicl add composer
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/composer.json
```

## npm import

```ts
import { Composer } from '@aicl/react';
```

## Usage

```tsx
import { Composer } from '@aicl/react';

<Composer status={chat.status} onSubmit={(text) => void chat.send(text)} onStop={chat.stop} />
```

## Slots

- `composer`
- `composer-body`
- `composer-input`
- `composer-submit`
- `composer-attach`
- `composer-disabled-reason`
- `composer-hint`
- `attachment-row`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `ready` `submitted` `streaming` `aborted` |
| `data-placement` | `docked` `hero` `rail` |
| `data-has-text` | `true` |
| `data-has-attachments` | `true` |
| `data-role` | `send` `stop` |

## Files

- `packages/react/src/Composer.tsx` → `components/aicl/Composer.tsx`

## Registry dependencies

`icon-slots`, `composer-surface`

## npm dependencies

`react`, `@aicl/core`
