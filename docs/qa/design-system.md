# Design system QA report

A complete token system, a themable primitive surface, and a runtime
switcher were added on top of the chat surface. Both themes are
DOM-verified through agent-browser. Screenshots are saved alongside this
report.

## Token application

The browser reads the expected palette in both themes:

| Token | Light | Dark |
|---|---|---|
| `--aicl-bg` | `#fafaf7` | `#0e1014` |
| `--aicl-text` | `#1c1d22` | `#ececf0` |
| `--aicl-accent` | `#2c52d4` | `#8b9afc` |
| `body backgroundColor` | `rgb(250, 250, 247)` | `rgb(14, 16, 20)` |
| `body color` | `rgb(28, 29, 34)` | `rgb(236, 236, 240)` |

The `body` background and foreground follow the chosen theme. The
`[data-theme]` attribute toggles cleanly between the two palettes.

## Theme switcher

```
{
  "count": 3,
  "buttons": ["Light", "System", "Dark"],
  "theme": null
}
```

The switcher renders three buttons (Light, System, Dark). Pressing Dark
applies `data-theme="dark"` on the document element; pressing System
removes the attribute, deferring to `prefers-color-scheme`.

## DOM presence

```
{
  "sections": 19,
  "composers": 5,
  "codeBlocks": 1,
  "switcher": true,
  "switcherButtons": 3
}
```

Every Gallery section still renders, every composer still mounts, the
code-block primitive still appears, and the new theme switcher is in
the DOM with three buttons.

## Behaviors

Each `data-aicl` primitive is now wired to behavior, not paint:

- **Focus rings** on every `:focus-visible` via `box-shadow: var(--aicl-focus-ring)`.
- **Hover** on action-bar buttons, attachment chips, suggestion chips, artifact cards.
- **Active press** on every button.
- **Selection** themed via accent.
- **Reduced motion** flattens every animation and transition to ~0ms via a
  single `@media (prefers-reduced-motion: reduce)` block.
- **Action-bar visibility** matches the corpus rule (hover, focus-within,
  coarse pointer, or last-assistant reveal).
- **Tool row shimmer** runs while the part is `data-status="running"`.
- **Reasoning dot pulses** while the row is `data-state="pending"`.
- **Plan checklist spinner** rotates while a step is `data-status="running"`.
- **Terminal Live badge** appears when the terminal is `data-streaming`.
- **Code copy button** reveals on hover/focus-within and flips to a tinted
  state once copied.
- **Day separator** uses a hairline rule, suppressed for single-group
  threads.
- **Send button morph** between send and stop uses the accent for send and
  a neutral surface with danger hover for stop.

## Files

| File | What |
|---|---|
| `packages/styles/src/tokens.css` | Light and dark palettes, color-mix shimmer stops |
| `packages/styles/src/reset.css` | Chat-shell reset, focus ring, reduced-motion |
| `packages/styles/src/components.css` | Every primitive as `data-aicl` selectors |
| `packages/styles/src/index.css` | Package entry, imports the three above |
| `packages/styles/package.json` | Package manifest |
| `packages/styles/README.md` | Token reference, override guide |
| `examples/slice-1/ThemeRoot.tsx` | Light / System / Dark switcher with localStorage |
| `examples/slice-1/styles.css` | App-level layout (theme switcher, work pane) |
| `docs/screenshots/light.png` | 4144×4052 full-page capture, light theme |
| `docs/screenshots/dark.png` | 4144×4052 full-page capture, dark theme |

## Verdict

PASS. The chat surface is now:

- **Themable** — two shipping themes, a third system default, and a
  runtime switcher in the fixture.
- **Polished** — focus rings, hover, active press, selection, smooth
  transitions, motion reduction.
- **Distinct** — every primitive reads tokens. Tinting the library is a
  stylesheet change, not a code change.
