# AlertDialog

A modal that asks before it acts. The scrim does not dismiss it.

## Incorporation

LooseLeaf's alert dialog cannot be dismissed by the scrim. AICL keeps that, and adds a typed confirmation for the destructive case.

| | |
| --- | --- |
| Shapes | **S2** compound, named subparts, **S7** slot DOM contract |
| Motion | **slow** — `entrance` |
| LooseLeaf | [alert-dialog](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [dialog](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `overlays` |
| Tour | — |
| See it | The components gallery, in the overlays section. |
| Source | `packages/react/src/platform.tsx` |

## Slots

- `alert-dialog`
- `alert-dialog-layer`
- `alert-dialog-actions`
- `alert-dialog-cancel`
- `alert-dialog-confirm`
- `alert-dialog-confirmation`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
| `data-busy` | `true` |
