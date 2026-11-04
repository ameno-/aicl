# Accordion

A list of disclosures. One open at a time, or several.

## Incorporation

A list of collapsible rows. Single closes the previous row; multiple keeps them. Both libraries animate the height and the chevron, and Fluid adds a hover highlight in grouped mode. AICL takes the height and the chevron.

| | |
| --- | --- |
| Shapes | **S2** compound, named subparts, **S3** provider and context hook, **S4** controlled and uncontrolled, **S7** slot DOM contract, **S9** icon slots |
| Motion | **moderate** — `height`, `chevron` |
| LooseLeaf | [accordion](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [accordion](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `motion` |
| Tour | stop `motion` |
| See it | The components gallery, section Motion, and the tour's Motion stop. |
| Source | `packages/react/src/disclosure.tsx` |

## Usage

Reach for Accordion for a list of folding rows. The default is one open row, and choosing another closes it. `type="multiple"` keeps the others open.

A single disclosure with no siblings is a Collapsible. The value is a string, or a string array when more than one row stays open.

```tsx
<Accordion defaultValue="read">
  <Accordion.Item value="read">
    <Accordion.Trigger>Read the diff</Accordion.Trigger>
    <Accordion.Panel>Opening the next row closes this one.</Accordion.Panel>
  </Accordion.Item>
</Accordion>
```

Ask for `accordion`.

## Slots

- `accordion`
- `accordion-item`
- `accordion-trigger`
- `accordion-label`
- `accordion-panel`
- `accordion-body`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
| `data-type` | `single` `multiple` |
