# Button

A button. Variant, size and loading, with the glyphs as icon slots.

## Incorporation

Both libraries ship a button with variants, a size ladder, a loading state and icon slots. AICL publishes those as attributes and resolves the glyphs through the icon provider. The press distance comes from the experience tokens, so a skin can sit the button down.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract, **S8** size ladder, **S9** icon slots |
| Motion | **fast** — `hover`, `press` |
| LooseLeaf | [button](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [button](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `buttons` |
| Tour | stop `button` |
| See it | The components gallery, section Button, and the first stop of the tour. |
| Source | `packages/react/src/Button.tsx` |

## Usage

Reach for Button for every action a person takes. Pass `type="submit"` inside a form; the default is `type="button"`, so a chat send does not fire twice.

Loading keeps the button focusable and the same size. It does not disable it. The glyph is an icon role (`icon`, `trailingIcon`), resolved through `IconProvider`, not an imported icon.

```tsx
<Button variant="outline" size="sm" icon="copy">Copy</Button>
```

Ask for `button`.

## Slots

- `button`
- `button-label`
- `button-icon`

## States

| Attribute | Values |
| --- | --- |
| `data-variant` | `default` `secondary` `destructive` `ghost` `outline` `link` |
| `data-size` | `sm` `md` `lg` |
| `data-loading` | `true` |
| `data-icon` | `true` |
