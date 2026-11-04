# SidebarNav

A vertical nav host with a controlled collapse.

## Incorporation

The collapsible nav is the piece of both sidebars a chat app actually needs. The sixteen sidebar blocks stay candidates for the registry.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract, **S9** icon slots |
| Motion | **moderate** — `fade` |
| LooseLeaf | [sidebar](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [sidebar](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `sidebar-nav` |
| Tour | — |
| See it | The components gallery, section Sidebar nav. |
| Source | `packages/react/src/sessions.tsx` |

## Usage

Reach for SidebarNav as the vertical nav. Pass the items, and `collapsed` when the rail is icon-only.

It does not own the route. `onSelect` is the navigation.

```tsx
<SidebarNav
  items={[{ id: 'chats', label: 'Chats', active: true }]}
  onNavigate={go}
/>
```

This primitive is not a canvas input. It needs a conversation, a queue, or a portal the frame does not host. Use the example in the app.

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
