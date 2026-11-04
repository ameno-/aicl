# Spinner

A spinning status glyph. The glyph is the spinner icon slot.

## Incorporation

A status glyph that spins, through the spinner icon slot, with an accessible name. Fluid's thinking indicator morphs a path and cycles text; that one is still a candidate. This is the plain working state.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract, **S9** icon slots |
| Motion | **fast** — `spin` |
| LooseLeaf | [spinner](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | — none. This one is AICL's. |
| Gallery | `examples/slice-1` section `motion` |
| Tour | stop `motion` |
| See it | The components gallery, section Motion, and the tour's Motion stop. |
| Source | `packages/react/src/content.tsx` |

## Usage

Reach for Spinner as the working mark beside a label. Pass `label` so the work is announced.

It does not reserve the space of the thing that will arrive. A region uses Skeleton for that.

```tsx
<Spinner label="Thinking" />
```

Ask for `spinner`.

## Slots

- `spinner`

## States

This primitive publishes no state attributes.
