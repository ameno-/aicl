# How to contribute

## Pickup

1. Run `bd ready` (or read `.beads/issues.jsonl`) for an open issue.
2. Run `bd show <id>` to read the full description and any linked decision.
3. Run `bd update <id> --status in_progress` to claim it. Use `bd close <id>` once the change lands.
4. If no bead exists for the change you want to make, create one before opening a PR.

## PR process

- Branch off `main`. Keep the diff focused: one ADR-sized concern per PR.
- Add or update tests. The package scripts run `tsc -p tsconfig.test.json` then `node --test`; see [Testing](testing.md).
- Run `npm run typecheck` and `npm run test` from the repo root before pushing. Both commands forward to every workspace that has the corresponding script (see `./package.json`).
- Mention the bead id in the PR title or description so the issue stays traceable.
- Reference the relevant spec or ADR: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, or a domain spec in `docs/domains/`.

## Review expectations

- One reviewer is enough for a small fix or a docs change.
- Changes that touch `@aicl/core` package boundaries (no DOM, no framework imports) need a second pair of eyes because they break every adapter if they regress.
- Changes to `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, or any domain spec in `docs/domains/` need a bead reference and a fresh ADR entry when they alter a public contract.
- Adapters (`@aicl/react`, future `@aicl/svelte`, future `@aicl/vue`) are review-light individually, but a change that leaks a framework import into `@aicl/core` is a hard fail.

## Session completion

The repository's `./AGENTS.md` requires a final `git push`. Run `bd sync` first; `git status` should report `up to date with origin` before the session ends.
