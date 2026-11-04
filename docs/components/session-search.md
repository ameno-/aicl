# SessionSearch

One incremental combobox for sessions.

## Incorporation

A command palette is the sample shape and is still a candidate. This search is narrower: one combobox over the sessions the host already has.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract, **S9** icon slots |
| Motion | **fast** — `fade` |
| LooseLeaf | — none. This one is AICL's. |
| Fluid Functionalism | — none. This one is AICL's. |
| Gallery | `examples/slice-1` section `session-search` |
| Tour | — |
| See it | The components gallery, section Session search. |
| Source | `packages/react/src/sessions.tsx` |

## Usage

Reach for SessionSearch as one combobox over the session titles. It filters as the person types.

It searches the list you pass. It does not query a server.

```tsx
<SessionSearch
  value={query}
  onChange={setQuery}
  groups={[{ id: 'today', ids: ['s1'] }]}
  byId={{ s1: { id: 's1', title: 'Double submit' } }}
  onSelect={open}
/>
```

This primitive is not a canvas input. It needs a conversation, a queue, or a portal the frame does not host. Use the example in the app.

## Slots

- `session-search`
- `session-search-icon`
- `session-search-input`
- `session-search-results`
- `session-search-status`
- `session-search-empty`

## States

| Attribute | Values |
| --- | --- |
| `data-empty` | `true` |
| `data-count` | `true` |
