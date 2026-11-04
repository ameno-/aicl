# Empty

What a region says when it has nothing in it yet.

## Incorporation

A title, an explanation and an action, for a region with nothing in it. LooseLeaf draws a mascot beside it; AICL leaves the picture to the icon slot the caller passes.

| | |
| --- | --- |
| Shapes | **S2** compound, named subparts, **S7** slot DOM contract |
| Motion | **moderate** — `fade` |
| LooseLeaf | [empty](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | — none. This one is AICL's. |
| Gallery | `examples/slice-1` section `content` |
| Tour | — |
| See it | The components gallery, section Content. |
| Source | `packages/react/src/content.tsx` |

## Usage

Reach for Empty when a region has finished loading and has nothing to show. Give it a title, a description, and the action that fills it.

It is not a skeleton and not an error. Use it once the request has settled.

```tsx
<Empty>
  <Empty.Title>No sessions yet</Empty.Title>
  <Empty.Description>Start one from the composer.</Empty.Description>
  <Empty.Actions>
    <Button size="sm">New session</Button>
  </Empty.Actions>
</Empty>
```

Ask for `empty` or `no sessions`.

## Slots

- `empty`
- `empty-title`
- `empty-description`
- `empty-actions`

## States

This primitive publishes no state attributes.
