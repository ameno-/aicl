# The AICL design system

**Status:** proposal, 2026-02. Supersedes the theming and motion sections of
[`ARCHITECTURE.md`](ARCHITECTURE.md). Binding decisions are appended to
[`DECISIONS.md`](DECISIONS.md) as D15–D18.

AICL has been many things: a protocol, a component library, a reference app, a
design corpus. It is now none of those alone, and that is the problem. Two
of the most successful open-source UI projects of the last two years solved
exactly this problem, and they solved it in opposite halves.

**Fluid Functionalism** solved the *shipping* problem. It is a shadcn/ui
registry where every transition exists to make a state change legible:
springs instead of durations, one hover highlight that glides from item to
item under your cursor, labels that get heavier without shifting the layout.
Its insight is that a component library is not a package — it is a set of
files you own, a motion system you can extend, and a set of rules an agent
can read.

**LooseLeaf** solved the *appearance* problem. It is shadcn/ui drawn by hand:
123 accessible React components with the same parts and props as shadcn/ui,
but every surface is paper and every line is a pen stroke. Its insight is
that the semantics are ordinary and the charm is decoration — so the charm
can be swapped without touching the behaviour.

AICL already has the thing both of them are built on: a stable behavioural
contract (`data-aicl` attributes on accessible primitives), a clean protocol
layer, and a corpus-derived set of decisions. What it lacks is the two
layers in between and the layer on top:

```
┌─ SKIN ───────────────────────────────────────────────────────┐
│  @aicl/styles/themes/*.css     optional · replaceable        │
│  Writes --aicl-* values. No code. No API change.              │
│  Shipped: looseleaf. Yours welcome.                           │
└───────────────────────────────────────────────────────────────┘
┌─ SYSTEM ─────────────────────────────────────────────────────┐
│  @aicl/motion   springs · fluid hover · weight without reflow│
│  @aicl/styles   the token contract + the primitive surfaces  │
│  @aicl/react    accessible primitives + composed components   │
└───────────────────────────────────────────────────────────────┘
┌─ BEHAVIOUR ──────────────────────────────────────────────────┐
│  @aicl/core    messages, parts, ChatController                │
│  @aicl/server  SSE framing                                    │
└───────────────────────────────────────────────────────────────┘
```

The rule that makes this work: **the UX never moves.** A skin changes what
AICL looks like. A motion tier changes how fast it moves. Neither changes
what it does, and neither is allowed to change the DOM contract that
`@aicl/react` publishes.

---

## 1. The four layers

### Protocol — `@aicl/core`, `@aicl/server`

Unchanged. The message model, the part union, the state machine, the SSE
framing. No DOM, no framework, no dependencies. This layer is what makes
AICL worth publishing to npm: a backend that yields AICL `StreamEvent`s
drives every adapter, and the contract is small enough to read in an
afternoon.

### Behaviour — the `data-aicl` contract

`@aicl/react` publishes accessible primitives that carry their state as
attributes: `data-aicl="composer"`, `data-state="streaming"`,
`data-disabled=""`. Those names are public API. `@aicl/styles` and every skin
select on them, and a consumer can style a primitive without ever importing
a stylesheet.

This is the layer LooseLeaf validates. LooseLeaf keeps shadcn/ui's `data-slot`
names so a skin can be swapped in without touching JSX. AICL has the same
property already — it just never made it explicit or exploited it.

### System — the token contract and the motion system

Two new-ish pieces:

- **The token contract** (`@aicl/styles`): a named set of CSS custom
  properties that every visual decision is expressed in. The names are
  semantic (`--aicl-surface`, `--aicl-text-muted`, `--aicl-danger`), not
  chromatic, so a skin can replace the values wholesale.
- **The motion system** (`@aicl/motion`): three spring tiers and their
  exits, the travelling hover highlight, and weight without reflow.

Neither is decoration. The contract is what makes skins possible; the motion
system is what makes the library *feel* like one thing rather than a
collection of parts.

### Skin — `themes/*.css`

A skin is a stylesheet that overrides the contract's values. It contains no
JavaScript, no components, and no knowledge of the primitives beyond the
contract's names. It cannot change behaviour, because it has no way to.

---

## 2. The token contract

`packages/styles/src/contract.css` is the contract. It declares every
`--aicl-*` name and its default value, in light and dark.

**The names are the API.** Changing a value is free. Changing a name is a
breaking change and needs an entry in `DECISIONS.md`.

**The contract is semantic.** `--aicl-surface-elevated` says what the surface
is for, not what colour it is. This is the difference between a theme and a
palette swap: a palette swap changes `--blue`; a skin changes
`--aicl-accent`, and every button, link and focus ring in the library moves
with it.

**Three layers stack on top of it, in this order:**

| Layer | Import | What it does |
|---|---|---|
| Contract | `@aicl/styles` | the names and the default values |
| Skin | `@aicl/styles/themes/looseleaf.css` | replaces the values |
| Motion | `@aicl/motion/motion.css` | replaces the easings with springs, adds the interaction patterns |

