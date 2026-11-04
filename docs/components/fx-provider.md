# FxProvider

Sets motion reducedMotion="user" and the data-fx scope vendored components assume.

**Type.** `registry:lib` · **Package.** `@aicl/fx` · **Category.** system

## Install

```bash
npx aicl add fx-provider
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/fx-provider.json
```

## npm import

```ts
import { FxProvider } from '@aicl/fx';
```

## Usage

```tsx
import { FxProvider } from '@aicl/fx';

<FxProvider>{children}</FxProvider>
```

## Files

- `packages/fx/src/lib/FxProvider.tsx` → `components/aicl/fx/lib/FxProvider.tsx`

## Registry dependencies

`cn`

## npm dependencies

`motion`, `react`
