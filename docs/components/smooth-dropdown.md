# SmoothDropdown

A dropdown whose panel size springs to the content.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx-input

## Install

```bash
npx aicl add smooth-dropdown
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/smooth-dropdown.json
```

## npm import

```ts
import { SmoothDropdown } from '@aicl/fx';
```

## Usage

```tsx
import { SmoothDropdown } from '@aicl/fx';

<SmoothDropdown value={value} options={options} onChange={setValue} />
```

## Files

- `packages/fx/src/vendor/uselayouts/smooth-dropdown.tsx` → `components/aicl/fx/vendor/uselayouts/smooth-dropdown.tsx`

## Registry dependencies

`cn`, `fx-provider`

## npm dependencies

`react`, `motion`, `lucide-react`
