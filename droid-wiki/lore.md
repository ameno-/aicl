# Lore

`aicl` is an open-source AI chat UI library designed against a corpus survey of 1,262 screens across four shipping agentic-chat products (Devin, Manus, Lovable, Cofounder). The architecture splits a chat UI into conversation semantics, framework bindings, and visual design, and turns the split into a code rule: `@aicl/core` cannot import a framework and cannot touch `document` (see `docs/ARCHITECTURE.md`).

The history in `git log` runs in phases:

1. **Corpus and contract (from 2026-09-21).** Corpus labelling, per-domain specs (`docs/domains/`), comparative evaluations that corrected them (`docs/evaluation/`), decisions D1–D14 (`docs/DECISIONS.md`), the blueprint (`docs/BLUEPRINT.md`), and the first slices of `@aicl/core`, `@aicl/react`, `@aicl/server` and `@aicl/styles`. These tasks were tracked in Beads (`.beads/`).
2. **The workspace, in waves (AICL-10 onward, tracked in Linear).** A shared tldraw scratchpad driven by a Pi agent (M1); the "moi computer" runtime of sessions, applets, a shell and a canvas agent (wave 1); human-in-the-loop, live plans and terminals, agent nodes and the canvas graph (wave 2); `@aicl/fx`, provider kits and the full chat application (wave 3); live surfaces, multi-agent swarms, MCP, the Sideshow bridge, and the canvas as a shared design space (wave 4).
3. **One design (AICL-44/45).** The kit picker was dropped, so the app renders one assistant design and the kits remain as presets for screens designed on the canvas.

Code comments still carry the ticket (`AICL-41`) and wave labels of the work that introduced them.
