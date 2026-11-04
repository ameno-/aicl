# Select

A listbox trigger with typeahead.

## Incorporation

A listbox trigger with typeahead. The shared popup chrome both libraries factor out is still a candidate; this select carries its own list.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract, **S9** icon slots |
| Motion | **moderate** — `entrance` |
| LooseLeaf | [select](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [select](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `forms` |
| Tour | stop `choice` |
| See it | The components gallery, section Field, and the tour's Choice stop. |
| Source | `packages/react/src/platform.tsx` |

## Usage

Reach for Select as a single-choice listbox with typeahead. Options are `{ value, label }`.

It is controlled. It is not a combobox: the person picks, they do not author a new value.

```tsx
<Select
  ariaLabel="Model"
  value={model}
  onValueChange={setModel}
  options={[{ value: 'sonnet', label: 'Sonnet 5.5' }]}
/>
```

Ask for `select` or `model picker`.

## Slots

- `select`
- `select-trigger`
- `select-value`
- `select-listbox`
- `select-option-label`
- `select-option-description`
- `select-option-check`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
| `data-size` | `sm` `md` |
| `data-selected` | `true` |
| `data-disabled` | `true` |
