# Switch

A toggle. The label is a real label, not a placeholder for one.

## Incorporation

A thumb that travels. Both libraries spring it; AICL uses the fast tier. The label is a real label.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract |
| Motion | **fast** — `thumb` |
| LooseLeaf | [switch](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [switch](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `forms` |
| Tour | stop `choice` |
| See it | The components gallery, section Field, and the tour's Choice stop. |
| Source | `packages/react/src/platform.tsx` |

## Usage

Reach for Switch as a boolean setting whose label is a real label.

It is controlled. Roll `checked` back yourself when a save fails; `status="error"` only marks the failure.

```tsx
<Switch checked={on} onCheckedChange={setOn} label="Stream reasoning" />
```

Ask for `switch` or `toggle`.

## Slots

- `switch`
- `switch-root`
- `switch-label`
- `switch-thumb`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `checked` `unchecked` |
| `data-disabled` | `true` |
| `data-busy` | `true` |
| `data-error` | `true` |
