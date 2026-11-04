# SessionList

A host-agnostic session listbox, grouped by recency.

## Incorporation

Both libraries have a sidebar of rows. AICL's list is grouped by recency, which is the corpus pattern, and the loading rows shimmer.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract |
| Motion | **fast** — `shimmer` |
| LooseLeaf | [sidebar](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [sidebar](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `session-list` |
| Tour | stop `sessions` |
| See it | The components gallery, section Session list, and the tour's Sessions stop. |
| Source | `packages/react/src/sessions.tsx` |

## Usage

Reach for SessionList as the list of past chats, grouped by recency. Each row is a `SessionListItem`.

It does not load or persist sessions. Pass the groups you already have. `relativeTime` formats a timestamp; it is not a clock.

```tsx
<SessionList
  groups={[{ id: 'today', label: 'Today', ids: ['s1'] }]}
  byId={{ s1: { id: 's1', title: 'Double submit' } }}
  onSelect={open}
/>
```

This primitive is not a canvas input. It needs a conversation, a queue, or a portal the frame does not host. Use the example in the app.

## Slots

- `session-list`
- `session-list-header`
- `session-listbox`
- `session-list-empty`
- `session-list-skeleton`
- `session-list-sentinel`
- `session-skeleton`
- `session-item`
- `session-actions`
- `session-title`
- `session-secondary`
- `session-group`
- `session-group-label`

## States

| Attribute | Values |
| --- | --- |
| `data-empty` | `true` |
| `data-active` | `true` |
| `data-selected` | `true` |
