# aicl

Open-source, framework-agnostic UI component library for AI chat applications. The repository splits a chat UI along three seams that change at different rates — conversation semantics, framework bindings, and visual design — and publishes four packages (`@aicl/core`, `@aicl/react`, `@aicl/server`, `@aicl/styles`) plus a generative canvas workspace and two reference consumers. Design choices come from a labelled corpus of 1,262 screens across four shipping agentic-chat products (Devin, Manus, Lovable, Cofounder); see `docs/CORPUS.md` for the survey method and `docs/ARCHITECTURE.md` for the package rules.

## At a glance

- Repo: `aicl`
- Description (from `./package.json`): "Open-source, framework-agnostic UI component library for AI chat applications."
- License: MIT (declared in `./package.json` and every `packages/<pkg>/package.json`)
- Primary language: TypeScript
- Workspaces: `./package.json` declares `packages/*`
- Total commits: 1
- Contributors: 1 (`Ameno`)
- Default branch: `main`
- Head commit: `118f39478dcecd5de413e5ae97680b2c17e2badb`
- First and last commit: 2026-10-05T01:52:50-07:00
- Files under the working tree (excluding `.git` and `node_modules`): 153
- File-extension breakdown: `md:40`, `ts:35`, `tsx:29`, `json:22`, `png:9`, `css:7`, `mjs:4`, `html:2`, `gitignore:2`, `yaml:1`, `jsonl:1`, `gitattributes:1`
- Packages shipped: 4 (`@aicl/core`, `@aicl/react`, `@aicl/server`, `@aicl/styles`)
- Reference apps: 1 (`apps/workspace`)
- Reference examples: 2 (`examples/server-node`, `examples/slice-1`)
- Domain specs in `docs/domains/`: 5
- CI: none (`.github/workflows/` does not exist)
- Issue tracker: Beads (`bd` CLI, `.beads/config.yaml`, `.beads/issues.jsonl`)

## Sections

- [Architecture](architecture.md)
- [Getting started](getting-started.md)
- [Glossary](glossary.md)
- [By the numbers](../by-the-numbers.md)
- [Lore](../lore.md)
- [How to contribute](../how-to-contribute/index.md)
- [Packages](../packages/index.md)
- [Reference](../reference/index.md)
