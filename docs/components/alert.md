# Alert

A status message that arrives and stays. Title and description are subparts.

## Incorporation

A durable status message with a title and a description. Fluid exports a motion config for the banner; AICL uses the slow entrance spring and the experience tokens instead of a second runtime.

| | |
| --- | --- |
| Shapes | **S2** compound, named subparts, **S7** slot DOM contract, **S9** icon slots |
| Motion | **slow** — `entrance` |
| LooseLeaf | [alert](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [banner](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `content` |
| Tour | — |
| See it | The components gallery, section Content. |
| Source | `packages/react/src/content.tsx` |

## Usage

Reach for Alert for a status the person must see in place: information, success, a warning, or a destructive failure. Use `Alert.Title` and `Alert.Description`.

It does not ask for a decision. A confirm-or-cancel is an AlertDialog. It is not a toast.

```tsx
<Alert variant="warning">
  <Alert.Title>Needs you</Alert.Title>
  <Alert.Description>Approve the command before the agent continues.</Alert.Description>
</Alert>
```

Ask for `alert` or `warning`.

## Slots

- `alert`
- `alert-icon`
- `alert-body`
- `alert-title`
- `alert-description`

## States

| Attribute | Values |
| --- | --- |
| `data-variant` | `info` `success` `warning` `destructive` |
