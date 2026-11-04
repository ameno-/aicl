/**
 * The canvas prompt.
 *
 * A prompt places AICL primitives on a frame. The vocabulary is the list
 * below: a word that is not an input is refused, and the frame does not
 * invent a component for it. The JSX is the same arrangement the gallery
 * renders, so what you read is what you see.
 */

export interface PlaygroundInput {
  /** Stable id. The palette and the tests use it. */
  id: string;
  /** The palette label. */
  label: string;
  /** The primitive the block renders. A usage record owns the prose. */
  primitive: string;
  /** Phrases that place this block, longest first. Matched as whole words. */
  phrases: readonly string[];
  /** Named imports the snippet needs. */
  imports: readonly string[];
  /** The snippet, indented to sit inside `Screen`. */
  jsx: string;
}

export const PLAYGROUND_INPUTS = [
  {
    id: 'button',
    label: 'Button',
    primitive: 'Button',
    phrases: ['button'],
    imports: ['Button'],
    jsx: `      <Button>Continue</Button>`,
  },
  {
    id: 'badges',
    label: 'Badges',
    primitive: 'Badge',
    phrases: ['badges', 'badge'],
    imports: ['Badge'],
    jsx: `      <Badge>Default</Badge>
      <Badge variant="success">Live</Badge>
      <Badge variant="destructive">Failed</Badge>`,
  },
  {
    id: 'separator',
    label: 'Separator',
    primitive: 'Separator',
    phrases: ['separator', 'divider'],
    imports: ['Separator'],
    jsx: `      <Separator />`,
  },
  {
    id: 'kbd',
    label: 'Keycap',
    primitive: 'Kbd',
    phrases: ['keycap', 'shortcut', 'kbd'],
    imports: ['Kbd'],
    jsx: `      <span>Open the palette <Kbd>⌘K</Kbd></span>`,
  },
  {
    id: 'field',
    label: 'Field',
    primitive: 'Field',
    phrases: ['field', 'form'],
    imports: ['Field'],
    jsx: `      <Field label="API base URL" description="Used for new chats" required>
        <input defaultValue="http://localhost" />
      </Field>`,
  },
  {
    id: 'switch',
    label: 'Switch',
    primitive: 'Switch',
    phrases: ['switch', 'toggle'],
    imports: ['Switch'],
    jsx: `      <Switch checked={on} onCheckedChange={setOn} label="Stream reasoning" />`,
  },
  {
    id: 'select',
    label: 'Select',
    primitive: 'Select',
    phrases: ['select', 'model picker'],
    imports: ['Select'],
    jsx: `      <Select
        ariaLabel="Model"
        value="sonnet"
        onValueChange={() => {}}
        options={[
          { value: 'sonnet', label: 'Sonnet 5.5' },
          { value: 'opus', label: 'Opus 5.5' },
        ]}
      />`,
  },
  {
    id: 'segmented',
    label: 'Segmented control',
    primitive: 'SegmentedControl',
    phrases: ['segmented', 'choice'],
    imports: ['SegmentedControl'],
    jsx: `      <SegmentedControl
        ariaLabel="Layout"
        value="list"
        onValueChange={() => {}}
        options={[
          { value: 'list', label: 'List' },
          { value: 'grid', label: 'Grid' },
        ]}
      />`,
  },
  {
    id: 'progress',
    label: 'Progress',
    primitive: 'Progress',
    phrases: ['progress'],
    imports: ['Progress'],
    jsx: `      <Progress value={40} label="Tokens" />
      <Progress label="Working" />`,
  },
  {
    id: 'skeleton',
    label: 'Skeleton',
    primitive: 'Skeleton',
    phrases: ['skeleton'],
    imports: ['Skeleton'],
    jsx: `      <Skeleton width={160} />`,
  },
  {
    id: 'spinner',
    label: 'Spinner',
    primitive: 'Spinner',
    phrases: ['spinner'],
    imports: ['Spinner'],
    jsx: `      <Spinner label="Thinking" />`,
  },
  {
    id: 'alert',
    label: 'Alert',
    primitive: 'Alert',
    phrases: ['alert', 'warning'],
    imports: ['Alert'],
    jsx: `      <Alert variant="warning">
        <Alert.Title>Needs you</Alert.Title>
        <Alert.Description>Approve the command before the agent continues.</Alert.Description>
      </Alert>`,
  },
  {
    id: 'card',
    label: 'Card',
    primitive: 'Card',
    phrases: ['card'],
    imports: ['Badge', 'Card'],
    jsx: `      <Card>
        <Card.Header>
          <Card.Title>Plan</Card.Title>
          <Card.Description>Three steps, one of them done.</Card.Description>
        </Card.Header>
        <Card.Body>Write the failing test, then the primitive, then the gallery.</Card.Body>
        <Card.Footer>
          <Badge variant="secondary">1 / 3</Badge>
        </Card.Footer>
      </Card>`,
  },
  {
    id: 'empty',
    label: 'Empty',
    primitive: 'Empty',
    phrases: ['empty', 'no sessions'],
    imports: ['Button', 'Empty'],
    jsx: `      <Empty>
        <Empty.Title>No sessions yet</Empty.Title>
        <Empty.Description>Start one from the composer.</Empty.Description>
        <Empty.Actions>
          <Button size="sm">New session</Button>
        </Empty.Actions>
      </Empty>`,
  },
  {
    id: 'tooltip',
    label: 'Tooltip',
    primitive: 'Tooltip',
    phrases: ['tooltip'],
    imports: ['Button', 'Tooltip'],
    jsx: `      <Tooltip content="Copies the message">
        <Button variant="outline" size="sm" icon="copy">Copy</Button>
      </Tooltip>`,
  },
  {
    id: 'tabs',
    label: 'Tabs',
    primitive: 'Tabs',
    phrases: ['tabs'],
    imports: ['Tabs'],
    jsx: `      <Tabs defaultValue="plan">
        <Tabs.List aria-label="Work">
          <Tabs.Tab value="plan">Plan</Tabs.Tab>
          <Tabs.Tab value="files">Files</Tabs.Tab>
          <Tabs.Tab value="terminal">Terminal</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="plan">The plan lives here.</Tabs.Panel>
        <Tabs.Panel value="files">Two files changed.</Tabs.Panel>
        <Tabs.Panel value="terminal">Checks passed.</Tabs.Panel>
      </Tabs>`,
  },
  {
    id: 'collapsible',
    label: 'Collapsible',
    primitive: 'Collapsible',
    phrases: ['collapsible', 'worked for'],
    imports: ['Collapsible'],
    jsx: `      <Collapsible>
        <Collapsible.Trigger>Worked for 11s</Collapsible.Trigger>
        <Collapsible.Panel>Edited two files. The panel height animates open.</Collapsible.Panel>
      </Collapsible>`,
  },
  {
    id: 'accordion',
    label: 'Accordion',
    primitive: 'Accordion',
    phrases: ['accordion'],
    imports: ['Accordion'],
    jsx: `      <Accordion defaultValue="read">
        <Accordion.Item value="read">
          <Accordion.Trigger>Read the diff</Accordion.Trigger>
          <Accordion.Panel>Opening the next row closes this one.</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="run">
          <Accordion.Trigger>Run the checks</Accordion.Trigger>
          <Accordion.Panel>Typecheck, then the component tests.</Accordion.Panel>
        </Accordion.Item>
      </Accordion>`,
  },
  {
    id: 'plan',
    label: 'Plan',
    primitive: 'PlanChecklist',
    phrases: ['checklist', 'plan'],
    imports: ['PlanChecklist'],
    jsx: `      <PlanChecklist
        title="Ship the frame"
        items={[
          { id: '1', label: 'Name the inputs', status: 'done' },
          { id: '2', label: 'Place them on the frame', status: 'running' },
          { id: '3', label: 'Read the JSX back', status: 'pending' },
        ]}
      />`,
  },
  {
    id: 'composer',
    label: 'Composer',
    primitive: 'Composer',
    phrases: ['composer', 'message field'],
    imports: ['Composer'],
    jsx: `      <Composer placeholder="Ask the agent…" onSubmit={() => {}}>
        <Composer.Body>
          <Composer.Input />
          <Composer.Submit />
        </Composer.Body>
      </Composer>`,
  },
] as const satisfies readonly PlaygroundInput[];

