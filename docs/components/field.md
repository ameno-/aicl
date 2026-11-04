# Field

A label, a control, a description, an error and a save acknowledgement.

## Incorporation

The words around a control: label, description, error, and a save acknowledgement. The save state is AICL's, from the settings corpus.

| | |
| --- | --- |
| Shapes | **S2** compound, named subparts, **S7** slot DOM contract |
| Motion | **fast** — `fade` |
| LooseLeaf | [field](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json), [label](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | — none. This one is AICL's. |
| Gallery | `examples/slice-1` section `forms` |
| Tour | — |
| See it | The components gallery, section Field. |
| Source | `packages/react/src/platform.tsx` |

## Usage

Reach for Field to pair a label, a description, and an error with one control. The child input receives the id and the aria attributes.

It expects exactly one React element as a child. It does not submit the form. `saveState` only announces the save.

```tsx
<Field label="API base URL" error="Must start with https://" required>
  <input value={url} onChange={(event) => setUrl(event.target.value)} />
</Field>
```

Ask for `field` or `form`.

## Slots

- `field`
- `field-label`
- `field-description`
- `field-error`
- `field-save-state`

## States

| Attribute | Values |
| --- | --- |
| `data-invalid` | `true` |
| `data-save-state` | `idle` `saving` `saved` `error` |
