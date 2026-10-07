# Lore

`aicl` is the repository for an open-source AI chat UI library designed against a corpus survey of 1,262 screens across four shipping agentic-chat products (Devin, Manus, Lovable, Cofounder). The single snapshot on `main` is commit `118f39478dcecd5de413e5ae97680b2c17e2badb`, contributed by `Ameno` on 2026-10-05.

The architecture splits a chat UI along three concerns that change at different rates — conversation semantics, framework bindings, and visual design — and enforces the split as a code rule: `@aicl/core` cannot import a framework and cannot touch `document` (see `docs/ARCHITECTURE.md`). The corpus-grounded design rules are recorded in `docs/DECISIONS.md`, the per-domain specs in `docs/domains/`, and the comparative evaluations in `docs/evaluation/` that supersede the specs where evidence changed.

Beyond the commit graph and the docs, no further history surfaced. The repository was bootstrapped as a single squashed snapshot, and the wiki generation run on 2026-10-05 recorded the values in [By the numbers](by-the-numbers.md).
