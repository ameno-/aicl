# The library

How AICL is organised, and what is planned.

The design model — the four layers, the token contract, the motion system,
the skin model — is in [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md). This document
is about **structure**: what the library is made of, how the pieces fit, and
where each piece comes from.

Two projects are the reference points, and each is used for the half it is
better at.

- **[Fluid Functionalism](https://github.com/mickadesign/fluid-functionalism)**
  is the reference for **library architecture**: how a component library is
  divided into systems, components and blocks; how a registry item declares
  its dependencies; how a library documents itself for an agent; and how
  generated output is kept honest by a test.
- **[LooseLeaf](https://github.com/kevintngo/looseleaf)** is the reference for
  **theming**: a token vocabulary a skin can own, a swappable art layer, and
  the rule that states are CSS rather than React.

Neither contributes components. **AICL's components are AICL's** — they come
from the corpus survey of 1,262 screens of four shipping agentic-chat
products, and the decisions in [`DECISIONS.md`](DECISIONS.md) are binding.
What is borrowed is the *shape* of a mature library, so that AICL's own
components can be found, installed, themed, and read.

---

## The taxonomy

Fluid Functionalism's registry has six item types. AICL maps onto them.

| Fluid's registry type | What it is | AICL's equivalent | Where it lives |
|---|---|---|---|
| `registry:theme` | A token set. Pure data. | The contract, and each skin | `packages/styles/src/` |
| `registry:lib` | A shared system the components read | Motion, the token contract, the icon slots | `packages/motion`, `packages/styles` |
| `registry:hook` | A behaviour a component reads | `useFluidHover`, `useChat`, `useReadable` | `packages/motion/react`, `packages/react` |
| `registry:ui` | A component | The primitives | `packages/react` |
| `registry:block` | A composition, declaring its components | *Not yet* | — |
| — | — | The protocol | `packages/core`, `packages/server` |

Two axes Fluid has that AICL does not:

- **Two flavours, one API.** Fluid ships every primitive-backed component
  twice — once on Radix, once on Base UI — with the same API. AICL's flavour
  axis is **framework**: React today, Svelte and Vue when they exist. The
  API is the same; the binding is not.
- **Presets.** A preset encodes a configuration and installs as one item.
  AICL's configuration axes are the skin, the density and the icon set, so a
  preset is "a skin, a density and an icon set, chosen once". The mechanism
  comes with the registry.

---

## What exists

### Systems

The systems are the things every component reads. They are installable on
their own, and a component that does not read one does not depend on it.

| System | What it does | Status |
|---|---|---|
| **Motion** | Three spring tiers, their exits, fluid hover, weight without reflow | Shipped — [`@aicl/motion`](../packages/motion/README.md) |
| **The token contract** | Every visual decision, as a named custom property | Shipped — [`@aicl/styles`](../packages/styles/README.md) |
| **Icon slots** | Icons looked up by role, swappable through one provider | Shipped — [`@aicl/react`](../packages/react/README.md) |
| **Type roles** | Six roles, each a size and a leading, at two densities | Shipped |
| **Size ladder** | Control height, padding, gap and icon, at two densities | Shipped |
| **Elevation ladder** | Six levels of shadow | Shipped |
| **The component contract** | Every slot and every state, machine-readable | Shipped — [`docs/components.md`](components.md) |

### Components

The primitives are the transcript, the composer, the part renderers, the
platform controls, the navigation, and the content set. The count is the
contract: [`docs/components.md`](components.md) lists every one, and a page
in [`docs/components/`](components/) carries its slots, its usage, and its
incorporation record.

These are AICL's own, and they stay. The contract names their slots and
states, the usage record says how to reach for them, and a test fails when
the description and the implementation drift apart.

[`USAGE.md`](USAGE.md) is the guide: import order, the boundaries that bite,
and the canvas playground (`examples/slice-1` at `?view=canvas`) where a
prompt places those primitives on a frame.

Each primitive also has an incorporation record: the shapes it uses, the
motion it takes, and which LooseLeaf and Fluid components it was built
against. The procedure for the next one is
[`catalog/README.md`](catalog/README.md). The live decision for every item
in those two registries is [`catalog/index.md`](catalog/index.md).

### The skins

One skin ships: [`looseleaf.css`](../packages/styles/src/themes/looseleaf.css).
It ports LooseLeaf's token vocabulary — paper on a desk, marker orange, a
highlighter hover, warm umber shadows, cut-paper radii, a handwriting stack
— and nothing else.

---

## What is missing, and in what order

### 1. The registry

The registry is Fluid's central idea and AICL's biggest gap.

```
npx aicl add transcript composer
```

A registry item is a directory of source plus a manifest: its files, its
dependencies, the CSS it needs, and the slots and states it publishes. The
manifest is the component contract, so the two cannot disagree.

The same items publish in the **shadcn registry format**, so a team already
on shadcn installs AICL components with the CLI they know:

```
npx shadcn@latest add @aicl/transcript
```

One source of truth, two consumers.

*Before this:* the component inventory. A registry with three items in it is
a worse advertisement than no registry at all.

### 2. The component inventory

The gap between what AICL has (chat primitives) and what a chat app needs
(button, tooltip, tabs, select, sidebar, command menu, table) is exactly
why chat apps built on AICL end up building their own design system. This
is the "democratize" work.

These are AICL's components, in AICL's style — the corpus-derived look, not
Fluid's. They are built on the same contract, publish the same slots, and
read the same systems.

### 3. Blocks

A block is a composition that declares the components it needs. Fluid's
`sidebar-app` is a workspace header, a search field, collapsible sections,
a user footer and an inset topbar — one item, five components.

AICL's blocks should be the shells an AI chat app actually needs: the
assistant shell (sidebar, transcript, composer), the work panel, the
settings surface. `apps/workspace` has these as a large app; the job is to
extract them into installable compositions.

### 4. The ink layer

LooseLeaf's drawn chrome: every line is a seeded SVG function behind the
real DOM label, and the states are CSS. That is component code, not values,
so it is a layer above the primitives rather than a skin.

`@aicl/ink` would draw AICL's *own* primitives in the hand-drawn style:
the same slots, the same states, a different surface. The icon slots
already exist, so an ink layer is a drop-in.

### 5. The stack audit

Fluid ships a script that reads the consumer's stack fresh on every run —
the installed flavour, the `MotionConfig`, the font's optical-size axis —
and writes nothing. The rule is that **facts are read, never remembered**: a
cached verdict that drifts from the code misleads every session after it.

`aicl doctor` would read a consumer's `package.json` and report what is
missing: the stylesheet not imported, the motion layer out of order, the
contract and the installed version apart.

---

## What stays ours

Worth saying plainly, because the temptation with a reference project is to
converge on it.

- **The UX.** The corpus says what a chat surface looks like. The look —
  near-monochrome neutrals, a near-black primary, colour reserved for
  meaning, agent work as quiet icon-led lines rather than boxes — is ours,
  and it is what the skins start from.
- **The component inventory.** AICL's primitives come from the corpus
  survey, not from shadcn or from Fluid. A chat app needs a transcript, a
  composer, a reasoning row, a tool disclosure, an artifact card. Nobody
  else's set is that.
- **The decisions.** D1–D18 are binding, and they were made from evidence.
  A reference project does not overrule evidence.
- **The parts model.** Ordered `Part[]`, extended with `data-*` parts. It is
  the reason AICL can render a tool call and a paragraph in one stream.

---

## The summary

| | Fluid Functionalism | LooseLeaf | AICL |
|---|---|---|---|
| **What it is** | A registry of animated shadcn components | shadcn, drawn by hand | A component library for AI chat apps |
| **What it is good at** | Motion and how a library is organised | Theming, and the charm of hand-drawn chrome | Conversation semantics, and a look derived from 1,262 screens |
| **What AICL takes** | The library architecture; the motion system | The token vocabulary; the swappable art layer | — |
| **What AICL keeps** | — | — | The parts model, the decisions, the inventory, the look |

Fluid is how a library should be *organised*. LooseLeaf is how a library
should be *skinnable*. AICL is what is being built.