export type PlaygroundId = (typeof PLAYGROUND_INPUTS)[number]['id'];

/** What a prompt may ask for that the library does not export. */
const REFUSALS: readonly { phrase: string; name: string }[] = [
  { phrase: 'command menu', name: 'Command menu' },
  { phrase: 'hover card', name: 'Hover card' },
  { phrase: 'dropdown', name: 'Dropdown menu' },
  { phrase: 'popover', name: 'Popover' },
  { phrase: 'combobox', name: 'Combobox' },
  { phrase: 'checkbox', name: 'Checkbox' },
  { phrase: 'radio', name: 'Radio group' },
  { phrase: 'slider', name: 'Slider' },
  { phrase: 'avatar', name: 'Avatar' },
  { phrase: 'chart', name: 'Chart' },
  { phrase: 'table', name: 'Table' },
];

/** The frame a first visit opens. Naming these words is the same arrangement. */
export const STARTER_PROMPT = 'warning alert, a plan card, tabs, and an empty state';

export interface Composition {
  prompt: string;
  /** Input ids, in the order the prompt names them. */
  blocks: string[];
  /** Components the prompt asked for that are not inputs. */
  refused: string[];
  jsx: string;
  note: string;
}

const byId = new Map<string, PlaygroundInput>(PLAYGROUND_INPUTS.map((input) => [input.id, input]));

