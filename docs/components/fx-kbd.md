# Kbd (fx)

The animated keyboard hint. The headless primitive is `kbd`.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx-input

## Install

```bash
npx aicl add fx-kbd
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/fx-kbd.json
```

## npm import

```ts
import { Kbd } from '@aicl/fx';
```

## Usage

```tsx
import { Kbd } from '@aicl/fx';

<Kbd keys={['Meta', 'K']} />
```

## Files

- `packages/fx/src/vendor/spell-ui/kbd.tsx` → `components/aicl/fx/vendor/spell-ui/kbd.tsx`

## Registry dependencies

`cn`, `fx-provider`

## npm dependencies

`react`, `motion`, `lucide-react`
