# Transcript

The conversation: a scroller, the rows, and jump-to-latest. One live region for the thread.

## Incorporation

LooseLeaf splits the scroller from the row, and Fluid puts the actions in a hover-revealed meta line. AICL keeps one live region for the whole thread and lets a message arrive rather than pop. Streaming, parts and branching stay ours.

| | |
| --- | --- |
| Shapes | **S2** compound, named subparts, **S3** provider and context hook, **S7** slot DOM contract |
| Motion | **moderate** — `entrance` |
| LooseLeaf | [message-scroller](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json), [message](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [chat-message](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | — |
| Tour | stop `transcript` |
| See it | The tour's Transcript stop, and the live thread in examples/slice-1. |
| Source | `packages/react/src/Transcript.tsx` |

## Slots

- `transcript-root`
- `transcript`
- `message-row`
- `message`
- `status-line`
- `day-separator`
- `scroll-to-bottom`
- `branch-switcher`

## States

| Attribute | Values |
| --- | --- |
| `data-status` | `idle` `submitted` `streaming` `aborted` `error` |
| `data-empty` | `true` |
| `data-at-bottom` | `true` |
| `data-role` | `user` `assistant` `system` |
| `data-alignment` | `end` `full` |
| `data-state` | `streaming` `complete` `aborted` |
