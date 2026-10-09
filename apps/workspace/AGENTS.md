# apps/workspace: agent guide

The AICL reference application is a local web app where a person and an embedded
[Pi](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) agent share a chat
product, a tldraw canvas, and live **surfaces**: terminals, a headless browser, files, diffs
and PR reviews, background processes, and Sideshow cards. External agents (Claude Code, Codex,
Pi) drive the same tools through the `aicl` CLI or the `aicl-mcp` stdio server.

This file is for agents changing the app. To *drive* a running workspace from outside, read
`skill/aicl-canvas/SKILL.md` instead.

## Run it

```bash
# once, from the repo root: the server imports @aicl/server from packages/server/dist
npm install && npm run build
# then
cd apps/workspace && npm install        # postinstall fixes node-pty's spawn-helper permissions
AICL_MODEL=<provider>/<model-id> npm run dev
```

- `npm run dev` runs `scripts/dev.mjs`: the API server on **5180** and Vite on **5181**,
  which proxies `/api` and `/ws` to 5180. Open `http://localhost:5181`.
- The model resolves through Pi's model runtime and credentials (`~/.pi/agent`, override with
  `PI_CODING_AGENT_DIR`). **`dev.mjs` defaults `AICL_MODEL` to `ap-codex/gpt-6-luna`**, a
  provider that exists only on the author's machine. Elsewhere, set `AICL_MODEL` to a model your
  Pi setup has credentials for, or startup fails while loading the main session.
- Production on one port: `npm run build && npm start` (serves `dist/` with SPA fallback on 5180).
- Node ≥ 22.6 is required: the server runs TypeScript directly with `--experimental-strip-types`.

### Environment

| Variable | Default | Read by |
|---|---|---|
| `AICL_MODEL` | Pi's default (`dev.mjs`: `ap-codex/gpt-6-luna`) | `server/main.ts` → `agent.ts`. Format `provider/id[:thinking]` |
| `AICL_MODELS` | — | Extra `provider/id,…` shown in the model picker (`server/models.ts`) |
| `AICL_WORKSPACE` | `process.cwd()` | The folder the agent works in, which holds all `.aicl/` state |
| `AICL_PORT` / `AICL_HOST` | `5180` / `127.0.0.1` | API server, and Vite's proxy target |
| `AICL_WEB_PORT` | `5181` | Vite (`strictPort`) |
| `AICL_URL` | `http://127.0.0.1:5180` | `bin/aicl.mjs`, `bin/aicl-mcp.mjs` |
| `AICL_REFERENCES` | `~/dev/ai-chat` | Reference screenshots for `ref_search`/`ref_place` and `GET /api/file` |
| `SIDESHOW_URL` / `SIDESHOW_TOKEN` | — | Remote Sideshow board. Used only when `.aicl/sideshow.json` says `target: "remote"` |
| `AICL_SIDESHOW_POLL_MS` | `4000` | Sideshow comment polling |
| `E2E_API` / `E2E_WEB` | 5180 / 5181 | e2e suites |

**The server has no auth.** It binds to 127.0.0.1 and exposes `bash`. Never set
`AICL_HOST=0.0.0.0` on a shared network.

## Layout

```
server/            Node, run with strip-types (no build). One module per feature.
  main.ts          wiring: relay, store, feature modules, Pi agent factory, session hub, HTTP + WS routing
  agent.ts         Pi session factory + the base system prompt
  sessions.ts      session hub: many Pi sessions, index.json, one run per session (409 when busy)
  pi-mapper.ts     Pi agent events → @aicl/core StreamEvents
  relay.ts         server→browser SSE (/api/events) + request/response to the open canvas
  feature.ts       FeatureModule contract
  tools.ts, ui-tools.ts, canvas-tools.ts, references.ts, applets.ts, hitl.ts, live.ts,
  nodes.ts, graph.ts, swarm.ts, workframes.ts, connections.ts
  surfaces/        registry.ts + one service per kind (terminal, browser, files, git, process, sideshow)
  exports.ts       ui_export_project + /api/export routes
  export/          the exporter: build.ts (spec → app model), vnode.ts (printers), targets.ts (projects), zip.ts
templates/         files copied into exports: shared/ (aicl-chat.js client, chat.css), server/ (ChatBackend + backends),
                   react/, react-tailwind/, vue/, svelte/, html/ (live Thread + Composer per framework)
shared/            Pure types/constants/functions imported by BOTH server and web. The contracts:
  runtime.ts       sessions, applets, addresses (aicl:/…), CanvasContext, ServerEvent union, HTTP index
  surfaces.ts      SurfaceKind, SurfaceInfo, addresses aicl:/surface/<kind>/<id>
  agentic.ts       HITL requests, live plans, terminal chunks, canvas graph, GATED_TOOLS
  components.ts    the canvas component catalog
  scratch.ts, ui-spec.ts, ui-ops.ts, canvas-*.ts, kits.ts, swarm.ts, git.ts, chat-tree.ts
web/               Vite + React 18 (root of the Vite project; index.html, gallery.html)
  main.tsx → shell/Shell.tsx   tabs: agent | canvas | overview | agents | view (hash router: router.ts)
  shell/           TopBar, AgentPage, OverviewPage, ViewPage
  app/             the chat product: Conversation, Sessions/ChatTree sidebar, WorkPanel, Palette, Settings
  kits/            conversation rendering (one design: KITS.assistant; other kits are canvas screen presets)
  Scratchpad.tsx, executor*.ts   tldraw canvas; executes scratch-ops from the relay
  catalog/         renderers for canvas components (keyed by shared/components.ts names)
  surfaces/        one lazy view per surface kind + <SurfaceView>
  workspace/       canvas chrome: FloatingChat copilot (Canvas tab only), work frames, presence
  swarm/, applets/, files/, ui/, agentic/, gallery/
bin/aicl.mjs       zero-dependency CLI over /api/tools
bin/aicl-mcp.mjs   stdio MCP server proxying /api/tools + surfaces as resources
skill/aicl-canvas/ skill for external agents driving the canvas
e2e/               Playwright suites against a live server (see Testing)
```

