import type { ComponentType } from 'react';
import { createRendererRegistry, type ToolCallPart } from '@aicl/core';
import { ToolCallDisclosure, UnknownPart, type PartProps } from '@aicl/react';
import { MarkdownTextPart } from '@aicl/react/markdown';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { toolRenderers } from './agentic/toolRenderers.tsx';

const count = (args: unknown, key: string) => {
  const list = (args as Record<string, unknown> | undefined)?.[key];
  return Array.isArray(list) ? list.length : 0;
};
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
/** "localhost:5173/app" from a URL argument; the raw text when it does not parse. */
const host = (url: unknown): string => {
  try {
    const u = new URL(String(url));
    return `${u.host}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return String(url ?? 'a page');
  }
};

/** Agent steps in the product's voice ("Drew 4 shapes"), not tool ids. */
export function describe(part: ToolCallPart): string {
  const done = part.status === 'success';
  const args = part.args as Record<string, unknown> | undefined;
  switch (part.name) {
    case 'scratch_read':
      return done ? 'Read the canvas' : 'Reading the canvas';
    case 'scratch_view': {
      const n = count(args, 'ids');
      if (n) return `${done ? 'Looked closely at' : 'Looking closely at'} ${n === 1 ? 'one element' : plural(n, 'element')}`;
      return done ? 'Looked at the canvas' : 'Looking at the canvas';
    }
    case 'scratch_add': {
      // Say what was made: "Placed 3 components and 1 arrow", not "Drew 4 shapes".
      const shapes = Array.isArray(args?.['shapes']) ? (args!['shapes'] as Array<{ kind?: string }>) : [];
      const components = shapes.filter((s) => s.kind === 'component').length;
      const arrows = shapes.filter((s) => s.kind === 'arrow').length;
      const other = shapes.length - components - arrows;
      const parts = [
        components ? plural(components, 'component') : '',
        other ? plural(other, 'shape') : '',
        arrows ? plural(arrows, 'arrow') : '',
      ].filter(Boolean);
      const what = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? '');
      const verb = components ? (done ? 'Placed' : 'Placing') : done ? 'Drew' : 'Drawing';
      return what ? `${verb} ${what}` : verb;
    }
    case 'scratch_update':
      return done ? `Edited ${plural(count(args, 'shapes'), 'shape')}` : 'Editing shapes';
    case 'scratch_delete':
      return done ? `Deleted ${plural(count(args, 'ids'), 'shape')}` : 'Deleting shapes';
    case 'scratch_clear':
      return done ? 'Cleared the canvas' : 'Clearing the canvas';
    case 'ref_search': {
      const q = [args?.['product'], args?.['archetype'], args?.['component'], args?.['text']].filter(Boolean).join(' ');
      return `${done ? 'Searched' : 'Searching'} references${q ? ` for ${String(q)}` : ''}`;
    }
    case 'write':
      return `${done ? 'Wrote' : 'Writing'} ${String(args?.['path'] ?? 'a file')}`;
    case 'edit':
      return `${done ? 'Edited' : 'Editing'} ${String(args?.['path'] ?? 'a file')}`;
    case 'applet_build':
      return `${done ? 'Built' : 'Building'} applet ${String(args?.['id'] ?? '')}`.trim();
    case 'applet_place':
      return `${done ? 'Placed' : 'Placing'} ${String(args?.['id'] ?? 'applet')} on the ${args?.['where'] === 'canvas' ? 'canvas' : 'Overview'}`;
    case 'applet_open':
      return `${done ? 'Opened' : 'Opening'} ${String(args?.['id'] ?? 'applet')}`;
    case 'applet_list':
      return done ? 'Listed applets' : 'Listing applets';
    case 'applet_logs':
      return `${done ? 'Checked' : 'Checking'} ${String(args?.['id'] ?? 'applet')} for errors`;
    case 'canvas_arrange':
      return `${done ? 'Arranged' : 'Arranging'} ${plural(count(args, 'ids'), 'shape')}`;
    case 'canvas_focus':
      return done ? 'Showed you the result' : 'Showing you the result';
    case 'ref_place':
      return done ? 'Placed a reference screenshot' : 'Placing a reference screenshot';
    case 'ui_create_screen':
      return done ? `Created screen ${String(args?.['name'] ?? '')}`.trim() : 'Creating a screen';
    case 'ui_read_screen':
      return done ? 'Read screen' : 'Reading screen';
    case 'ui_patch_screen': {
      const n = count(args, 'ops');
      return done ? `Edited screen${n ? ` · ${plural(n, 'change')}` : ''}` : 'Editing screen';
    }
    case 'ui_set_theme':
      return done ? 'Restyled screen' : 'Restyling screen';
    case 'ui_export_code':
      return done ? 'Exported code' : 'Exporting code';
    case 'ui_list_screens':
      return done ? 'Listed screens' : 'Listing screens';
    case 'read':
      return `${done ? 'Read' : 'Reading'} ${String(args?.['path'] ?? 'a file')}`;
    case 'grep':
    case 'find':
      return `${done ? 'Searched' : 'Searching'} for ${String(args?.['pattern'] ?? 'files')}`;
    case 'ls':
      return `${done ? 'Listed' : 'Listing'} ${String(args?.['path'] ?? 'files')}`;
    case 'canvas_graph':
      return done ? 'Checked what is near what' : 'Checking what is near what';
    case 'canvas_changes':
      return done ? 'Reviewed canvas changes' : 'Reviewing canvas changes';
    case 'agent_send':
      return `${done ? 'Asked' : 'Asking'} ${String(args?.['to'] ?? 'an agent')}`;
    // Wave 4: surfaces (shared/surfaces.ts) and sub-agents.
    case 'terminal_open':
      return done ? 'Opened a terminal' : 'Opening a terminal';
    case 'terminal_run':
      return `${done ? 'Ran' : 'Running'} ${String(args?.['command'] ?? 'a command')}`;
    case 'terminal_read':
      return done ? 'Read the terminal' : 'Reading the terminal';
    case 'browser_open':
      return `${done ? 'Opened' : 'Opening'} ${host(args?.['url'])}`;
    case 'browser_snapshot':
      return done ? 'Looked at the page' : 'Looking at the page';
    case 'browser_screenshot':
      return done ? 'Took a screenshot' : 'Taking a screenshot';
    case 'browser_click':
      return `${done ? 'Clicked' : 'Clicking'} ${String(args?.['text'] ?? args?.['ref'] ?? args?.['selector'] ?? 'on the page')}`;
    case 'browser_type':
      return done ? 'Typed into the page' : 'Typing into the page';
    case 'browser_read':
      return done ? 'Read the page' : 'Reading the page';
    case 'file_open':
      return `${done ? 'Opened' : 'Opening'} ${String(args?.['path'] ?? 'a file')}`;
    case 'file_reveal':
      return `${done ? 'Pointed at' : 'Pointing at'} ${String(args?.['path'] ?? 'code')}${args?.['startLine'] ? `:${String(args['startLine'])}` : ''}`;
    case 'git_status':
      return done ? 'Checked git status' : 'Checking git status';
    case 'diff_show':
      return args?.['target'] === 'turn' ? (done ? 'Showed this turn’s changes' : 'Showing this turn’s changes') : done ? 'Showed the diff' : 'Showing the diff';
    case 'git_commit':
      return done ? 'Committed' : 'Committing';
    case 'git_branch':
      return `${done ? 'Created branch' : 'Creating branch'} ${String(args?.['name'] ?? '')}`.trim();
    case 'review_open':
      return `${done ? 'Opened' : 'Opening'} PR ${String(args?.['pr'] ?? '')}`.trim();
    case 'review_comment':
      return done ? 'Drafted a review comment' : 'Drafting a review comment';
    case 'review_submit':
      return done ? 'Submitted the review' : 'Submitting the review';
    case 'spawn_agent':
      return `${done ? 'Delegated to' : 'Delegating to'} ${String(args?.['name'] ?? 'an agent')}`;
    case 'agent_wait':
      return done ? `Collected ${plural(count(args, 'ids'), 'agent')}` : `Waiting for ${plural(count(args, 'ids'), 'agent')}`;
    case 'agent_status':
      return done ? 'Checked on sub-agents' : 'Checking on sub-agents';
    case 'agent_message':
      return done ? 'Steered a sub-agent' : 'Steering a sub-agent';
    case 'agent_stop':
      return done ? 'Stopped a sub-agent' : 'Stopping a sub-agent';
    default:
      return part.name;
  }
}

function AgentStepInner(props: PartProps) {
  if (props.part.type !== 'tool-call') return null;
  // Wave 2: some tools render as live components (questions, plans, terminals).
  const Live = toolRenderers[props.part.name];
  if (Live) return <Live {...props} />;
  return <ToolCallDisclosure {...props} part={{ ...props.part, name: describe(props.part) }} />;
}

/** A tool renderer that throws takes down its own step, never the transcript. */
export function AgentStep(props: PartProps) {
  const part = props.part;
  return (
    <ErrorBoundary label="message part" resetKeys={[part.type === 'tool-call' ? part.status : part]}>
      <AgentStepInner {...props} />
    </ErrorBoundary>
  );
}

function SafeText(props: PartProps) {
  const Text = MarkdownTextPart as ComponentType<PartProps>;
  return (
    <ErrorBoundary label="message part">
      <Text {...props} />
    </ErrorBoundary>
  );
}

/** Only overrides: PartRenderer falls back to the defaults for every other type. */
export const workspaceRegistry = createRendererRegistry<ComponentType<PartProps>>(
  { text: SafeText, 'tool-call': AgentStep },
  UnknownPart,
);
