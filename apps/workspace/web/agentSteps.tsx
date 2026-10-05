import type { ComponentType } from 'react';
import { createRendererRegistry, type ToolCallPart } from '@aicl/core';
import { ToolCallDisclosure, UnknownPart, type PartProps } from '@aicl/react';
import { MarkdownTextPart } from '@aicl/react/markdown';

const count = (args: unknown, key: string) => {
  const list = (args as Record<string, unknown> | undefined)?.[key];
  return Array.isArray(list) ? list.length : 0;
};
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** Agent steps in the product's voice ("Drew 4 shapes"), not tool ids. */
export function describe(part: ToolCallPart): string {
  const done = part.status === 'success';
  const args = part.args as Record<string, unknown> | undefined;
  switch (part.name) {
    case 'scratch_read':
      return done ? 'Read the canvas' : 'Reading the canvas';
    case 'scratch_view':
      return done ? 'Looked at the canvas' : 'Looking at the canvas';
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
    case 'read':
      return `${done ? 'Read' : 'Reading'} ${String(args?.['path'] ?? 'a file')}`;
    case 'grep':
    case 'find':
      return `${done ? 'Searched' : 'Searching'} for ${String(args?.['pattern'] ?? 'files')}`;
    case 'ls':
      return `${done ? 'Listed' : 'Listing'} ${String(args?.['path'] ?? 'files')}`;
    default:
      return part.name;
  }
}

export function AgentStep(props: PartProps) {
  if (props.part.type !== 'tool-call') return null;
  return <ToolCallDisclosure {...props} part={{ ...props.part, name: describe(props.part) }} />;
}

/** Only overrides: PartRenderer falls back to the defaults for every other type. */
export const workspaceRegistry = createRendererRegistry<ComponentType<PartProps>>(
  { text: MarkdownTextPart as ComponentType<PartProps>, 'tool-call': AgentStep },
  UnknownPart,
);
