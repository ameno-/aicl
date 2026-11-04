# QuestionCard

A single question with options. The narrow form of Fluid's ask-user-questions.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx-input

## Install

```bash
npx aicl add question-card
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/question-card.json
```

## npm import

```ts
import { QuestionCard } from '@aicl/fx';
```

## Usage

```tsx
import { QuestionCard } from '@aicl/fx';

<QuestionCard question="Which one?" options={options} onAnswer={answer} />
```

## Files

- `packages/fx/src/components/input/QuestionCard.tsx` → `components/aicl/fx/components/input/QuestionCard.tsx`

## Registry dependencies

`cn`, `fx-provider`

## npm dependencies

`react`, `motion`, `lucide-react`
