# SidebarNav

A vertical nav host with a controlled collapse.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** navigation

## Install

```bash
npx aicl add sidebar-nav
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/sidebar-nav.json
```

## npm import

```ts
import { SidebarNav } from '@aicl/react';
```

## Usage

```tsx
import { SidebarNav } from '@aicl/react';

<SidebarNav ariaLabel="Primary" items={items} collapsed={collapsed} onCollapsedChange={setCollapsed} />
```

## Slots

- `sidebar-nav`
- `sidebar-nav-header`
- `sidebar-nav-list`
- `sidebar-nav-item`
- `sidebar-nav-icon`
- `sidebar-nav-label`
- `sidebar-nav-badge`
- `sidebar-nav-toggle`
- `sidebar-nav-footer`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `collapsed` `expanded` |
| `data-active` | `true` |
| `data-collapsed` | `true` |
| `data-count` | `true` |

## Files

- `packages/react/src/sessions.tsx` → `components/aicl/sessions.tsx`

## Registry dependencies

`icon-slots`, `use-readable`

## npm dependencies

`react`, `@aicl/core`
