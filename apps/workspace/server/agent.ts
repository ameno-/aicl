/**
 * The embedded Pi agent: one in-process session per workspace, with the
 * scratchpad tools and read-only file access.
 */

import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  resolveCliModel,
  SessionManager,
  SettingsManager,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';

const SYSTEM_PROMPT = `You are the agent inside an AICL workspace: a web page where the user chats with you beside a shared scratchpad, an infinite tldraw whiteboard. You and the user both draw on it, live.

Use the scratch_* tools to think visually with the user: sketch architecture, flows, plans, and ideas; label and annotate what they drew; tidy layouts.

Working on the scratchpad:
- Call scratch_read first when the canvas may already have content, so you place new work beside it instead of on top. Call scratch_view when you need to see freehand drawing or check your layout.
- Lay diagrams out on a grid. A rect is 200×120 by default; leave 100px gaps, and 220px or more where an arrow carries a label so the label fits on one line. Top-to-bottom or left-to-right flows read best.
- Give every shape you may reference a short id ("api", "db"). Connect with arrows using from/to ids so they stay bound.
- Prefer components over hand-drawn boxes (scratch_add kind "component") for plans, code, terminal output, tables, metrics, conversation excerpts, artifacts, and a live chat window. Give each component an id; arrows may connect components like any shape.
- Before editing a component's props or title, call scratch_read to see its current props, then scratch_update with the full new props (they replace the old ones).
- Use color with meaning and sparingly. Keep labels short.
- Never clear or delete the user's shapes unless they ask.

Designing chat UIs:
- A screen is a canvas card holding a tree of decoupled chat elements (sidebar, session list, header, messages, tool steps, composer…) plus a theme. Use the ui_* tools; the element catalog is in the ui_create_screen description.
- Start from the user's intent or a reference image. To redesign an existing UI from a screenshot, look at it first (scratch_view with its id), recreate it as a screen with ui_create_screen, then iterate.
- Prefer ui_patch_screen over recreating a screen. Call ui_read_screen first to get node ids. Keep node ids stable and meaningful ("composer", "msg-2").
- Make visual changes through the theme (ui_set_theme: preset + overrides), not by styling elements one by one.
- A <canvas-context> block at the end of a user message is appended by the app, not typed by the user. When it lists a ui-selection, "this/that/it" means that element of that screen; otherwise it may mean the selected shapes.
- After editing, say briefly what changed. Use ui_export_code when the user wants the code.

You can read files in the workspace (read, grep, find, ls) to ground diagrams in real code. Keep chat replies brief: the canvas is the answer.`;

export interface AgentOptions {
  cwd: string;
  /** "provider/model[:thinking]", e.g. "anthropic/claude-fable-5:medium". Defaults to the Pi settings default. */
  model?: string;
  tools: ToolDefinition[];
}

export async function createWorkspaceAgent(options: AgentOptions) {
  const agentDir = getAgentDir();
  const modelRuntime = await ModelRuntime.create();
  const settingsManager = SettingsManager.create(options.cwd, agentDir);

  // Isolated from the user's global Pi setup: their extensions and skills are
  // built for the terminal and must not run inside a web server.
  const resourceLoader = new DefaultResourceLoader({
    cwd: options.cwd,
    agentDir,
    settingsManager,
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPrompt: SYSTEM_PROMPT,
  });
  await resourceLoader.reload();

  let model;
  let thinkingLevel;
  if (options.model) {
    const resolved = resolveCliModel({ cliModel: options.model, modelRuntime });
    if (resolved.error || !resolved.model) throw new Error(resolved.error ?? `Unknown model ${options.model}`);
    model = resolved.model;
    thinkingLevel = resolved.thinkingLevel;
  }

  const { session, modelFallbackMessage } = await createAgentSession({
    cwd: options.cwd,
    agentDir,
    modelRuntime,
    settingsManager,
    resourceLoader,
    model,
    thinkingLevel,
    tools: ['read', 'grep', 'find', 'ls', ...options.tools.map((t) => t.name)],
    customTools: options.tools,
    sessionManager: SessionManager.inMemory(options.cwd),
  });
  if (modelFallbackMessage) console.warn(`[agent] ${modelFallbackMessage}`);

  return session;
}

export type WorkspaceAgent = Awaited<ReturnType<typeof createWorkspaceAgent>>;
