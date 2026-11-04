# ModelPicker

A model menu on a smooth dropdown.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx-input

## Install

```bash
npx aicl add model-picker
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/model-picker.json
```

## npm import

```ts
import { ModelPicker } from '@aicl/fx';
```

## Usage

```tsx
import { ModelPicker } from '@aicl/fx';

<ModelPicker value={model} onChange={setModel} options={models} />
```

## Files

- `packages/fx/src/components/input/ModelPicker.tsx` → `components/aicl/fx/components/input/ModelPicker.tsx`

## Registry dependencies

`cn`, `fx-provider`, `smooth-dropdown`

## npm dependencies

`react`, `motion`, `lucide-react`
