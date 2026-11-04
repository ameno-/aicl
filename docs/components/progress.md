# Progress

A progress bar. Determinate when it has a value, travelling when it does not.

## Incorporation

Determinate fill on the moderate spring, and an indeterminate bar that travels when the value is unknown. LooseLeaf hatches the track; AICL uses the accent and the same indeterminate motion as an upload.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract |
| Motion | **moderate** — `fill`, `indeterminate` |
| LooseLeaf | [progress](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | — none. This one is AICL's. |
| Gallery | `examples/slice-1` section `motion` |
| Tour | stop `motion` |
| See it | The components gallery, section Motion, and the tour's Motion stop. |
| Source | `packages/react/src/content.tsx` |

## Usage

Reach for Progress as a bar. Pass `value` from 0 to 100 when you know it. Omit `value` for an indeterminate bar.

The label is announced. The bar does not estimate a duration.

```tsx
<Progress value={40} label="Tokens" />
```

Ask for `progress`.

## Slots

- `progress`
- `progress-bar`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `determinate` `indeterminate` |
