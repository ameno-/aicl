# PlanChecklist

An ordered plan with a derived rollup. Render only.

## Incorporation

Neither sample has a plan rollup. This one is AICL's, from the corpus: an ordered list and a derived count, render only.

| | |
| --- | --- |
| Shapes | **S1** flat primitive, **S7** slot DOM contract |
| Motion | Still. This component does not animate. |
| LooseLeaf | — none. This one is AICL's. |
| Fluid Functionalism | — none. This one is AICL's. |
| Gallery | — |
| Tour | — |
| See it | examples/slice-1/Gallery.tsx renders a plan inside the thread. |
| Source | `packages/react/src/PlanChecklist.tsx` |

## Usage

Reach for PlanChecklist to show an ordered plan and a done/total rollup. Each item is `pending`, `running`, `done`, or `error`.

It renders. It does not advance the items. The caller owns the list.

```tsx
<PlanChecklist
  title="Ship the frame"
  items={[
    { id: '1', label: 'Name the inputs', status: 'done' },
    { id: '2', label: 'Place them on the frame', status: 'running' },
  ]}
/>
```

Ask for `plan` or `checklist`.

## Slots

- `plan-checklist`
- `plan-rollup`
- `plan-title`
- `plan-count`

## States

| Attribute | Values |
| --- | --- |
| `data-count` | `true` |
| `data-progress` | `true` |
