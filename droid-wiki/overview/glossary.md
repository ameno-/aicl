# Glossary

| Term | Definition |
| --- | --- |
| Part | A typed element of a `Message`. The discriminated union in `packages/core/src/types.ts` covers `text`, `reasoning`, `tool-call`, `tool-result`, `file`, `citation`, `artifact`, `error`, plus a `data-` prefix for consumer-defined extensions. |
| StreamEvent | A frame yielded by a `ChatTransport`: `message-start`, `part-start`, `part-delta`, `part-end`, `message-end`, or `error`. Events are indexed by part position rather than carrying a full message per frame. |
| ChatStatus | The conversation state machine: `idle`, `submitted`, `streaming`, `aborted`, `error`. `submitted` is deliberately separate from `streaming` so the UI can reject further submits before any token arrives. |
| Renderer registry | The `Map`-based dispatch from part type to renderer (`packages/core/src/registry.ts`). Lets a consumer register `data-*` part renderers and a wildcard `data-` fallback without forking the transcript. |
| Connector | A function that converts a provider wire (OpenAI, Anthropic, Bedrock, Gemini) into the canonical `StreamEvent` sequence. Lives in dedicated packages; see `docs/api/README.md`. |
| Workspace | The reference app at `apps/workspace`. A Pi agent and a person share a scratchpad beside the chat, mediated by the relay in `apps/workspace/server/relay.ts`. |
| Corpus | The 1,262 labelled screens across four surveyed products (Devin, Manus, Lovable, Cofounder) that drives the design rules in `docs/domains/` and the comparative evaluations in `docs/evaluation/`. |
