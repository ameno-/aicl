import type { PrimitiveExtra } from './types.js';

const REACT = "import { $ } from '@aicl/react';";

function usage(name: string, body: string): string {
  return `${REACT.replace('$', name)}\n\n${body}`;
}

/**
 * Per-primitive extras the contract does not carry: the category, the
 * install snippet, and the registry dependencies. The generator fails if
 * a primitive is missing from this map.
 */
export const primitiveExtras: Record<string, PrimitiveExtra> = {
  Button: {
    category: 'content',
    registryDependencies: ['icon-slots'],
    usage: usage(
      'Button',
      `<Button variant="secondary" icon="plus">New task</Button>
<Button loading>Working</Button>`,
    ),
  },
  Transcript: {
    category: 'chat',
    registryDependencies: ['icon-slots', 'message-actions', 'part-renderer'],
    usage: usage(
      'Transcript',
      `<Transcript messages={chat.messages} status={chat.status} streamingId={chat.streamingId} />`,
    ),
  },
  Composer: {
    category: 'chat',
    registryDependencies: ['icon-slots', 'composer-surface'],
    usage: usage(
      'Composer',
      `<Composer status={chat.status} onSubmit={(text) => void chat.send(text)} onStop={chat.stop} />`,
    ),
  },
  PartRenderer: {
    category: 'chat',
    registryDependencies: ['icon-slots'],
    dependencies: ['react', '@aicl/core', 'react-markdown', 'remark-gfm'],
    usage: usage(
      'PartRenderer',
      `<PartRenderer part={part} />`,
    ),
  },
  MessageActions: {
    category: 'chat',
    registryDependencies: ['icon-slots'],
    usage: usage(
      'MessageActions',
      `<MessageActions message={message} onAction={handle} />`,
    ),
  },
  PlanChecklist: {
    category: 'chat',
    registryDependencies: ['icon-slots'],
    usage: usage(
      'PlanChecklist',
      `<PlanChecklist title="Ship" items={[{ id: '1', label: 'Write the test', status: 'done' }]} />`,
    ),
  },
  ComposerSurface: {
    category: 'chat',
    registryDependencies: ['icon-slots', 'use-readable'],
    usage: usage(
      'SuggestionChips',
      `<SuggestionChips suggestions={[{ id: '1', label: 'Make it shorter' }]} onSelect={insert} />`,
    ),
  },
  SessionList: {
    category: 'navigation',
    registryDependencies: ['icon-slots', 'use-readable'],
    usage: usage(
      'SessionList',
      `<SessionList ariaLabel="Sessions" groups={groups} byId={byId} activeId={id} onSelect={setId} />`,
    ),
  },
  SessionSearch: {
    category: 'navigation',
    registryDependencies: ['icon-slots', 'use-readable'],
    usage: usage(
      'SessionSearch',
      `<SessionSearch items={sessions} onSelect={open} />`,
    ),
  },
  SidebarNav: {
    category: 'navigation',
    registryDependencies: ['icon-slots', 'use-readable'],
    usage: usage(
      'SidebarNav',
      `<SidebarNav ariaLabel="Primary" items={items} collapsed={collapsed} onCollapsedChange={setCollapsed} />`,
    ),
  },
  Dialog: {
    category: 'overlay',
    registryDependencies: ['icon-slots', 'use-readable'],
    usage: usage(
      'Dialog',
      `<Dialog open={open} onOpenChange={setOpen}>
  <Dialog.Title>A sheet of the conversation</Dialog.Title>
  <Dialog.Description>Escape or the scrim puts it back.</Dialog.Description>
  <Dialog.Close />
</Dialog>`,
    ),
  },
  AlertDialog: {
    category: 'overlay',
    registryDependencies: ['icon-slots', 'use-readable'],
    usage: usage(
      'AlertDialog',
      `<AlertDialog open={open} onOpenChange={setOpen} title="Delete?" consequence="This cannot be undone." onConfirm={remove} />`,
    ),
  },
  Drawer: {
    category: 'overlay',
    registryDependencies: ['icon-slots', 'use-readable'],
    usage: usage(
      'Drawer',
      `<Drawer open={open} onOpenChange={setOpen} side="end">…</Drawer>`,
    ),
  },
  ToastRegion: {
    category: 'overlay',
    registryDependencies: ['use-readable'],
    usage: usage(
      'ToastRegion',
      `<ToastRegion queue={queue} />`,
    ),
  },
  Toast: {
    category: 'overlay',
    registryDependencies: ['icon-slots', 'use-readable'],
    usage: usage(
      'Toast',
      `<Toast toast={toast} onDismiss={dismiss} />`,
    ),
  },
  Field: {
    category: 'form',
    registryDependencies: ['use-readable'],
    usage: usage(
      'Field',
      `<Field label="API base URL" error={error} required>
  <input value={url} onChange={(e) => setUrl(e.target.value)} />
</Field>`,
    ),
  },
  Switch: {
    category: 'form',
    registryDependencies: ['use-readable'],
    usage: usage(
      'Switch',
      `<Switch checked={on} onCheckedChange={setOn} label="Stream reasoning" />`,
    ),
  },
  Select: {
    category: 'form',
    registryDependencies: ['icon-slots', 'use-readable'],
    usage: usage(
      'Select',
      `<Select ariaLabel="Model" value={model} onValueChange={setModel} options={MODELS} />`,
    ),
  },
  SegmentedControl: {
    category: 'form',
    registryDependencies: ['use-readable'],
    usage: usage(
      'SegmentedControl',
      `<SegmentedControl ariaLabel="Density" value={density} onValueChange={setDensity} options={[{ value: 'cozy', label: 'Cozy' }]} />`,
    ),
  },
  Tooltip: {
    category: 'overlay',
    usage: usage(
      'Tooltip',
      `<Tooltip content="Copy">
  <Button icon="copy" aria-label="Copy" />
</Tooltip>`,
    ),
  },
  Badge: {
    category: 'content',
    usage: usage(
      'Badge',
      `<Badge variant="success">Done</Badge>
<Badge variant="danger">Failed</Badge>`,
    ),
  },
  Separator: {
    category: 'content',
    usage: usage(
      'Separator',
      `<Separator />
<Separator orientation="vertical" />`,
    ),
  },
  Kbd: {
    category: 'content',
    usage: usage(
      'Kbd',
      `<Kbd keys={['Meta', 'K']} />`,
    ),
  },
  Progress: {
    category: 'content',
    usage: usage(
      'Progress',
      `<Progress value={40} max={100} />
<Progress indeterminate label="Indexing" />`,
    ),
  },
  Collapsible: {
    category: 'content',
    registryDependencies: ['icon-slots'],
    usage: usage(
      'Collapsible',
      `<Collapsible>
  <Collapsible.Trigger>Reasoning</Collapsible.Trigger>
  <Collapsible.Content>The work.</Collapsible.Content>
</Collapsible>`,
    ),
  },
  Tabs: {
    category: 'content',
    usage: usage(
      'Tabs',
      `<Tabs defaultValue="chat">
  <Tabs.List>
    <Tabs.Tab value="chat">Chat</Tabs.Tab>
    <Tabs.Tab value="files">Files</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="chat">The thread.</Tabs.Panel>
  <Tabs.Panel value="files">The tree.</Tabs.Panel>
</Tabs>`,
    ),
  },
};
