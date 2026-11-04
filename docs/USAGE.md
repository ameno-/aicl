# Using AICL

How to put a primitive on a screen, and how to prompt a screen out of the
primitives the library actually exports.

[`ADOPTION.md`](ADOPTION.md) is the wire: install, stream, render a
conversation. This page is the components. The contract
([`components.md`](components.md)) names every slot. Each primitive's page
adds the usage record: when to reach for it, the smallest example, and what
it leaves alone.

## What you can do today

You can compose a chat surface from the primitives in `@aicl/react`, paint
it with `@aicl/styles`, and move it with `@aicl/motion`. You can prompt a
frame in the gallery and read the JSX back. The prompt's vocabulary is the
palette. A word the library does not export is refused.

```bash
cd examples/slice-1 && npm install && npm run dev
# http://127.0.0.1:5179/?view=canvas
```

A first visit opens `warning alert, a plan card, tabs, and an empty state`.
The same sentence through `composePrompt` (`packages/react/src/compose.ts`)
returns the same blocks and the same JSX. The palette toggles an input and
rewrites the prompt as that input's phrase, so the address bar stays the
composition.

```ts
import { composePrompt } from '@aicl/react';

const screen = composePrompt('warning alert and a tooltip, plus a popover');
// screen.blocks  → ['alert', 'tooltip']
// screen.refused → ['Popover']
// screen.jsx     → the snippet the frame is showing
```

## What you still bring yourself

The packages are unpublished (`version: 0.0.0`). You install them from a
checkout, and you build `dist/` before Node can import `@aicl/core`,
`@aicl/react`, or `@aicl/server`. The steps and the sharp edges are in
[`ADOPTION.md`](ADOPTION.md).

These are designs, not code:

- `npx aicl add` and the shadcn registry. [`LIBRARY.md`](LIBRARY.md) describes them. Nothing installs a component by copying it in.
- The preset playground (`?preset=<code>`) in [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md). The canvas above is the playground that exists.
- Svelte and Vue adapters. `packages/svelte` and `packages/vue` are empty.
- Popover, dropdown, command menu, checkbox, radio, slider, combobox, table, avatar, and chart. They are candidates in [`catalog/index.md`](catalog/index.md). A prompt that names one is told so, and the frame does not invent it.

The tooltip sits on its anchor. It does not flip at the edge of the viewport.

`Switch`, `Select`, `SegmentedControl`, and `Dialog` are controlled. The
examples on their pages show the state you hold.

The workspace app has its own design canvas: a tldraw scratchpad and a
`ScreenSpec` tree (`apps/workspace/shared/ui-spec.ts`) that an agent edits
with the `ui_*` tools and exports as an app. That tree is not
`composePrompt`. Several of its nodes are named `button` or `text` rather
than the library export, and the content primitives are not nodes in it.
Prompting a screen in the gallery uses the library. Prompting a screen on
the workspace canvas uses the screen spec.

## Import order

The primitives publish `data-aicl` and no CSS. The theme and the motion are
stylesheets, and the order is the contract:

```ts
import '@aicl/styles';
import '@aicl/styles/themes/looseleaf.css'; // omit for the default theme
import '@aicl/motion/motion.css';
```

A skin sets `--aicl-*` and `[data-aicl-theme]`. It does not restyle by
rewriting behaviour. `data-theme="light"|"dark"` is the mode. The gallery's
switcher writes both.

Wrap a subtree in `data-aicl-root` when it should carry the type and colour
roles. The canvas frame does.

## How to read a component page

`docs/components/<name>.md` is generated. Edit the source, then regenerate:

```bash
npm run build -w @aicl/react
npm run docs -w @aicl/react
```

| Section | Source | What it answers |
|---|---|---|
| The first paragraph | `contract.ts` `summary` | What it is for, in one line |
| Incorporation | `incorporation.ts` | Which shapes, which motion, which sample component, what was taken |
| Usage | `usage.ts` | When to reach for it, the example, the boundary, the canvas phrase |
| Slots and states | `contract.ts` | The `data-aicl` names and the attribute values a skin selects on |

A usage record that drifts from the page fails the test. A primitive with
no record fails it too.

## Composing without the prompt

The prompt is a convenience over the same components you import. A screen
you mean to keep is the imports, written out. The gallery's shell
(`examples/slice-1/Shell.tsx`) is one: a sidebar, a transcript, a composer,
and a pane, with a scripted transport so it runs offline. Copy that shape,
then replace the transport with `createSseTransport` as
[`ADOPTION.md`](ADOPTION.md) shows.

A few boundaries the pages repeat, because they are where a composition
goes wrong:

- `submitted` and `streaming` stay distinct. Stop exists only while tokens are arriving.
- The default transcript row does not wire retry, edit, or branching. Render `Transcript.Item` when those actions have to work.
- `Composer`'s `onSubmit` receives text. Attachments on the field are display state until you send them as `file` parts.
- One `ToastRegion`, near the root, fed by the queue from `@aicl/core`. A `Toast` on its own does not time itself.
- Loading on a `Button` keeps it focusable. It does not disable it.
- A `Button` defaults to `type="button"`. A button that submits a form says so.

## Adding an input

A new canvas input is a primitive that can render on a frame without a
conversation, a queue, or a portal.

1. Add the block to `PLAYGROUND_INPUTS` in `packages/react/src/compose.ts`: phrases, imports, and the JSX the frame shows.
2. Set the primitive's `canvas` line in `usage.ts` to those phrases, in backticks.
3. Render the block in `examples/slice-1/Canvas.tsx`. The `switch` is exhaustive, so a new id does not compile until it has a branch.
4. Regenerate the docs. `llms.txt` lists the phrases, and the component page gains the line.
