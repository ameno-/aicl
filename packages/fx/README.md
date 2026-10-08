# `@aicl/fx`

Animated AI-chat components on AICL tokens: streaming text, thinking indicators, tool-call
cards, animated plans, a live terminal, an approval card, a prompt composer, a model picker, a
command menu, toasts, and a WebGPU `Ambient` background. Many are vendored from MIT projects
(`ATTRIBUTION.md`).

Unlike the other packages, this one is **opinionated and styled**, and it is
**source-only**: `exports` point at `src/*.ts(x)`, and there is no build step. You need a
bundler that compiles TypeScript and runs Tailwind v4.

## Setup

1. Depend on `react`, `react-dom` ≥ 18 and on `@aicl/styles`. The colours resolve to `--aicl-*`
   tokens, so import `@aicl/styles` first.
2. Run Tailwind v4 over the package stylesheet, for example with `@tailwindcss/vite`, from a CSS
   file of your own:

   ```css
   @import '@aicl/fx/fx.css';
   @source './';            /* also scan your own sources */
   ```

   `fx.css` imports Tailwind's theme and utilities **unlayered and without preflight**, so the
   utilities win over the AICL reset. It also maps shadcn colour names (`bg-background`,
   `text-muted-foreground`, …) to AICL tokens, and makes `dark:` follow `data-theme="dark"`.
3. Wrap the app once in `<FxProvider>`. It sets motion's `reducedMotion="user"` and the
   `data-fx` scope the vendored components assume.

The workspace app is the reference setup: `apps/workspace/web/main.tsx`,
`apps/workspace/web/tailwind.css`, and the `resolve.dedupe` list in
`apps/workspace/vite.config.ts`. Dedupe `react`, `react-dom`, `lucide-react` and `motion`, or
you get two copies of React.

## Exports (`src/index.ts`)

- Stream (`src/components/stream/`): `StreamingText`, `ThinkingIndicator`, `WorkSummary`,
  `ToolCallCard`, `AnimatedPlan`, `RollingNumber`, `LiveTerminal`, `StatusIsland`, `CodeBlock`,
  `BorderBeam`
- Input (`src/components/input/`): `PromptComposer`, `ModelPicker`, `SmoothDropdown`,
  `SuggestionStack`, `ApprovalCard`, `QuestionCard`, `Toaster`/`toast`, `SegmentedTabs`,
  `InlineEdit`, `Kbd`, `CommandMenu`/`fuzzyScore`, `SidePanel`
- `Ambient` (WebGPU via the `shaders` package. It renders nothing in headless browsers)
- `cn` (clsx + tailwind-merge), `FxProvider`

## See every component

`apps/workspace/web/gallery.html` renders every component in every state (stories in
`apps/workspace/web/gallery/stories/`). With the workspace dev server running, open
`http://localhost:5181/gallery.html`.

## Rules for changes

- Vendored files start with a header naming the source repo, path and commit. Keep it, and
  add a row to `ATTRIBUTION.md` for every new vendored file.
- Use AICL tokens (through the shadcn names in `fx.css`), never literal colours, so components
  follow the theme.
- `npm run typecheck` is the only gate. Visual checks happen in the gallery.
