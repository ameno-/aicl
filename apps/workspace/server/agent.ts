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
- Use color with meaning and sparingly. Keep labels short.
- Never clear or delete the user's shapes unless they ask.

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
