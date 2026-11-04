# ToastRegion

Transient status in a corner region. One live region, polite by default.

## Incorporation

One polite live region for transient status. The placement is an attribute, so a skin can move the pile.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract |
| Motion | **moderate** — `entrance` |
| LooseLeaf | [sonner](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | — none. This one is AICL's. |
| Gallery | `examples/slice-1` section `toasts` |
| Tour | — |
| See it | The components gallery, section Toasts. |
| Source | `packages/react/src/platform.tsx` |

## Usage

Reach for ToastRegion once, near the root, and give it a toast queue from `@aicl/core`. Toasts stack in that region.

The region is the live region. Rendering `Toast` alone does not announce or time anything.

```tsx
<ToastRegion queue={queue} />
```

This primitive is not a canvas input. It needs a conversation, a queue, or a portal the frame does not host. Use the example in the app.

## Slots

- `toast-region`

## States

| Attribute | Values |
| --- | --- |
| `data-placement` | `top-start` `top-center` `top-end` `bottom-start` `bottom-end` |
