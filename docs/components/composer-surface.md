# ComposerSurface

The composer surface: trigger menus, suggestion chips, attachments.

## Incorporation

Attachments and suggestion chips are slots on both composers. AICL's trigger menus (slash, mention) are the corpus behaviour those composers do not have.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S6** render-prop slots, **S7** slot DOM contract |
| Motion | **fast** — `indeterminate` |
| LooseLeaf | [attachment](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json), [prompt-input](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [input-message](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `trigger-menus` |
| Tour | — |
| See it | The components gallery: slash and mention menus, suggestion chips, attachment chips, and the dropzone. |
| Source | `packages/react/src/composer-surface.tsx` |

## Slots

- `trigger-menu`
- `trigger-menu-empty`
- `suggestion-chips`
- `suggestion-chip`
- `attachment-chip`
- `attachment-dropzone`
- `attachment-error`
- `attachment-icon`
- `attachment-name`
- `attachment-preview`
- `attachment-progress`
- `attachment-remove`
- `attachment-retry`
- `attachment-size`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `uploading` `uploaded` `error` |
| `data-empty` | `true` |
