# MessageActions

The per-message action row. Hidden until the row is hovered or focused.

## Incorporation

Fluid reveals the action row on hover. AICL does the same and also reveals it on keyboard focus, which the corpus requires. Copy, retry and feedback stay role-scoped.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract, **S9** icon slots |
| Motion | **fast** — `hover` |
| LooseLeaf | [message](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [chat-message](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | — |
| Tour | stop `transcript` |
| See it | On a completed message, in the tour's Transcript stop. |
| Source | `packages/react/src/MessageActions.tsx` |

## Usage

Reach for MessageActions as the per-message row: copy, retry, edit. It stays hidden until the row is hovered or focused.

The buttons call `onAction`. Wiring them to `useChat` is the caller's job; the transcript does not do it for the default row.

```tsx
<MessageActions message={message} actions={['copy', 'retry']} onAction={onAction} />
```

This primitive is not a canvas input. It needs a conversation, a queue, or a portal the frame does not host. Use the example in the app.

## Slots

- `message-actions`

## States

| Attribute | Values |
| --- | --- |
| `data-visibility` | `auto` `always` |
| `data-resolved` | `painted` |
| `data-feedback` | `up` `down` `none` |
| `data-role` | `user` `assistant` `system` |
| `data-copied` | `true` |
