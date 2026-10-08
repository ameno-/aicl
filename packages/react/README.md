# `@aicl/react`

The React adapter for `@aicl/core`: hooks plus unstyled, accessible primitives. The primitives
own DOM structure, ARIA, focus and keyboard behaviour, and expose state as `data-*` attributes.
They have no visual design. Add `@aicl/styles` for the default theme.

Peer deps: `react`/`react-dom` ≥ 18. Wiring it to a backend: `docs/ADOPTION.md`.

## Entry points

- `@aicl/react`: everything below.
- `@aicl/react/markdown`: `Markdown`, `MarkdownTextPart`, `markdownRenderers` (react-markdown
  + GFM, raw HTML never rendered). Kept off the main entry so the base adapter ships no parser.
  Register it with `createPartRegistry({ ...markdownRenderers })`.

## Inventory (`src/index.ts`)

| Area | Exports | File |
|---|---|---|
| State | `useChat`, `useReadable` | `useChat.ts`, `useReadable.ts` |
| Transcript | `Transcript`, `MessageItem`, `MessageActions`, `PlanChecklist` | `Transcript.tsx`, `MessageActions.tsx`, `PlanChecklist.tsx` |
| Parts | `PartRenderer`, `createPartRegistry`, `defaultRegistry`, `TextPartView`, `ReasoningDisclosure`, `ToolCallDisclosure`, `ToolResultView`, `ArtifactCard`, `CodeBlock`, `FileChip`, `ErrorNotice`, `SuggestionRows`, `TerminalOutput`, `UnknownPart` | `parts.tsx` |
| Composer | `Composer` (+ `ComposerHandle` ref: `focus`, `clear`), `TriggerMenu`, `SlashMenu`, `MentionMenu`, `findTrigger`, `SuggestionChips`, `AttachmentChip`, `AttachmentDropzone`, `useAttachmentPicker`, `matchesAccept` | `Composer.tsx`, `composer-surface.tsx` |
| Sessions | `SessionList`, `SessionListItem`, `SessionSearch`, `SidebarNav`, `relativeTime`, `resolveSecondary` | `sessions.tsx` |
| Platform | `Dialog` (+ `.Title`, `.Description`, `.Close`), `AlertDialog`, `Drawer`, `Toast`, `ToastRegion`, `Field`, `Switch`, `Select`, `SegmentedControl` | `platform.tsx` |

Working examples of nearly every primitive in every state: `examples/slice-1/Components.tsx`
and `examples/slice-1/Gallery.tsx` (`cd examples/slice-1 && npm install && npm run dev`).

## Known sharp edges

These are verified against the current source. Work around them, or fix them with a test.

1. **`useChat` reads options once.** Changing `transport`, `body` or `headers` after mount has
   no effect. Use a custom `fetch` in the transport, or remount.
2. **`<Transcript>` doesn't pass `onAction` or `branch` to `MessageItem`.** Retry and Edit
   buttons render but do nothing, and the branch switcher never appears. Render `MessageItem`s
   yourself when you need them (see `docs/ADOPTION.md`).
3. **`<PartRenderer>` uses a custom registry only for exact type names.** It checks
   `registry.has(part.type)`, so a `'data-'` wildcard or a custom fallback passed to
   `createPartRegistry` is ignored, and the built-in `UnknownPart` renders instead.
4. **Renderer typing.** The registry holds `ComponentType<PartProps>`. Write renderers against
   `PartProps` and narrow inside, or cast. `{ text: MarkdownTextPart }` doesn't compile, but
   `{ ...markdownRenderers }` does.
5. **`ToolResultView` doesn't render the result payload**, only "Result" or "Error".
6. **The default `artifact` renderer for `kind: 'terminal'`** shows a placeholder
   `TerminalOutput` with the line `ready`.
7. **`Composer` passes only text to `onSubmit`.** Attachments shown via `attachments` are
   display state. Send them yourself as `file` parts with `chat.send(text, parts)`.
8. **`TriggerMenu` needs a controlled composer.** Pass the same `value`, `onChange`/`onValueChange`
   and `inputRef` to both. It filters `items` by label unless you pass `onQueryChange`, in which
   case you filter.

## Behaviour worth knowing

- `Composer` checks IME composition before treating Enter as submit. Shift+Enter inserts a
  newline. The textarea autosizes up to `maxRows`.
- `Transcript` keeps one `role="log" aria-live="polite"` node for its whole life, so token
  updates aren't re-announced. It sticks to the bottom until the user scrolls up more than 24 px,
  then shows a "Jump to latest" button.
- `ToolCallDisclosure` force-opens on `status: 'error'` and shows `argsText` while args stream.
- Every primitive marks itself with `data-aicl="<name>"`. Treat the attribute names as public
  API, because `@aicl/styles` and consumer CSS select on them.

## Develop

```bash
npm run build
npm test        # react-test-renderer; src/*.test.tsx
```
