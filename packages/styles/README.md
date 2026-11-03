# `@aicl/styles`

The AICL token contract, the chat-shell reset, and the component surfaces.
Shipped as a single stylesheet; consumers import it once and the entire chat
shell is themed.

The property names are **public API**. Changing a value is free. Changing a
name is a breaking change and needs an entry in `docs/DECISIONS.md`.

## Layers

Three layers stack on top of each other, in this order.

| Layer | Import | What it does |
|---|---|---|
| Contract | `@aicl/styles` | the token names and their default values |
| Skin | `@aicl/styles/themes/looseleaf.css` | replaces the values, wholesale or in part |
| Motion | `@aicl/motion/motion.css` | replaces the easings with springs, adds the interaction patterns |

```tsx
import '@aicl/styles';
import '@aicl/styles/themes/looseleaf.css';
import '@aicl/motion/motion.css';
```

The motion layer works by overriding the contract's *easings* and leaving its
*durations* alone, so an existing stylesheet that says
`transition: opacity var(--aicl-anim) var(--aicl-ease)` becomes a spring
without a line changing.

## Mode and skin

Two attributes, two jobs:

- `data-theme="light" | "dark"` selects the **mode**. Without it, the
  system preference (`prefers-color-scheme`) wins.
- `data-aicl-theme="<skin>"` selects the **skin**. A skin ships both modes.

Apply both to the same element — usually the AICL root — so a skin can
resolve the mode itself:

```tsx
<div data-aicl-root data-aicl-theme="looseleaf" data-theme="dark">
```

## Density

`data-aicl-density="compact"` tightens the space ladder and the hit target
for dense surfaces — filter bars, toolbars, sidebars. `data-aicl-density="calm"`
does the same and stops the motion.

## Skins

A skin is a stylesheet that overrides the contract's values. It contains no
JavaScript, no components, and no knowledge of the primitives beyond the
contract's names, so it cannot change behaviour.

| Skin | Import | Look |
|---|---|---|
| LooseLeaf | `@aicl/styles/themes/looseleaf.css` | paper on a green desk, pen strokes, marker orange, a highlighter-yellow hover, warm umber shadows |

Writing your own is a stylesheet:

```css
[data-aicl-theme='midnight']:not([data-theme='dark']) {
  --aicl-bg: #0b1020;
  --aicl-surface: #131a2e;
  --aicl-text: #e6ebff;
  --aicl-accent: #7aa2ff;
  /* …the rest of the contract… */
}
```

See [`docs/DESIGN-SYSTEM.md`](../../docs/DESIGN-SYSTEM.md) for the model.

## Tokens

Every primitive reads CSS custom properties. There are no JavaScript
theme objects and no runtime overhead. Overriding the palette is a
stylesheet change.

| Group | Variables |
|---|---|
| Surfaces | `--aicl-bg`, `--aicl-surface`, `--aicl-surface-elevated`, `--aicl-surface-inset`, `--aicl-surface-tint` |
| Text | `--aicl-text`, `--aicl-text-muted`, `--aicl-text-faint`, `--aicl-text-link`, `--aicl-text-inverse` |
| Borders | `--aicl-border`, `--aicl-border-strong`, `--aicl-border-focus` |
| Accent | `--aicl-accent`, `--aicl-accent-soft`, `--aicl-accent-strong`, `--aicl-accent-fg` |
| Semantic | `--aicl-success`, `--aicl-warning`, `--aicl-danger`, `--aicl-info` |
| Tool states | `--aicl-tool-pending`, `--aicl-tool-running`, `--aicl-tool-success`, `--aicl-tool-error`, `--aicl-tool-cancelled` |
| Code | `--aicl-code-bg`, `--aicl-code-fg`, `--aicl-code-border`, `--aicl-code-keyword`, `--aicl-code-string`, `--aicl-code-number`, `--aicl-code-tag`, `--aicl-code-comment` |
| Terminal | `--aicl-terminal-bg`, `--aicl-terminal-fg`, `--aicl-terminal-prompt` |
| Shadows | `--aicl-shadow-1`, `--aicl-shadow-2`, `--aicl-shadow-3` |
| Focus | `--aicl-focus-ring` |
| Type | `--aicl-font-sans`, `--aicl-font-mono`, `--aicl-text-{xs,sm,base,md,lg}`, `--aicl-leading-{tight,snug,normal}` |
| Radii | `--aicl-radius-{sm,md,lg,xl,pill}` |
| Spacing | `--aicl-space-1` through `--aicl-space-7` |
| Motion | `--aicl-anim-fast`, `--aicl-anim`, `--aicl-anim-slow`, the matching `-exit` durations, `--aicl-ease`, `--aicl-ease-out`, `--aicl-ease-in` |
| Interaction | `--aicl-hover-bg`, `--aicl-hover-bg-strong`, `--aicl-hit`, `--aicl-hit-min` |
| Shimmer | `--aicl-shimmer-{a,b,c}` (used by the running tool row) |
| Selection | `--aicl-selection-bg` |

All tokens are exposed on `:root` (or `[data-theme]`) so a consumer override
is one selector away.

## Behaviors

`@aicl/styles` also carries the behavior layer. It is not "just colors":

- **Focus rings** are drawn via `box-shadow: var(--aicl-focus-ring)` on every
  `:focus-visible`. Keys and tab navigation get a visible ring; clicks do
  not.
- **Hover** transitions on every interactive element use
  `var(--aicl-anim-fast) var(--aicl-ease)`.
- **Press** feedback uses a `transform: translateY(0.5px)` on `:active`.
- **Action-bar visibility** honors the corpus rule: `data-visibility="auto"`
  starts at opacity 0 and reveals on `:hover` and `:focus-within`,
  with `@media (pointer: coarse)` and `[data-last-assistant]` exceptions.
- **Code-block copy** button shows on hover or focus-within, then flips to
  a green-tinted "Copied" state.
- **Tool call** rows animate a shimmer while running and force-open on
  error.
- **Reasoning** row pulses while the message is still streaming; collapses
  to a quiet summary when content arrives.
- **Plan checklist** spinner rotates while a step is running.
- **Terminal** shows a "• Live" badge while streaming.
- **Day separator** uses the section rule for visual rhythm.
- **Reduced motion** is honored: a single media query flattens every
  animation and transition to ~0ms.
- **Selection** is themed via the accent.

## Files

| File | What |
|---|---|
| `src/contract.css` | The token contract: every `--aicl-*` name, light and dark |
| `src/reset.css` | Minimal chat-shell reset, motion reduction |
| `src/components.css` | Every primitive as `data-aicl` selectors |
| `src/themes/looseleaf.css` | The LooseLeaf skin: paper, pen, marker |
| `src/index.css` | Imports the contract, the reset and the components; this is the package entry |

## Verification

The fixture's Gallery route renders every primitive. Run `npm run dev` from
`examples/slice-1` and toggle the theme switcher in the top-right to flip
the whole shell from light to dark. The DOM checks assert every token is
read and the right palette is applied:

```
light: bg=#fafaf7 text=#1c1d22 accent=#2c52d4
dark:  bg=#0e1014 text=#ececf0 accent=#8b9afc
```

See `docs/screenshots/light.png` and `docs/screenshots/dark.png` for the
captured surfaces.
