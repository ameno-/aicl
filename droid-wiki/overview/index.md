# aicl

Open-source, framework-agnostic UI component library for AI chat applications. The repository splits a chat UI along three seams that change at different rates: conversation semantics, framework bindings, and visual design. It contains five packages (`@aicl/core`, `@aicl/react`, `@aicl/server`, `@aicl/styles`, `@aicl/fx`), a large reference application (`apps/workspace`), and two small examples. Design choices come from a labelled corpus of 1,262 screens across four shipping agentic-chat products (Devin, Manus, Lovable, Cofounder). See `docs/CORPUS.md` for the survey method and `docs/ARCHITECTURE.md` for the package rules.

Agents start at `./AGENTS.md` (repo map, commands, invariants, workflow), then `docs/ADOPTION.md` (integrating the library) or `apps/workspace/AGENTS.md` (changing the app).

## At a glance

- Repo: `aicl`, default branch `main`, license MIT
- Primary language: TypeScript (ESM everywhere)
- Workspaces: `./package.json` declares `packages/*`. `apps/workspace` and `examples/*` install separately
- Packages: `core`, `react`, `server`, `styles`, `fx`. `packages/svelte` and `packages/vue` are empty placeholders
- Reference app: `apps/workspace` (Pi agent, tldraw canvas, live surfaces, `aicl` CLI, `aicl-mcp` MCP server)
- Examples: `examples/slice-1` (React gallery + e2e), `examples/server-node` (Node handler)
- CI: none (`.github/` does not exist). Gates are run locally
- Issue tracker: Linear (workspace `acids`, team `AICL`). `.beads/` holds the original research tasks
- Numbers: [By the numbers](../by-the-numbers.md)

## Sections

- [Architecture](architecture.md)
- [Getting started](getting-started.md)
- [Glossary](glossary.md)
- [By the numbers](../by-the-numbers.md)
- [Lore](../lore.md)
- [How to contribute](../how-to-contribute/index.md)
- [Packages](../packages/index.md)
- [Reference](../reference/index.md)
