import type { CatalogItem, RegistryType } from './types.js';

function fx(
  name: string,
  title: string,
  description: string,
  source: string,
  usage: string,
  extra: {
    registryDependencies?: readonly string[];
    files?: readonly string[];
    category?: string;
    dependencies?: readonly string[];
  } = {},
): CatalogItem {
  const type: RegistryType = 'registry:ui';
  const files = [
    { path: source, type, target: source.replace('packages/fx/src/', 'components/aicl/fx/') },
    ...(extra.files ?? []).map((path) => ({
      path,
      type,
      target: path.replace('packages/fx/src/', 'components/aicl/fx/'),
    })),
  ];
  return {
    name,
    title,
    type,
    description,
    package: '@aicl/fx',
    files,
    registryDependencies: [...new Set(['cn', 'fx-provider', ...(extra.registryDependencies ?? [])])],
    dependencies: [...new Set(['react', 'motion', 'lucide-react', ...(extra.dependencies ?? [])])],
    categories: [extra.category ?? 'fx'],
    usage,
    npmImport: `import { ${title.replace(/ \(.+\)$/, '')} } from '@aicl/fx';`,
    docs: `docs/components/${name}.md`,
  };
}

/** Every public `@aicl/fx` component. Vendored files ride as extra `files`. */
export const fxItems: readonly CatalogItem[] = [
  fx(
    'streaming-text',
    'StreamingText',
    'Tokens arrive. Character, word, or instant reveal, with a caret that does not reflow.',
    'packages/fx/src/components/stream/StreamingText.tsx',
    `import { StreamingText } from '@aicl/fx';\n\n<StreamingText text={text} streaming />`,
  ),
  fx(
    'thinking-indicator',
    'ThinkingIndicator',
    'Shimmer, dots or bars while the model thinks; collapses to "Thought for 24s".',
    'packages/fx/src/components/stream/ThinkingIndicator.tsx',
    `import { ThinkingIndicator } from '@aicl/fx';\n\n<ThinkingIndicator elapsedMs={2400} />`,
    {
      files: [
        'packages/fx/src/components/stream/format.ts',
        'packages/fx/src/vendor/spell-ui/shimmer-text.tsx',
        'packages/fx/src/vendor/spell-ui/bars-spinner.tsx',
      ],
    },
  ),
  fx(
    'work-summary',
    'WorkSummary',
    'Devin-style "Worked for 11s" disclosure; animates open and closed.',
    'packages/fx/src/components/stream/WorkSummary.tsx',
    `import { WorkSummary } from '@aicl/fx';\n\n<WorkSummary seconds={11} steps={<ol><li>Edited two files</li></ol>} />`,
    {
      files: [
        'packages/fx/src/components/stream/Collapse.tsx',
        'packages/fx/src/vendor/spell-ui/shimmer-text.tsx',
      ],
    },
  ),
  fx(
    'tool-call-card',
    'ToolCallCard',
    'A live tool-call card: pending, running, success, error, cancelled.',
    'packages/fx/src/components/stream/ToolCallCard.tsx',
    `import { ToolCallCard } from '@aicl/fx';\n\n<ToolCallCard name="search" label="Search the repo" status="running" />`,
    {
      registryDependencies: ['border-beam'],
      files: [
        'packages/fx/src/components/stream/Collapse.tsx',
        'packages/fx/src/vendor/spell-ui/spinner.tsx',
      ],
    },
  ),
  fx(
    'animated-plan',
    'AnimatedPlan',
    'A plan whose steps tick through pending, running and done.',
    'packages/fx/src/components/stream/AnimatedPlan.tsx',
    `import { AnimatedPlan } from '@aicl/fx';\n\n<AnimatedPlan steps={steps} />`,
    {
      registryDependencies: ['rolling-number'],
      files: [
        'packages/fx/src/vendor/spell-ui/animated-checkbox.tsx',
        'packages/fx/src/vendor/spell-ui/shimmer-text.tsx',
        'packages/fx/src/vendor/spell-ui/spinner.tsx',
      ],
    },
  ),
  fx(
    'rolling-number',
    'RollingNumber',
    'A number that rolls to its next value. Jumps under reduced motion.',
    'packages/fx/src/components/stream/RollingNumber.tsx',
    `import { RollingNumber } from '@aicl/fx';\n\n<RollingNumber value={42} />`,
    { files: ['packages/fx/src/vendor/cult-ui/rolling-number.tsx'] },
  ),
  fx(
    'live-terminal',
    'LiveTerminal',
    'Streaming shell output, stick-to-bottom, with a quiet chrome.',
    'packages/fx/src/components/stream/LiveTerminal.tsx',
    `import { LiveTerminal } from '@aicl/fx';\n\n<LiveTerminal lines={lines} running />`,
  ),
  fx(
    'status-island',
    'StatusIsland',
    'A compact status chip that morphs between idle, working and done.',
    'packages/fx/src/components/stream/StatusIsland.tsx',
    `import { StatusIsland } from '@aicl/fx';\n\n<StatusIsland status="working" label="Indexing" />`,
    { files: ['packages/fx/src/vendor/spell-ui/bars-spinner.tsx'] },
  ),
  fx(
    'fx-code-block',
    'CodeBlock',
    'A highlighted code block with a copy button. The animated sibling of the primitive.',
    'packages/fx/src/components/stream/CodeBlock.tsx',
    `import { CodeBlock } from '@aicl/fx';\n\n<CodeBlock code={source} language="ts" />`,
    { files: ['packages/fx/src/vendor/spell-ui/copy-button.tsx'] },
  ),
  fx(
    'border-beam',
    'BorderBeam',
    'A light that travels around the parent border. Static under reduced motion.',
    'packages/fx/src/components/stream/BorderBeam.tsx',
    `import { BorderBeam } from '@aicl/fx';\n\n<div className="relative"><BorderBeam /></div>`,
  ),
  fx(
    'prompt-composer',
    'PromptComposer',
    'The styled composer: attachments, a model picker, send that morphs into stop.',
    'packages/fx/src/components/input/PromptComposer.tsx',
    `import { PromptComposer } from '@aicl/fx';\n\n<PromptComposer value={draft} onChange={setDraft} onSubmit={send} status="ready" />`,
    { category: 'fx-input', registryDependencies: ['smooth-dropdown'] },
  ),
  fx(
    'model-picker',
    'ModelPicker',
    'A model menu on a smooth dropdown.',
    'packages/fx/src/components/input/ModelPicker.tsx',
    `import { ModelPicker } from '@aicl/fx';\n\n<ModelPicker value={model} onChange={setModel} options={models} />`,
    { category: 'fx-input', registryDependencies: ['smooth-dropdown'] },
  ),
  fx(
    'smooth-dropdown',
    'SmoothDropdown',
    'A dropdown whose panel size springs to the content.',
    'packages/fx/src/vendor/uselayouts/smooth-dropdown.tsx',
    `import { SmoothDropdown } from '@aicl/fx';\n\n<SmoothDropdown value={value} options={options} onChange={setValue} />`,
    { category: 'fx-input' },
  ),
  fx(
    'suggestion-stack',
    'SuggestionStack',
    'Follow-up chips that fan into a stack. The cousin of Fluid\'s queued-stack.',
    'packages/fx/src/components/input/SuggestionStack.tsx',
    `import { SuggestionStack } from '@aicl/fx';\n\n<SuggestionStack suggestions={items} onPick={ask} />`,
    { category: 'fx-input' },
  ),
  fx(
    'approval-card',
    'ApprovalCard',
    'Allow, deny, or always-allow a pending tool call.',
    'packages/fx/src/components/input/ApprovalCard.tsx',
    `import { ApprovalCard } from '@aicl/fx';\n\n<ApprovalCard tool="bash" summary="List the directory" onApprove={allow} onDeny={deny} />`,
    { category: 'fx-input' },
  ),
  fx(
    'question-card',
    'QuestionCard',
    'A single question with options. The narrow form of Fluid\'s ask-user-questions.',
    'packages/fx/src/components/input/QuestionCard.tsx',
    `import { QuestionCard } from '@aicl/fx';\n\n<QuestionCard question="Which one?" options={options} onAnswer={answer} />`,
    { category: 'fx-input' },
  ),
  fx(
    'toaster',
    'Toaster',
    'The styled toast host. Call `toast()` from anywhere under it.',
    'packages/fx/src/components/input/Toaster.tsx',
    `import { Toaster, toast } from '@aicl/fx';\n\n<Toaster />\ntoast({ title: 'Saved', kind: 'success' });`,
    { category: 'fx-input' },
  ),
  fx(
    'segmented-tabs',
    'SegmentedTabs',
    'A sliding pill, or discrete tabs that widen to show the label.',
    'packages/fx/src/components/input/SegmentedTabs.tsx',
    `import { SegmentedTabs } from '@aicl/fx';\n\n<SegmentedTabs tabs={tabs} value={id} onChange={setId} />`,
    {
      category: 'fx-input',
      files: ['packages/fx/src/vendor/uselayouts/discrete-tabs.tsx'],
    },
  ),
  fx(
    'inline-edit',
    'InlineEdit',
    'Click-to-edit text. Enter commits, Escape reverts.',
    'packages/fx/src/vendor/uselayouts/inline-edit.tsx',
    `import { InlineEdit } from '@aicl/fx';\n\n<InlineEdit value={title} onSubmit={rename} />`,
    { category: 'fx-input' },
  ),
  fx(
    'fx-kbd',
    'Kbd (fx)',
    'The animated keyboard hint. The headless primitive is `kbd`.',
    'packages/fx/src/vendor/spell-ui/kbd.tsx',
    `import { Kbd } from '@aicl/fx';\n\n<Kbd keys={['Meta', 'K']} />`,
    { category: 'fx-input' },
  ),
  fx(
    'command-menu',
    'CommandMenu',
    'A fuzzy-filtered command palette. Move this to the library is Wave 2 C5.',
    'packages/fx/src/components/input/CommandMenu.tsx',
    `import { CommandMenu } from '@aicl/fx';\n\n<CommandMenu open={open} onOpenChange={setOpen} items={items} onSelect={run} />`,
    { category: 'fx-input', registryDependencies: ['fx-kbd'] },
  ),
  fx(
    'side-panel',
    'SidePanel',
    'A sliding side sheet for the work the agent is doing.',
    'packages/fx/src/components/input/SidePanel.tsx',
    `import { SidePanel } from '@aicl/fx';\n\n<SidePanel open={open} onClose={() => setOpen(false)}>…</SidePanel>`,
    { category: 'fx-input' },
  ),
  fx(
    'ambient',
    'Ambient',
    'A WebGPU mesh gradient for idle and working states. CSS fallback, no telemetry.',
    'packages/fx/src/components/Ambient.tsx',
    `import { Ambient } from '@aicl/fx';\n\n<Ambient mood="working" />`,
    { category: 'fx', dependencies: ['shaders'] },
  ),
];

/** Public `@aicl/fx` export names the catalog must cover. */
export const fxExportNames = [
  'StreamingText',
  'ThinkingIndicator',
  'WorkSummary',
  'ToolCallCard',
  'AnimatedPlan',
  'RollingNumber',
  'LiveTerminal',
  'StatusIsland',
  'CodeBlock',
  'BorderBeam',
  'PromptComposer',
  'ModelPicker',
  'SmoothDropdown',
  'SuggestionStack',
  'ApprovalCard',
  'QuestionCard',
  'Toaster',
  'SegmentedTabs',
  'InlineEdit',
  'Kbd',
  'CommandMenu',
  'SidePanel',
  'Ambient',
] as const;
