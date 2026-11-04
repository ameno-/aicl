# Drawer

A sheet that slides in from an edge. Swipe to dismiss.

## Incorporation

A sheet from the edge. LooseLeaf has both a drawer and a sheet; Fluid has a mobile drawer. AICL ships one, with a side and a swipe to dismiss.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract |
| Motion | **moderate** — `entrance` |
| LooseLeaf | [drawer](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json), [sheet](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [mobile-drawer](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `overlays` |
| Tour | — |
| See it | The components gallery, in the overlays section. |
| Source | `packages/react/src/platform.tsx` |

## Slots

- `drawer`
- `drawer-layer`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
| `data-side` | `start` `end` |
