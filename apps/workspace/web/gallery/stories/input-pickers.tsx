import { InlineEdit, Kbd, ModelPicker, SegmentedTabs, SuggestionStack } from '@aicl/fx';
import { Bell, Calendar, Inbox, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { Story } from '../types.ts';

const MODELS = [
  { id: 'fast', label: 'Fast', description: 'Quick answers, low cost', icon: <Sparkles size={14} /> },
  { id: 'smart', label: 'Smart', description: 'Deeper reasoning' },
  { id: 'max', label: 'Max', description: 'Longest context, slowest' },
];

function PickerDemo({ direction }: { direction: 'up' | 'down' }) {
  const [v, setV] = useState('fast');
  return (
    <div className={direction === 'up' ? 'flex h-56 items-end' : 'flex h-56 items-start'}>
      <div className="flex flex-col gap-2">
        <ModelPicker options={MODELS} value={v} onChange={setV} direction={direction} />
        <span className="text-xs text-muted-foreground">
          selected: <b data-testid={`model-${direction}`}>{v}</b>
        </span>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  { id: 's1', title: 'Summarise this repo', description: 'Read the tree and explain how the pieces fit.' },
  { id: 's2', title: 'Find flaky tests', description: 'Run the suite three times and report any that disagree.' },
  { id: 's3', title: 'Draft a changelog', description: 'Group the last 20 commits by user-facing change.' },
  { id: 's4', title: 'Review my diff', description: 'Look for bugs before I open a pull request.' },
];

function StackDemo() {
  const [picked, setPicked] = useState('none');
  return (
    <div className="flex flex-col gap-3">
      <SuggestionStack suggestions={SUGGESTIONS} onPick={(s) => setPicked(s.title)} />
      <span className="text-xs text-muted-foreground">
        picked: <b data-testid="picked">{picked}</b>
      </span>
    </div>
  );
}

function TabsDemo({ variant }: { variant: 'segmented' | 'discrete' }) {
  const [v, setV] = useState('inbox');
  return (
    <SegmentedTabs
      variant={variant}
      value={v}
      onChange={setV}
      tabs={[
        { id: 'inbox', label: 'Inbox', icon: <Inbox size={18} /> },
        { id: 'plan', label: 'Planner', icon: <Calendar size={18} /> },
        { id: 'alerts', label: 'Alerts', icon: <Bell size={18} /> },
      ]}
    />
  );
}

function EditDemo() {
  const [v, setV] = useState('Untitled session');
  return (
    <div className="flex flex-col gap-2">
      <InlineEdit value={v} onSave={setV} label="Session name" />
      <span className="text-xs text-muted-foreground">
        saved: <b data-testid="saved">{v}</b>
      </span>
    </div>
  );
}

export default [
  {
    group: 'Input',
    title: 'ModelPicker / SmoothDropdown',
    note: 'Animated popover list. Arrows, Home/End, Enter, Escape; click outside closes.',
    states: { up: () => <PickerDemo direction="up" />, down: () => <PickerDemo direction="down" /> },
  },
  {
    group: 'Input',
    title: 'SuggestionStack',
    note: 'Stacked empty-state suggestions. Click the front card, swipe it, or use the arrows.',
    states: { stack: () => <StackDemo /> },
  },
  {
    group: 'Input',
    title: 'SegmentedTabs',
    note: 'Sliding indicator, or uselayouts discrete pills.',
    states: { segmented: () => <TabsDemo variant="segmented" />, discrete: () => <TabsDemo variant="discrete" /> },
  },
  {
    group: 'Input',
    title: 'InlineEdit and Kbd',
    note: 'Edit in place (Enter saves, Escape cancels); key caps.',
    states: {
      inline: () => <EditDemo />,
      kbd: () => (
        <div className="flex flex-wrap items-center gap-3 text-base">
          <Kbd keys={['cmd', 'K']} />
          <Kbd keys={['ctrl', 'shift', 'P']} />
          <Kbd keys={['enter']} />
          <Kbd keys={['cmd', 'Enter']} listenToKeyboard />
        </div>
      ),
    },
  },
] satisfies Story[];
