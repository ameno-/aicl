# Card

A sheet with a header, a body and a footer.

## Incorporation

Header, title, description, body, footer. Both libraries compose a card this way. The elevation is the shadow ladder, and the card itself does not move.

| | |
| --- | --- |
| Shapes | **S2** compound, named subparts, **S7** slot DOM contract |
| Motion | Still. This component does not animate. |
| LooseLeaf | [card](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [card](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `content` |
| Tour | — |
| See it | The components gallery, section Content. |
| Source | `packages/react/src/content.tsx` |

## Usage

Reach for Card to group a title, a description, a body, and a footer. The slots are `Card.Header`, `Card.Title`, `Card.Description`, `Card.Body`, and `Card.Footer`.

It does not link anywhere. A card the person opens is a button or a link around the content you choose.

```tsx
<Card>
  <Card.Header>
    <Card.Title>Plan</Card.Title>
    <Card.Description>Three steps, one of them done.</Card.Description>
  </Card.Header>
  <Card.Body>Write the failing test, then the primitive, then the gallery.</Card.Body>
</Card>
```

Ask for `card`.

## Slots

- `card`
- `card-header`
- `card-title`
- `card-description`
- `card-body`
- `card-footer`

## States

This primitive publishes no state attributes.
