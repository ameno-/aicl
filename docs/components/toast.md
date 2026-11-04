# Toast

One transient status message, with an optional action.

## Incorporation

A toast arrives and leaves. Fluid's banner is the durable cousin; the alert primitive is that. A toast is the transient one.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract, **S9** icon slots |
| Motion | **moderate** — `entrance`, `exit` |
| LooseLeaf | [sonner](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [banner](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `toasts` |
| Tour | — |
| See it | The components gallery, section Toasts. |
| Source | `packages/react/src/platform.tsx` |

## Usage

Reach for Toast as one transient status, usually rendered by the region. Give it a title and, when there is a next step, an action.

It does not time itself out. The queue does.

```tsx
<Toast
  toast={{ id: 'copied', title: 'Copied', variant: 'success', paused: false }}
  onDismiss={dismiss}
/>
```

This primitive is not a canvas input. It needs a conversation, a queue, or a portal the frame does not host. Use the example in the app.

## Slots

- `toast`
- `toast-icon`
- `toast-title`
- `toast-description`
- `toast-action`
- `toast-dismiss`

## States

| Attribute | Values |
| --- | --- |
| `data-variant` | `info` `success` `error` |
