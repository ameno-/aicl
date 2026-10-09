# How to contribute

## Pickup

1. Find or create the Linear issue: `linear issue list --team AICL` or `linear issue create --team AICL -t "…"` (workspace `acids`).
2. Read the relevant guide: `./AGENTS.md` (repo), `apps/workspace/AGENTS.md` (app), `packages/<pkg>/README.md` (library), `docs/ADOPTION.md` (integration).
3. If the change alters a public contract (part union, `StreamEvent`, `ChatStatus`, `data-*` attributes), read `docs/DECISIONS.md` and add an entry.

## PR process

- Branch `linear/AICL-<n>-<slug>` off `main`. Never commit to `main`.
- Keep a PR to one concern. Put the issue key in commit subjects, for example `… (AICL-44)`.
- Add or update tests next to the code (see [Testing](testing.md)).
- Run the gates locally, since there is no CI: root `npm run build && npm run typecheck && npm test`, plus `apps/workspace` `npm run typecheck && npm test` when you touched the app or a package it uses.
- Open the PR with `gh pr create` against `main`. List the commands you ran and their results.

## Review expectations

- Changes that touch `@aicl/core`'s boundaries (no DOM, no framework imports) need careful review, because a regression breaks every adapter.
- A changed `data-aicl` attribute is a breaking change for `@aicl/styles` and consumer CSS.
- Vendored files in `packages/fx/src/vendor` keep their source header and an `ATTRIBUTION.md` row.

## Session completion

Push the branch and confirm `git status` says it is up to date with its upstream. Update the Linear issue with the PR link, and file issues for any leftover work. See the "Landing the plane" section of `./AGENTS.md`.
