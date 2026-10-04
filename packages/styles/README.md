# `@aicl/styles`

Optional CSS-variable theme for every AICL primitive. Shipped as a single
stylesheet; consumers import it once and the entire chat shell is themed.

## Themes

Two themes ship out of the box: `light` and `dark`. Apply by setting
`data-theme="light"` or `data-theme="dark"` on any container element. Without
an explicit theme, the user's system preference (`prefers-color-scheme`)
wins.

```tsx
import '@aicl/styles';

export function App() {
  return (
    <div data-theme="dark">
      {/* every primitive picks up the dark palette */}
    </div>
  );
}
```

The fixture demonstrates a runtime switcher:

```tsx
function apply(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}
```

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
| Radii | `--aicl-radius-{sm,md,lg,pill}` |
| Spacing | `--aicl-space-1` through `--aicl-space-7` |
| Motion | `--aicl-anim-fast`, `--aicl-anim`, `--aicl-anim-slow`, `--aicl-ease`, `--aicl-ease-out` |
| Shimmer | `--aicl-shimmer-{a,b,c}` (used by the running tool row) |

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
| `src/tokens.css` | Theme tokens, light and dark |
| `src/reset.css` | Minimal chat-shell reset, motion reduction |
| `src/components.css` | Every primitive as `data-aicl` selectors |
| `src/index.css` | Imports the three above; this is the package entry |

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
