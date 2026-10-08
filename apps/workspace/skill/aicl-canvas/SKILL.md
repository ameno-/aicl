---
name: aicl-canvas
description: Drive the user's running AICL workspace (a shared tldraw canvas with screens, components and applets) through the `aicl` CLI. Use when asked to draw, mock up UI screens, place components, tidy or show things on the shared canvas/board, or to see what is on it.
---

# aicl-canvas

The user has the AICL workspace open in a browser. You share its canvas with them and with the in-app agent. The `aicl` CLI calls the same tools the in-app agent has. Changes appear live in the user's browser.

Run it as `node <repo>/apps/workspace/bin/aicl.mjs` (or `aicl` if linked). Server defaults to `http://127.0.0.1:5180`; override with `--url` or `AICL_URL`. If it cannot connect or says no canvas is open, ask the user to start/open the workspace.

## Loop

1. **Look first.** `aicl read` lists every shape (id, kind, position, size, text). `aicl view --out /tmp/board.png` renders the board; open the PNG to see layout. `aicl view --ids a,b` renders only some shapes. `aicl screens` lists UI screens.
2. **Discover tools.** `aicl tools` lists names and parameters. Anything is callable: `aicl call <tool> '<json>'`. Add `--json` for raw output.
3. **Make things.** Give shapes stable ids so you can edit and bind arrows later.
   - `aicl add '[{"kind":"note","id":"n1","x":0,"y":0,"text":"Idea"}]'` (kinds: text, rect, ellipse, note, arrow, component, image).
   - Components: `{"kind":"component","component":"<name>","props":{...}}`; the `scratch_add` description from `aicl tools --json` lists every component and its props.
   - UI screens, edits and applets use dedicated tools (see `aicl tools`; names start with `ui_`, `applet_` etc). Read the tool description before the first call.
   - Edit with `aicl call scratch_update '{"shapes":[{"id":"n1","text":"New"}]}'`; remove with `scratch_delete`.
4. **Tidy.** Do not compute coordinates by hand:
   `aicl call canvas_arrange '{"ids":["n1","n2","n3"],"mode":"stack-horizontal","gap":40}'`
   Modes: align-left, align-center-horizontal, align-right, align-top, align-center-vertical, align-bottom, distribute-horizontal, distribute-vertical, stack-horizontal, stack-vertical, grid.
5. **Show the user.** End visual work with `aicl call canvas_focus '{"ids":["n1","n2","n3"]}'`; it animates their camera to what you made. `aicl open aicl:/overview` switches tab (aicl:/canvas, aicl:/agent, aicl:/views/<id>).
6. **Verify.** `aicl view --out /tmp/board.png` again and look at it before saying you are done.

## Conventions (same as the in-app agent)

- The user may be mid-drag: `aicl read` before editing, never overwrite their shapes, never `scratch_clear` unless asked.
- Place new work next to existing content, not far away; add without x/y to flow to the right of the board.
- Add boxes before the arrows that bind to them. Arrow `from`/`to` are shape ids.
- Short, stable ids ("gateway", "s1"); ids you pass are returned in results.
- Tool failures come back as `aicl: <message>` with exit code 1; fix the input and retry.

## Surfaces, processes and MCP

The workspace also has live **surfaces**: terminals, a browser, files, diffs and background processes. They are shared with the user, who watches and can take over.

- `aicl surface list` shows what is open; `aicl surface open terminal|browser <url>|file <path[:line]>|diff [target]`; `aicl surface close <kind> <id>`.
- Dev servers and watchers: `aicl process start 'npm run dev' --name web` (not a shell `&`, not `terminal_run`, which waits for the end). It needs the user's approval in the AICL window and returns the detected port. Then `aicl surface open browser http://localhost:<port>`. `aicl process list|logs <id> [--lines N]|stop <id>`.
- Gated tools (`terminal_run`, `process_start`, git commits...) always wait for the user's approval in the AICL UI, from the CLI and from MCP alike. A decline comes back as an error; do not retry the same call.

### MCP (Claude Code, Pi, any MCP client)

`bin/aicl-mcp.mjs` is a stdio MCP server that exposes every tool above as an MCP tool and every open surface as a resource (`aicl://surface/<kind>/<id>`: its state plus terminal or process output). It needs the workspace running.

```bash
claude mcp add aicl -- node <repo>/apps/workspace/bin/aicl-mcp.mjs --url http://127.0.0.1:5180
```

Or in `.mcp.json`: `{"mcpServers":{"aicl":{"command":"node","args":["<repo>/apps/workspace/bin/aicl-mcp.mjs","--url","http://127.0.0.1:5180"]}}}`. `--url` defaults to `$AICL_URL` or `http://127.0.0.1:5180`.
