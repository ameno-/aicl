# Kbd

A keyboard hint. Pass keys for a chord, or children for free text.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** content

## Install

```bash
npx aicl add kbd
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/kbd.json
```

## npm import

```ts
import { Kbd } from '@aicl/react';
```

## Usage

```tsx
import { Kbd } from '@aicl/react';

<Kbd keys={['Meta', 'K']} />
```

## Slots

- `kbd`
- `kbd-key`

## Files

- `packages/react/src/Kbd.tsx` → `components/aicl/Kbd.tsx`

## Registry dependencies

_none_

## npm dependencies

`react`, `@aicl/core`
