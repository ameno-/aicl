/**
 * The canvas component catalog: which AICL components the agent (and the
 * user) can place on the scratchpad as live shapes.
 *
 * Pure data, shared by the server (tool descriptions, validation) and the
 * browser (renderers in web/catalog, keyed by `name`). Adding a component is
 * one entry here plus one renderer there.
 */

export const COMPONENT_SHAPE_TYPE = 'aicl-component';

export interface ComponentSpec {
  /** Stable id the agent uses, e.g. "plan". */
  name: string;
  /** Default header title on the canvas. */
  title: string;
  /** One line for the agent's tool description. */
  description: string;
  /** The `props` JSON the agent should send, as a compact TypeScript-ish hint. */
  propsHint: string;
  defaultSize: { w: number; h: number };
  /** Valid example props: used for the insert menu, the gallery, and tests. */
  sample: Record<string, unknown>;
}

export const COMPONENTS: ComponentSpec[] = [
  {
    name: 'chat',
    title: 'Chat',
    description:
      'A live chat window bound to this workspace conversation. The user can read and reply to the agent from inside the canvas.',
    propsHint: '{}',
    defaultSize: { w: 380, h: 480 },
    sample: {},
  },
  {
    name: 'plan',
    title: 'Plan',
    description: 'An ordered checklist of steps with status and a done/total rollup. Use for plans and progress.',
    propsHint: "{ title?: string; steps: { label: string; status: 'pending' | 'running' | 'done' | 'error' }[] }",
    defaultSize: { w: 340, h: 220 },
    sample: {
      title: 'Ship the canvas components',
      steps: [
        { label: 'Define the catalog contract', status: 'done' },
        { label: 'Render components as shapes', status: 'running' },
        { label: 'Let the agent place them', status: 'pending' },
      ],
    },
  },
  {
    name: 'code',
    title: 'Code',
    description: 'A code block with a language label and copy button. Use for snippets, configs, and diffs.',
    propsHint: '{ language?: string; content: string }',
    defaultSize: { w: 460, h: 240 },
    sample: { language: 'ts', content: "export function greet(name: string) {\n  return `Hello, ${name}`;\n}" },
  },
  {
    name: 'terminal',
    title: 'Terminal',
    description: 'Terminal output lines. Use to show commands and their results.',
    propsHint: '{ lines: string[] }',
    defaultSize: { w: 460, h: 220 },
    sample: { lines: ['$ npm test', '✔ 16 passing', '# fail 0'] },
  },
  {
    name: 'artifact',
    title: 'Artifact',
    description: 'A card for a produced artifact (document, diff, preview, table, chart, code, terminal) with kind and version.',
    propsHint: "{ title: string; kind: 'code' | 'document' | 'diff' | 'preview' | 'terminal' | 'table' | 'chart'; version?: number }",
    defaultSize: { w: 360, h: 112 },
    sample: { title: 'Q4 roadmap', kind: 'document', version: 3 },
  },
  {
    name: 'transcript',
    title: 'Conversation',
    description: 'A read-only conversation excerpt with Markdown replies. Use to quote or mock up a chat exchange.',
    propsHint: "{ messages: { role: 'user' | 'assistant'; text: string }[] }",
    defaultSize: { w: 400, h: 320 },
    sample: {
      messages: [
        { role: 'user', text: 'Why does the send button fire twice?' },
        { role: 'assistant', text: 'The status flips **after** the request starts. Move it *before* the await.' },
      ],
    },
  },
  {
    name: 'table',
    title: 'Table',
    description: 'A small data table. Use for comparisons and structured results.',
    propsHint: '{ columns: string[]; rows: (string | number)[][] }',
    defaultSize: { w: 420, h: 200 },
    sample: {
      columns: ['Product', 'Composer', 'Plan'],
      rows: [
        ['Devin', 'card + model', 'Worked for…'],
        ['Manus', 'card + tools', 'step list'],
      ],
    },
  },
  {
    name: 'metric',
    title: 'Metric',
    description: 'A single headline number with label and optional delta. Use for KPIs and status at a glance.',
    propsHint: "{ label: string; value: string | number; delta?: string; trend?: 'up' | 'down' | 'flat' }",
    defaultSize: { w: 220, h: 120 },
    sample: { label: 'Tests passing', value: 44, delta: '+4 today', trend: 'up' },
  },
];

export const COMPONENT_NAMES = COMPONENTS.map((c) => c.name);

export const componentSpec = (name: string): ComponentSpec | undefined => COMPONENTS.find((c) => c.name === name);

/** Props stored on an `aicl-component` tldraw shape. */
export interface ComponentShapeProps {
  w: number;
  h: number;
  component: string;
  title: string;
  /** JSON; renderers normalise and report bad input, never throw. */
  props: Record<string, unknown>;
}
