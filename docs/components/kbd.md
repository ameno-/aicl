# Kbd

A keyboard key, drawn as a keycap.

## Incorporation

A keycap that presses flat. LooseLeaf draws the cap; Fluid only formats shortcut strings inside the command menu. AICL ships the cap, and the command menu remains a candidate.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract |
| Motion | **fast** — `press` |
| LooseLeaf | [kbd](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | — none. This one is AICL's. |
| Gallery | `examples/slice-1` section `content` |
| Tour | — |
| See it | The components gallery, section Content. |
| Source | `packages/react/src/content.tsx` |

## Usage

Reach for Kbd as a keycap in a hint: the shortcut that does the thing.

It does not listen for the key. It is the label.

```tsx
<span>Open the palette <Kbd>⌘K</Kbd></span>
```

Ask for `kbd`, `keycap`, or `shortcut`.

## Slots

- `kbd`

## States

This primitive publishes no state attributes.
