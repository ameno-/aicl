# Collapsible

One panel that folds. The height animates, and the chevron turns.

## Incorporation

One panel. The height animates by opening the grid row, and the chevron turns on the same spring. Closed content stays mounted and is not readable or tabbable. The reasoning disclosure stays the chat-specific one.

| | |
| --- | --- |
| Shapes | **S2** compound, named subparts, **S4** controlled and uncontrolled, **S7** slot DOM contract, **S9** icon slots |
| Motion | **moderate** — `height`, `chevron` |
| LooseLeaf | [collapsible](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [accordion](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `motion` |
| Tour | stop `motion` |
| See it | The components gallery, section Motion, and the tour's Motion stop. |
| Source | `packages/react/src/disclosure.tsx` |

## Usage

Reach for Collapsible for one region that folds. The trigger and the panel are the two parts. Closed content stays mounted and is hidden from reading and tabbing.

It does not close its neighbours. A list of exclusive rows is an Accordion.

```tsx
<Collapsible>
  <Collapsible.Trigger>Worked for 11s</Collapsible.Trigger>
  <Collapsible.Panel>Edited two files.</Collapsible.Panel>
</Collapsible>
```

Ask for `collapsible` or `worked for`.

## Slots

- `collapsible`
- `collapsible-trigger`
- `collapsible-label`
- `collapsible-panel`
- `collapsible-body`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
