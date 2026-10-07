# Patterns and conventions

## Style

- TypeScript with `strict` enabled (see `packages/core/tsconfig.json` and the per-package `packages/*/tsconfig.json` files). Optional properties use exact shapes; `toFilePart` in `packages/core/src/types.ts` is a worked example of avoiding `undefined` on the wire.
- ES modules only. Every package declares `"type": "module"` and `"sideEffects": false` so a tree-shaking bundler can drop unused exports.
- Named exports; barrel files re-export from `./<file>.js`. The barrel for `@aicl/core` is `packages/core/src/index.ts`.
- Comments document the *why*, not the *what*. The architecture files (`packages/core/src/types.ts`, `packages/core/src/chat.ts`) use them heavily because they encode corpus-derived design rules that aren't obvious from the types alone.

## Error handling

- **Engine.** Recoverable errors become a `status: 'error'` transition rather than a thrown exception. The catch in `packages/core/src/chat.ts` (`run`) wraps anything that bubbles up.
- **Abort.** `signal` is honoured cooperatively. A user-initiated `stop()` never gets overwritten with `error`; the `controller` is held locally as well as on the instance so the catch can distinguish a user abort from a transport failure.
- **Handler.** Declared errors throw `ChatHandlerError` with a `status` and a `retryable` flag (see `packages/server/src/handler.ts`). Anything else becomes a wire-level `{ type: 'error', error }` `StreamEvent` frame.

## Framework agnosticism

`@aicl/core` must not import a framework and must not touch `document` or `window`. `@aicl/styles` must not either; it emits CSS only. The rule is enforced by convention and code review at this stage (no CI workflow exists).

## Renderer extension

New part types register with the renderer registry rather than forking the transcript. A consumer can register an exact match (`'data-invoice'`) or a wildcard (`'data-'`) that covers a family. Unknown types fall back to a registered handler rather than throwing, so a server that adds a part type cannot white-screen an older client. See `packages/core/src/registry.ts`.

## Cross-cutting concerns

- **Issue tracking.** Cross-cutting work goes through Beads (`bd`); do not use markdown TODO lists or in-tree `TODO` blocks for cross-cutting work. Local `TODO`s inside a function body are fine.
- **Decisions.** Decisions that change the public API get a bead and an entry in `docs/DECISIONS.md`. The DECISIONS file already references D9 (agent surfaces stay in the chat packages), D10 (platform pages are recipes, not API), D11 (session metadata is its own model), and D12 (`createComboboxModel` is the single listbox contract behind `TriggerMenu`, `SessionSearch`, and `Select`).
- **Persistence.** The transcript is stored as a normalised node map plus an id array, not a nested tree. Appending a token to the last message must not create a new array of all messages, or long conversations degrade quadratically. See `packages/core/src/chat.ts`.
- **IME and accessibility.** Composers must check `composingRef` and `nativeEvent.isComposing` before treating `Enter` as submit. A streaming transcript needs `aria-live="polite"` on a container that is not recreated per token, or screen readers re-announce the entire conversation on every delta. See `packages/react/src/Composer.tsx` and `packages/react/src/Transcript.tsx`.

## Naming

- Package names are scoped `@aicl/<name>`.
- Public types are `PascalCase`; factories and pure functions are `camelCase`; constants are `UPPER_SNAKE_CASE` (for example `BUSY` in `packages/core/src/chat.ts`).
- File names mirror the main export: `packages/core/src/chat.ts` exports `ChatController`, `packages/react/src/composer-surface.tsx` exports the composer surface.
- Test files end in `*.test.ts` or `*.test.tsx`; end-to-end scripts end in `*.mjs`.
