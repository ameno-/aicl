# Patterns and conventions

## Style

- TypeScript `strict` with `noUncheckedIndexedAccess`. Optional fields are omitted rather than set to `undefined` on the wire (see `toFilePart` in `packages/core/src/types.ts`).
- ES modules only. Library packages are `"sideEffects": false` (except CSS).
- Named exports through barrel files (`src/index.ts`).
- Library source imports with `.js` extensions (compiled by `tsc`). `apps/workspace` imports with `.ts` extensions and `import type` (it runs under strip-types).
- Comments explain *why*, often citing the corpus rule, a decision (`D12`), or a ticket (`AICL-41`). Keep them accurate when you change behaviour.

## Error handling

- **Engine.** Failures become `status: 'error'`, not exceptions. A user's `stop()` is never overwritten by the resulting transport error.
- **Handler.** `ChatHandlerError(status, message, retryable)` before streaming sets the HTTP status. Other errors while streaming become an in-band `error` frame.
- **Workspace.** `SessionError` and `BrowseError` carry a status. Tool failures return an error result to the model and do not crash the server.

## Framework agnosticism

`@aicl/core` must not import a framework or touch `document`/`window`. `@aicl/styles` is CSS only. Enforced by review.

## Renderer extension

Add domain parts as `data-*` types and register a renderer, without forking the transcript. In React, register each type by its **exact** name: `PartRenderer` ignores a registry's `data-` wildcard and fallback (`docs/ADOPTION.md` §5). Unknown types render as `UnknownPart` and never throw.

## Workspace extension

New capability arrives as a feature module (`apps/workspace/server/feature.ts`): routes, tools, a prompt fragment, Pi extensions, hidden per-session context, and WebSocket upgrades. Contracts that both sides need live in `apps/workspace/shared/`. Recipes: `apps/workspace/AGENTS.md#recipes`.

## Cross-cutting concerns

- **Tracking.** Linear for work (`AICL-*`), `docs/DECISIONS.md` for contract changes.
- **Persistence.** The transcript is a normalised node map plus an id array. Appending a token must not copy every message.
- **IME and accessibility.** Check `isComposing` before Enter submits. Keep one `aria-live` container for the life of the transcript.

## Naming

- Packages: `@aicl/<name>`. Types: `PascalCase`. Functions and factories: `camelCase` (`createX`). Constants: `UPPER_SNAKE_CASE`.
- Test files: `*.test.ts(x)` beside the code. E2E scripts: `*.mjs`.
- DOM hooks: `data-aicl="<primitive>"` plus state attributes (`data-state`, `data-role`, `data-status`, `data-part`).