The motion layer works by overriding the contract's *easings* and leaving its
*durations* alone, so a stylesheet that says `transition: opacity
var(--aicl-anim) var(--aicl-ease)` becomes a spring without a single line
changing.

**Density** is part of the contract, not a skin: `data-aicl-density="compact"`
tightens the space ladder and the hit target. `calm` does the same and stops
the motion.

---

## 3. The motion system

Ported from Fluid Functionalism's motion system. The rules, in the order
they matter:

### Springs, not durations

Three tiers, and the rule that picks between them: **the bigger the thing
that moves, the slower the spring.**

| Tier | Duration | Overshoot | For |
|---|---|---|---|
| `fast` | 80 ms | — | hovers, focus rings, tooltips, selection indicators |
| `moderate` | 160 ms | — | indicators that travel: tab pills, switch thumbs, drawers |
| `slow` | 240 ms | 12% | surfaces that take over the view: dialogs, side panels |

An interrupt reverses from where it is instead of finishing first. That is
the whole argument for springs over durations, and it is why a duration
cannot be expressed as a cubic-bezier.

**Exits are their own token.** An exit is a plain tween, one tier quicker
than the entrance it belongs to, so a dismissal reads as crisp and final
rather than as the entrance replayed. `fast.exit` is 60 ms, `moderate.exit`
120 ms, `slow.exit` 160 ms. Nothing hand-writes an exit duration.

**The springs are CSS.** A `linear()` easing function is a list of stops, and
its output is not clamped to `[0, 1]`, so an overshoot survives the trip.
`packages/motion/src/motion.css` is generated from the tokens in
`packages/motion/src/springs.ts` by `scripts/generate-motion-css.mjs`, and a
test fails when the committed stylesheet drifts from the tokens. The result:
real springs in a stylesheet, with no animation runtime and no JavaScript on
the critical path.

### Motion as information

Nothing moves for decoration. Every transition in the system exists to make
a state change legible. If a movement does not answer "what changed?", it
does not ship.

### Hover as preview

One highlight per list. The highlight glides from item to item under the
cursor rather than blinking between them, so the user sees where a click
will land before they click.

The rule is one pure function (`pickNearest` in `@aicl/motion`), and it is
kept pure so it can be tested without a browser:

1. An item the pointer is inside wins.
2. Otherwise the item whose centre is nearest wins, along the list's axis.
3. Disabled items are skipped but keep their slot.
4. Ties keep the earlier item.

A click that lands in the gap between items is routed to the item that is
lit, so what is lit is what a click hits.

### Weight without reflow

A label that gets heavier when selected gets *wider*, and pushes its
neighbours. Two things fix it: a ghost span that reserves the width at the
heaviest weight, and an optical-size compensation that pairs each `wght`
with an `opsz` so the advance width barely moves.

`@aicl/motion/react` ships `WeightText`; the pattern is CSS-only
(`[data-aicl-weight]`), so it works in any adapter.

### Animate transform and opacity

Never `top`, `left`, `width` or `height`. Two reasons: the travel stays on
the compositor, and reduced motion can drop it for free.

### Reduced motion is fewer and gentler, not none

Opacity and colour keep their fades — they help comprehension. Movement is
dropped. The hover highlight lands where it belongs instead of gliding
there.

### One rule about measurement

A wrapper that pins its height to a measured value and animates to it must
spring only when *it* toggles. When the measured height changes underneath
it because a child collapsed, it has to snap. Springing on a re-measure
makes the outer wrapper chase a target that moves every frame, and the
divergence compounds with nesting depth.

---

## 4. Skins

A skin is a stylesheet that overrides the contract. It is not a component
library, not a build step, and not a fork.

### The LooseLeaf skin

`packages/styles/src/themes/looseleaf.css` is the first skin, and it ports
LooseLeaf's **token vocabulary**, not its artwork:

| LooseLeaf | AICL | |
|---|---|---|
| `--ll-desk` | `--aicl-bg` | a green desk, not a grey void |
| `--ll-paper`, `--ll-slip` | `--aicl-surface`, `--aicl-surface-elevated` | paper laid on the desk |
| `--ll-ink`, `--ll-ink-muted`, `--ll-pencil-mark` | `--aicl-text`, `--aicl-text-muted`, `--aicl-border` | warm ink on a warm page |
| `--ll-marker` | `--aicl-accent` | risograph orange as the one saturated colour |
| `--ll-hi` | `--aicl-hover-bg` | the hover is a highlighter swipe, not a grey wash |
| `--ll-shadow-*` | `--aicl-shadow-1..3` | warm umber shadows — a shadow on paper is the paper going dark |
| `--radius: 3px` | `--aicl-radius-*` | cut paper, not a rounded card |
| `--ll-space-1..12` | `--aicl-space-1..7` | a denser ladder |
| `--ll-font-hand` | `--aicl-font-sans` | Kevin Sans, MIT, optional to install |

What is **not** ported, deliberately:

