# Tabs

A tablist and its panels. The selection is a pill that travels.

## Incorporation

Panels plus a pill that travels across equal columns, on the moderate spring. Arrow keys move the selection. Controlled and uncontrolled. Fluid also glides a hover highlight; the tour's Go to list is where that highlight lives.

| | |
| --- | --- |
| Shapes | **S2** compound, named subparts, **S3** provider and context hook, **S4** controlled and uncontrolled, **S7** slot DOM contract |
| Motion | **moderate** — `travelling-indicator` |
| LooseLeaf | [tabs](https://github.com/kevintngo/looseleaf/blob/4bdb647940e2fefb3cebb394f3bad25c766a27d2/registry.json) |
| Fluid Functionalism | [tabs](https://github.com/mickadesign/fluid-functionalism/blob/168d8d4982654f72da8f76df169eafb20e825409/registry.json) |
| Gallery | `examples/slice-1` section `motion` |
| Tour | stop `motion` |
| See it | The components gallery, section Motion, and the tour's Motion stop. |
| Source | `packages/react/src/tabs.tsx` |

## Usage

Reach for Tabs when a few panels share one frame. Arrow keys move, Home and End jump, and a disabled tab is skipped. `defaultValue` is the uncontrolled form.

Inactive panels stay mounted and are hidden. The travelling pill assumes equal columns. A page-level navigation is SidebarNav, not tabs.

```tsx
<Tabs defaultValue="plan">
  <Tabs.List aria-label="Work">
    <Tabs.Tab value="plan">Plan</Tabs.Tab>
    <Tabs.Tab value="files">Files</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="plan">The plan lives here.</Tabs.Panel>
  <Tabs.Panel value="files">Two files changed.</Tabs.Panel>
</Tabs>
```

Ask for `tabs`.

## Slots

- `tabs`
- `tabs-list`
- `tabs-indicator`
- `tabs-tab`
- `tabs-panel`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `active` `inactive` |
