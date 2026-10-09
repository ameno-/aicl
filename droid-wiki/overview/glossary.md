# Glossary

| Term | Definition |
| --- | --- |
| Part | A typed element of a `Message`. The union in `packages/core/src/types.ts` covers `text`, `reasoning`, `tool-call`, `tool-result`, `file`, `citation`, `artifact`, `error`, and `data-${string}` for consumer extensions. |
| StreamEvent | One event in a turn: `message-start`, `part-start`, `part-delta`, `part-end`, `message-end`, `error`. Deltas address parts by index. |
| ChatStatus | `idle`, `submitted`, `streaming`, `aborted`, `error`. `submitted` is kept separate so a second submit is rejected before any token arrives. |
| Renderer registry | Part type → renderer map (`packages/core/src/registry.ts`) with a `data-` wildcard and a fallback. `@aicl/react`'s `PartRenderer` consults it for exact type names only (`docs/ADOPTION.md` §5). |
| Transport | `ChatTransport.send(req, signal) → AsyncIterable<StreamEvent>`, the library's whole I/O surface. Only the SSE transport ships. |
| Connector | A planned package that would map a provider's stream onto `StreamEvent`s (`docs/api/README.md`). None exist yet. |
| Workspace | The reference app at `apps/workspace`, and also the folder it works in (`AICL_WORKSPACE`, state under `.aicl/`). |
| Session | One persistent Pi conversation in the workspace (`server/sessions.ts`). `main` is the default. |
| Relay | Server → browser channel (`server/relay.ts`). Canvas ops run in the newest open tab and answer back. |
| Feature module | `{ routes, tools, prompt?, extensions?, contextFor?, onAgentEvent?, upgrades? }` (`server/feature.ts`). How the app is extended. |
| Surface | A live object shared by the user and agents: terminal, browser, file, diff, review, process, sideshow (`shared/surfaces.ts`). |
| Applet | An agent-written React widget or view under `.aicl/applets/`, built and loaded by the app (`server/applets.ts`). |
| Approval / HITL | The gate that pauses `bash`, `terminal_run`, writes outside `.aicl/`, and other risky tools for a user decision (`server/hitl.ts`). |
| Kit | A conversation design preset (`shared/kits.ts`). The app renders one (`assistant`). The others are presets for canvas screens. |
| Corpus | The 1,262 labelled screens behind `docs/domains/` and `docs/evaluation/`. |