- **The drawn SVG outlines.** LooseLeaf draws every line with a seeded
  TypeScript function behind the real DOM label. That is a beautiful pattern
  and it is *not* a skin — it is a component layer. It wants its own
  package (`@aicl/ink`) that renders the same primitives with drawn chrome.
  Shipping it inside a skin would put drawing code in the layer that is
  supposed to be nothing but values.
- **The mascot, the stickers, the stamps.** Art, not system.
- **The bundled font.** LooseLeaf's README says Kevin Sans is MIT and is
  redistributed with the project. AICL uses a stack that *prefers* Kevin Sans
  and falls back to a system handwriting face, so nobody inherits a font
  they did not choose. The font is one `@font-face` away.

LooseLeaf's deeper lesson is the one AICL had already half-learned:
**states are CSS, not React.** LooseLeaf draws the hover, pressed and focus
layers ahead of time and reveals them with CSS. AICL's primitives already
publish state as attributes; the skin layer is where that becomes an
advantage, because a skin can then animate a state without a single line of
JavaScript.

---

## 5. Shipping

Fluid Functionalism's real contribution is not the motion. It is the
**registry**: components install as source, into your repo, where you own
them and can change them. That is what "democratize" means here.

### What ships how

| Artifact | Ships as | Why |
|---|---|---|
| `@aicl/core`, `@aicl/server` | npm, versioned | the wire contract must not drift between your backend and your frontend |
| `@aicl/styles`, `@aicl/motion` | npm, versioned | small, no code you have to read, no lock-in |
| Components | **registry**, copy-in source | you own the code; no version ceiling; plain CSS, any framework |
| Presets | registry item | configuration is the installable unit |
| Docs | `llms.txt` + per-page `.md` | an agent can read the library |
| An agent skill | `npx skills add` | the library teaches itself to code against it |

### The registry

```
npx aicl add chat-message
npx aicl add transcript composer
```

A registry item is a directory of source plus a manifest: its files, its
dependencies, the CSS it needs, and the tokens it expects. Installing it
copies the files into your repo and prints the one import you still owe.

The same items are published in the **shadcn registry format**, so a team
already on shadcn can install AICL components with the CLI they know:

```
npx shadcn@latest add @aicl/chat-message
```

One source of truth, two consumers.

### Two flavours, one API

Fluid Functionalism ships every primitive-backed component twice — once on
Radix, once on Base UI — with the same API. AICL's flavour axis is
**framework** instead: React today, Svelte and Vue when they exist
(`packages/svelte` and `packages/vue` are still placeholders). The API is
the same; the binding is not.

### Presets

A preset encodes a configuration — a density, a skin, a size ladder, an icon
set — and installs as one item. Nothing is stored: the code *is* the
configuration. The playground on a docs page produces the preset code, and
the same URL with `?preset=<code>` reopens the playground as you left it.

### The gallery is the docs

`examples/slice-1` already shows every primitive in every state. It becomes
the docs site: every primitive, every state, every theme, every density, in
both modes. It is the surface people copy from, and it is the surface an
agent reads.

---

## 6. What this does not change

- **The corpus.** The 1,262-screen survey and the 14 existing decisions stay
  binding. A skin does not get to contradict them; a skin only changes
  values.
- **The wire contract.** `docs/api/README.md` is unchanged.
- **The primitive API.** `@aicl/react`'s exports and props are unchanged.
  The motion and skin layers are additive.
- **`@aicl/fx`.** It stays as it is — an optional, opinionated, Tailwind-based
  set of animated components for teams that want them. It is not the design
  system; it is one consumer of it. Long term it should read the motion
  tokens instead of hard-coding its own timings, and its vendored code
  should move out of the library, but neither is part of this change.

---

## 7. What happens next

Ordered by what unblocks the most.

1. **Publish the contract.** `packages/styles/README.md` documents every
   token name; a test asserts the contract and the documentation agree.
   *Done in this change, minus the documentation test.*
2. **Add the motion system to the primitives.** The transcript, composer and
   platform primitives should use the three tiers rather than the durations
   they use now, so the library moves as one thing.
3. **Build the registry.** `registry.json`, a build step that emits one JSON
   item per component, and a `npx aicl` CLI that copies source and resolves
   dependencies.
4. **Fill the component inventory.** The gap between what AICL has (chat
   primitives) and what a chat app needs (button, tooltip, tabs, select,
   sidebar, command menu, table) is the whole reason a chat app ends up
   building its own design system. This is the "democratize" work.
5. **The ink layer.** `@aicl/ink`: LooseLeaf's seeded SVG drawings, rendered
   behind the real DOM, as an optional layer over the primitives.
6. **Svelte and Vue.** The same components, the same API, the same contract.

---

## Appendix: the sources

- Fluid Functionalism — <https://github.com/mickadesign/fluid-functionalism> —
  MIT. Consulted for the motion system, the registry model and the
  two-flavours-one-API rule.
- LooseLeaf — <https://github.com/kevintngo/looseleaf> — MIT. Consulted for
  the token vocabulary, the paper palette, the shadow ladder, the density
  ladder and the "states are CSS, not React" rule.