### Workspace state on disk (`$AICL_WORKSPACE/.aicl/`)

`sessions/` (Pi `.jsonl` transcripts + `index.json`), `scratchpad.json` (canvas snapshot),
`applets/<id>.tsx` + `<id>.server.ts` (agent-written widgets, built into `.build/`),
`workspace.json` (Overview layout), `exports/` (zips from ui_export_project), `hitl.json` (answered approvals and questions),
`plans/`, `terminal/`, `terminals/`, `reviews/`, `swarm-log.json`, `sideshow.json`,
`sideshow-cards.json`. Point `AICL_WORKSPACE` at a temp dir for anything destructive.

## How a chat turn flows

1. The browser posts `POST /api/chat { messages, sessionId?, canvasContext?, context? }` via
   `createSseTransport` with a custom `fetch` (`web/chatStore.ts` `withCanvasContext`) that adds
   what the user has selected and staged.
2. `main.ts` takes **only the last user message's text**. The server-side Pi session owns the
   history, so client-side `edit`/`regenerate` do not rewrite it. The canvas and staged context
   are appended as a hidden `<canvas-context>` block, along with each feature's `contextFor()`.
3. `hub.reserve(sessionId)` claims the session (409 if it is already running), then `hub.run`
   prompts Pi and `pi-mapper.ts` turns Pi events into one AICL assistant message whose tool
   cards are inline.
4. Tools that touch the canvas call `relay.request(op)`. The **newest connected browser tab**
   applies the op with the real tldraw API and posts back to `/api/scratch/result`. With no tab
   open, the call fails with `NoCanvasError` (`scratch_read` falls back to `scratchpad.json`),
   and an unanswered op times out after 15 s.
5. Everything else the UI shows live (sessions, surfaces, approvals, plans, terminal chunks,
   swarm events) arrives as `ServerEvent`s on `GET /api/events` (`shared/runtime.ts`), consumed
   with `onServerEvent(type, handler)` from `web/events.ts`.

## Agent tools

Every custom tool is a Pi `defineTool` with TypeBox parameters, returning
`{ content: [{ type: 'text', text }], details: {} }` (or an `image` part). Every tool in
`allTools()` (`main.ts`) is automatically available in-app, over `GET /api/tools` /
`POST /api/tools/:name`, through the CLI (`aicl call <tool> '<json>'`), and over MCP. The
built-in Pi tools `read grep find ls write edit bash` are in-app only.

| Module | Tools |
|---|---|
| `tools.ts` | `scratch_read scratch_view scratch_add scratch_update scratch_delete scratch_clear` |
| `ui-tools.ts` | `ui_create_screen ui_read_screen ui_patch_screen ui_set_theme ui_export_code ui_list_screens` |
| `canvas-tools.ts` | `canvas_arrange canvas_focus` |
| `graph.ts` | `canvas_graph canvas_changes` |
| `references.ts` | `ref_search ref_place` |
| `applets.ts` | `applet_build applet_list applet_logs applet_place applet_open` |
| `hitl.ts` | `ask_user` |
| `live.ts` | `plan_update` |
| `nodes.ts` | `agent_send` (talk to an agent node on the canvas) |
| `swarm.ts` | `spawn_agent agent_wait agent_status agent_message agent_stop` |
| `surfaces/terminal.ts` | `terminal_open terminal_run terminal_read` |
| `surfaces/browser.ts` | `browser_open browser_snapshot browser_click browser_type browser_read browser_screenshot` |
| `surfaces/files.ts` | `file_open file_reveal` |
| `surfaces/git.ts` | `git_status diff_show review_open review_comment review_submit git_commit git_branch` |
| `surfaces/process.ts` | `process_start process_list process_stop process_logs` |
| `surfaces/sideshow.ts` | `sideshow_publish sideshow_comments` |
| `exports.ts` | `ui_export_project` |

