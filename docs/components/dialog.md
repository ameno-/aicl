# Dialog

A modal on the top layer, with a focus trap and a focus return.

## Incorporation

A modal that lands and then gets out of the way. The entrance uses the slow spring and the experience tokens, so a skin can tip the sheet as it arrives. Focus trap and focus return stay ours.

| | |
| --- | --- |
| Shapes | **S2** compound, named subparts, **S7** slot DOM contract |
| Motion | **slow** — `entrance`, `exit` |
| LooseLeaf | [dialog](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [dialog](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `overlays` |
| Tour | stop `dialog` |
| See it | The components gallery, section Dialog, and the tour's Dialog stop. |
| Source | `packages/react/src/platform.tsx` |

## Usage

Reach for Dialog as a modal. It traps focus, returns focus, and dismisses on Escape and the scrim unless you say otherwise.

It is controlled: `open` and `onOpenChange`. A dirty dialog can veto dismissal through `onDismissRequest`. It portals to the document.

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <Dialog.Title>Rename session</Dialog.Title>
  <Dialog.Description>The name is what the sidebar shows.</Dialog.Description>
  <Dialog.Close>Cancel</Dialog.Close>
</Dialog>
```

This primitive is not a canvas input. It needs a conversation, a queue, or a portal the frame does not host. Use the example in the app.

## Slots

- `dialog`
- `dialog-layer`
- `dialog-title`
- `dialog-description`
- `dialog-close`
- `scrim`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
| `data-size` | `sm` `md` `lg` |
