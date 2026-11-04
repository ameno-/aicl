# Tabs

One tab stop, arrows move, a travelling pill follows the selected tab.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** content

## Install

```bash
npx aicl add tabs
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/tabs.json
```

## npm import

```ts
import { Tabs } from '@aicl/react';
```

## Usage

```tsx
import { Tabs } from '@aicl/react';

<Tabs defaultValue="chat">
  <Tabs.List>
    <Tabs.Tab value="chat">Chat</Tabs.Tab>
    <Tabs.Tab value="files">Files</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="chat">The thread.</Tabs.Panel>
  <Tabs.Panel value="files">The tree.</Tabs.Panel>
</Tabs>
```

## Slots

- `tabs`
- `tabs-list`
- `tabs-tab`
- `tabs-indicator`
- `tabs-panel`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `active` `inactive` |

## Files

- `packages/react/src/Tabs.tsx` → `components/aicl/Tabs.tsx`
- `packages/react/src/controllable.ts` → `components/aicl/controllable.ts`

## Registry dependencies

_none_

## npm dependencies

`react`, `@aicl/core`