### Approvals (human in the loop)

- `bash` and `terminal_run` (`GATED_TOOLS` in `shared/agentic.ts`) always pause for an approval
  card. They are gated in the Pi `tool_call` hook (`hitl.ts`) **and** in `POST /api/tools/:name`,
  because HTTP callers bypass Pi.
- `write`/`edit` outside `.aicl/` are gated in the Pi hook. Writes inside `.aicl/` are free, which
  is how the agent authors applets.
- `process_start`, `git_commit`, `review_submit` and each new browser host call
  `requestApproval()` from their own code.
- An approval waits until someone answers in the UI, or until the turn is aborted. An HTTP or
  MCP call to a gated tool blocks with no timeout while nobody is looking. A decline comes back
  as `The user declined: <note>`.

## Recipes

**Add an agent tool.** Define it with `defineTool` + TypeBox next to related tools. Return it
from a feature module's `tools`, or from a `create*Tools` function listed in `allTools()`. To
learn which session called it, use `sessionIdFromToolContext(ctx)` (`server/session-context.ts`).
If it can do something irreversible, `await requestApproval({ tool, summary, input, sessionId })`
from `hitl.ts` and stop on `!approved`. Write the description for the model: it is the only
documentation the agent sees. Test it in `server/<module>.test.ts`.

**Add a feature module.** Create `server/<name>.ts` exporting
`create<Name>(context: FeatureContext): FeatureModule` (`server/feature.ts`). It can provide
`routes` (`"METHOD /api/path/:param"` keys), `tools`, `prompt` (appended to the system prompt),
`extensions` (Pi inline extensions), `contextFor(sessionId)`, `onAgentEvent`, and `upgrades`
(WebSocket path prefixes). Add it to the `features` array in `main.ts`. Call
`context.hub()` lazily, because the hub is created after the modules. New broadcasts must be added
to the `ServerEvent` union in `shared/runtime.ts`.

**Add a canvas component.** Add one entry to `COMPONENTS` in `shared/components.ts` (name,
title, one-line description, `propsHint`, `defaultSize`, a valid `sample`) and one renderer in
`web/catalog/index.ts` (`renderers`, typed `ComponentRenderer`). Props arrive as untrusted
JSON, so normalise them like `web/catalog/renderers.tsx` does. The `scratch_add` description,
the insert menu and `server/scratch-components.test.ts` pick the entry up.

**Add a surface kind.** Extend `SurfaceKind` and `SURFACE_KINDS` in `shared/surfaces.ts`.
Write `server/surfaces/<kind>.ts` as a feature module built with `SurfaceContext`: call
`surfaces.upsert/patch/remove`, register `surfaces.onClose(kind, …)`, put routes under
`/api/surfaces/<kind>/…` and sockets under `/ws/<kind>/…`. Add it to `features`. Then write
`web/surfaces/<kind>.tsx` with a default export taking `SurfaceViewProps`, and add it to `views`
in `web/surfaces/index.tsx`. Add `aicl surface open <kind>` in `bin/aicl.mjs` if external agents
should open it.

## Export pipeline

A canvas screen (a `ScreenSpec`, `shared/ui-spec.ts`) exports as a working app: `exportProject(spec, target)` in `server/export/targets.ts` for `react`, `react-tailwind`, `vue`, `svelte`, `html` or `json`.

- `build.ts` turns the spec into a static element tree with two live slots. The **thread** is the container with the most conversation elements; its children become seed messages, and non-message elements become pre-rendered `html` parts. The **composer** is the first `composer` node. If either is missing, it is inserted.
- `vnode.ts` prints that tree as JSX, a Vue or Svelte template (braces are escaped), HTML, or JSX with Tailwind classes (`styleToTailwind`). Layout and theme logic is shared with `toReactCode` through the helpers exported from `shared/ui-ops.ts`.
- `templates/` holds the runtime files copied verbatim into every export: the dependency-free chat client (`shared/chat.js`, shipped as `aicl-chat.js`; never name it `chat.js` next to `Chat.tsx`, because case-insensitive filesystems collide), the live components for each framework, and `server/` (`ChatBackend` plus the `anthropic`, `openai` and `echo` backends, and the HTTP server). These files are **not** covered by the workspace `tsc`. They are verified by `server/export.test.ts` (unit) and `e2e/export.mjs` (install, typecheck, build and chat in Chromium for every target).
- To add a target, add it to `shared/export-targets.ts`, write a project function in `targets.ts`, put its runtime files under `templates/<target>/`, and extend `e2e/export.mjs`.

