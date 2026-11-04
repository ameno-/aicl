# Tooltip

A tip that shows on hover and on keyboard focus.

## Incorporation

Shows on hover and on keyboard focus, on the fast tier, and is hidden from assistive tech until it is open. It does not dodge the viewport. A collision-aware popover is still a candidate.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract |
| Motion | **fast** — `fade` |
| LooseLeaf | [tooltip](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [tooltip](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `content` |
| Tour | — |
| See it | The components gallery, section Content. |
| Source | `packages/react/src/content.tsx` |

## Usage

Reach for Tooltip to name a control on hover and keyboard focus. The child is the anchor.

It is positioned on the anchor. It does not flip when it would leave the viewport. A collision-aware popup is still a candidate. Tooltip content is not the place for an action.

```tsx
<Tooltip content="Copies the message">
  <Button variant="outline" size="sm" icon="copy">Copy</Button>
</Tooltip>
```

Ask for `tooltip`.

## Slots

- `tooltip-anchor`
- `tooltip`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