function at(haystack: string, phrase: string): number {
  const source = phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(^|[^a-z0-9])${source}(?=$|[^a-z0-9])`).exec(haystack);
  return match ? match.index + match[1]!.length : -1;
}

function earliest(haystack: string, phrases: readonly string[]): number {
  let found = -1;
  for (const phrase of phrases) {
    const index = at(haystack, phrase);
    if (index >= 0 && (found < 0 || index < found)) found = index;
  }
  return found;
}

/** The JSX for these blocks, imports limited to what the snippets name. */
export function compositionJsx(ids: readonly string[]): string {
  const inputs = ids.map((id) => {
    const input = byId.get(id);
    if (!input) throw new Error(`unknown canvas input ${id}`);
    return input;
  });
  if (inputs.length === 0) {
    return `export function Screen() {\n  return null;\n}\n`;
  }
  const imports = [...new Set(inputs.flatMap((input) => input.imports))].sort();
  const body = inputs.map((input) => input.jsx).join('\n');
  return `import { ${imports.join(', ')} } from '@aicl/react';\n\nexport function Screen() {\n  return (\n    <div>\n${body}\n    </div>\n  );\n}\n`;
}

/**
 * Place primitives for a prompt.
 *
 * A blank prompt is an empty frame. The gallery supplies
 * {@link STARTER_PROMPT} on a first visit; this function does not.
 */
export function composePrompt(prompt: string): Composition {
  const haystack = prompt.toLowerCase();
  const trimmed = prompt.trim();
  if (!trimmed) {
    return {
      prompt,
      blocks: [],
      refused: [],
      jsx: compositionJsx([]),
      note: 'The frame is empty. Name a component, or pick one from the palette.',
    };
  }

  const placed = PLAYGROUND_INPUTS
    .map((input) => ({ id: input.id, at: earliest(haystack, input.phrases) }))
    .filter((item) => item.at >= 0)
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const blocks = placed.map((item) => item.id);
  const refused = [
    ...new Set(
      REFUSALS.filter((item) => at(haystack, item.phrase) >= 0)
        .sort((a, b) => at(haystack, a.phrase) - at(haystack, b.phrase))
        .map((item) => item.name),
    ),
  ];

  const note = [
    blocks.length ? 'Placed in the order the prompt names them.' : 'Nothing in that prompt is an input. The palette is the vocabulary.',
    refused.length ? `Not an input yet: ${refused.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return { prompt, blocks, refused, jsx: compositionJsx(blocks), note };
}
