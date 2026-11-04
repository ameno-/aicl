# PartRenderer

Dispatches one part to its renderer. The default renderers follow.

## Incorporation

A code block, a file chip and a typing row exist in both libraries as separate components. AICL keeps them as part renderers on one registry, so an unknown part cannot blank the thread. The morphing thinking indicator and the sequential thinking steps are still candidates.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract |
| Motion | **fast** — `fade` |
| LooseLeaf | [code-block](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json), [attachment](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json), [typing-indicator](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [file-thumbnail](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | — |
| Tour | stop `transcript` |
| See it | Inside every transcript row. The live thread in examples/slice-1 renders the default parts. |
| Source | `packages/react/src/parts.tsx`, `packages/react/src/markdown.tsx` |

## Usage

Reach for PartRenderer inside a message row when you render parts yourself. It dispatches one part to the registry.

A custom registry matches exact part type names. A `data-` wildcard is ignored, and an unknown part renders `UnknownPart`.

```tsx
<PartRenderer part={part} />
```

This primitive is not a canvas input. It needs a conversation, a queue, or a portal the frame does not host. Use the example in the app.

## Slots

- `part`
- `reasoning`
- `reasoning-body`
- `tool-call`
- `tool-call-body`
- `artifact-card`
- `artifact-icon`
- `artifact-title`
- `artifact-meta`
- `artifact-kind`
- `artifact-version`
- `artifact-open`
- `code-block`
- `inline-code`
- `terminal-output`

## States

| Attribute | Values |
| --- | --- |
| `data-part` | `text` `reasoning` `tool-call` `tool-result` `artifact` `file` `error` `data-suggested-followups` `unknown` |
| `data-format` | `markdown` |
| `data-state` | `pending` `open` `closed` `uploading` `uploaded` |
| `data-status` | `pending` `running` `success` `error` `cancelled` |
| `data-open` | `true` |
| `data-is-error` | `true` |
| `data-retryable` | `true` |
| `data-raw-type` | `true` |
| `data-behavior` | `insert` |
| `data-language` | `true` |
| `data-copied` | `true` |
| `data-inline` | `true` |
| `data-streaming` | `true` |
| `data-following` | `true` |
| `data-openable` | `true` |