## Conventions

- **Server and shared code must stay strip-types compatible**: import with explicit `.ts`
  extensions, use `import type` for types (`verbatimModuleSyntax`), and avoid `enum`,
  `namespace` and constructor parameter properties.
- `shared/` is pure: no Node or DOM APIs, no side effects. Both sides import it.
- The web build resolves `@aicl/*` to package **sources** (Vite aliases, tsconfig `paths`), so
  web edits to packages hot-reload. The **server** resolves `@aicl/server` through
  `node_modules` to `packages/server/dist`, so after changing `packages/server` run
  `npm run build` at the root.
- The in-app agent runs with the user's Pi extensions, skills, prompt templates and context
  files **disabled** (`agent.ts`). Repository `AGENTS.md` files are not loaded into it. Give it
  guidance through `SYSTEM_PROMPT` or a feature module's `prompt`.
- Ticket references in comments (`AICL-41`) are Linear issues. "Wave" and "work package"
  labels refer to the order the app was built in (`git log`).

## Testing

| Command | What | Needs |
|---|---|---|
| `npm run typecheck` | `tsc` over `server`, `shared`, `web` | nothing |
| `npm test` | `node --test server/*.test.ts` (212 tests, fakes for Pi) | nothing |
| `node e2e/export.mjs [--dir=… --only=react,html --shots=…]` | every export target installs, typechecks, builds, and chats on the echo backend | network for `npm install`; no model |
| `node --experimental-strip-types --no-warnings e2e/codegen-check/check.ts` | generated screen code typechecks against `@aicl/react` | nothing |
| `node e2e/<suite>.mjs <flag>` | Playwright against a live server | live `npm run dev`, real model, throwaway `AICL_WORKSPACE`, Chromium |

The e2e suites refuse to run without a safety flag, because they clear the canvas or write
into the workspace:

| Suite | Flag | Covers |
|---|---|---|
| `app.mjs` | `--scratch-workspace` (`--headless`) | the chat product end to end, approvals, work panel, model picker |
| `sidebar.mjs` | `--scratch-workspace` | folders, pin, archive, rename, search (no model calls) |
| `workspace.mjs` | `--scratch-workspace` | sessions, applets, Overview (expects `notes.md`) |
| `canvas.mjs` (`npm run e2e`) | `--clears-canvas` | every component, canvas chat, reload |
| `agentic.mjs` | `--clears-canvas` | questions, approvals, live terminal, agent cards, graph |
| `design.mjs` | `--clears-canvas` | UI screens on the canvas |
| `swarm.mjs` | `--clears-canvas` | multi-agent spawn, stop, steer, lineage |
| `workspace-canvas.mjs` | `--clears-canvas` | work frames, presence, follow, canvas-first mode |
| `chaos.mjs` | `--clears-canvas` | starts and kills its own server, offline, renderer crash |
| `terminal.mjs`, `process.mjs`, `mcp.mjs`, `sideshow.mjs` | — | surfaces, MCP bridge with an approval (sideshow needs `E2E_CARD`) |
| `showcase.mjs` | `--scratch-workspace` (`--skip-agent`, `--out=`) | regenerates the README screenshots in `docs/screenshots/` |

Run them on spare ports so you don't touch the user's instance, for example
`AICL_PORT=5192 AICL_WEB_PORT=5193 AICL_WORKSPACE=$(mktemp -d) npm run dev`, then
`E2E_API=http://127.0.0.1:5192 E2E_WEB=http://localhost:5193 node e2e/app.mjs --scratch-workspace --headless`.
The suites use `playwright-core`, which downloads no browsers. If Chromium is missing, run
`npx playwright-core install chromium`. The browser surface uses the same headless Chromium,
launched lazily on the first `browser_open`.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `Cannot find module …/packages/server/dist/index.js` | Root `npm run build` not run |
| Server exits at startup with an unknown-model error | `AICL_MODEL` not resolvable by your Pi setup |
| `The scratchpad is not open in a browser` | No tab connected to `/api/events`. Open `localhost:5181` |
| `The canvas did not answer within 15s` | The tab is backgrounded or crashed. Reload it |
| `409 The agent is still working` | One run per session. Stop it (`POST /api/sessions/:id/stop`) or wait |
| `posix_spawnp failed` from terminals | node-pty helper lost its execute bit. Re-run `npm install` (postinstall) |
| A gated CLI/MCP call hangs | It is waiting for an approval card in the UI |
| An exported app says the `anthropic` backend needs `@anthropic-ai/sdk` | `ANTHROPIC_API_KEY` is set but the export has not run `npm install`. It falls back to echo until then |
| `logs/` directories everywhere | Written by local Claude Code hooks and git-ignored. Ignore them |
