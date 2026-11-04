# SegmentedControl

One tab stop, arrow keys move and select.

## Incorporation

The selection is a pill that travels across equal columns, which is Fluid's tab motion and LooseLeaf's lifted tab. Arrow keys move and select. It is a radiogroup, not a set of panels — panels are Tabs.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract, **S9** icon slots |
| Motion | **moderate** — `travelling-indicator` |
| LooseLeaf | [toggle-group](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json), [tabs](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [tabs](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `forms` |
| Tour | stop `choice` |
| See it | The components gallery, section Field, and the tour's Choice stop. |
| Source | `packages/react/src/platform.tsx` |

## Usage

Reach for SegmentedControl when a few options are always visible. Arrow keys move and select. It is one tab stop.

It is controlled. The travelling pill assumes equal columns, 2px of padding, and a 2px gap.

```tsx
<SegmentedControl
  ariaLabel="Layout"
  value={layout}
  onValueChange={setLayout}
  options={[
    { value: 'list', label: 'List' },
    { value: 'grid', label: 'Grid' },
  ]}
/>
```

Ask for `segmented` or `choice`.

## Slots

- `segmented`
- `segmented-indicator`
- `segmented-item`
- `segmented-icon`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `selected` `unselected` |
| `data-size` | `sm` `md` |
