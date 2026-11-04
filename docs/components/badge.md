# Badge

A small label that sits next to a word.

## Incorporation

A small label with a variant axis. Both libraries draw one; AICL publishes the variant and lets the skin decide the ink.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract |
| Motion | **fast** — `hover` |
| LooseLeaf | [badge](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [badge](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `content` |
| Tour | — |
| See it | The components gallery, section Content. |
| Source | `packages/react/src/content.tsx` |

## Usage

Reach for Badge as a short label beside a word: a count, a state, a version.

It is not a button. A status the person acts on is a Button or an Alert.

```tsx
<Badge variant="success">Live</Badge>
```

Ask for `badge` or `badges`.

## Slots

- `badge`

## States

| Attribute | Values |
| --- | --- |
| `data-variant` | `default` `secondary` `outline` `destructive` `success` |
