import { CommandMenu, Kbd, SidePanel, Toaster, toast } from '@aicl/fx';
import { useState } from 'react';
import type { Story } from '../types.ts';

function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <button className="rounded-md border border-border px-2 py-1 text-sm" onClick={() => toast.success('Saved', { description: 'Session synced.' })}>
        Success
      </button>
      <button className="rounded-md border border-border px-2 py-1 text-sm" onClick={() => toast.error('Run failed', { description: 'Exit code 1' })}>
        Error
      </button>
      <button className="rounded-md border border-border px-2 py-1 text-sm" onClick={() => toast.info('Heads up', { duration: 1500 })}>
        Info (1.5s)
      </button>
      <Toaster />
    </div>
  );
}

function CommandDemo() {
  const [open, setOpen] = useState(false);
  const [ran, setRan] = useState('none');
  const run = (name: string) => () => setRan(name);
  return (
    <div className="flex flex-col gap-2">
      <button className="inline-flex w-fit items-center gap-2 rounded-md border border-border px-2 py-1 text-sm" onClick={() => setOpen(true)}>
        Open palette <Kbd keys={['cmd', 'K']} />
      </button>
      <span className="text-xs text-muted-foreground">
        ran: <b data-testid="ran">{ran}</b>
      </span>
      <CommandMenu
        open={open}
        onOpenChange={setOpen}
        items={[
          { id: 'new', label: 'New session', group: 'Session', shortcut: ['cmd', 'N'], onSelect: run('new') },
          { id: 'rename', label: 'Rename session', group: 'Session', onSelect: run('rename') },
          { id: 'theme', label: 'Toggle theme', group: 'View', onSelect: run('theme') },
          { id: 'panel', label: 'Toggle side panel', group: 'View', shortcut: ['cmd', 'B'], onSelect: run('panel') },
          { id: 'stop', label: 'Stop generating', group: 'Agent', onSelect: run('stop') },
        ]}
      />
    </div>
  );
}

function PanelDemo({ side }: { side: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative h-64 overflow-hidden rounded-lg border border-border bg-background">
      <div className="p-3">
        <button className="rounded-md border border-border px-2 py-1 text-sm" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : 'Open'} {side} panel
        </button>
      </div>
      <SidePanel open={open} side={side} title="Preview" width={240} onClose={() => setOpen(false)}>
        <p className="m-0">Work and preview content goes here.</p>
      </SidePanel>
    </div>
  );
}

export default [
  {
    group: 'Input',
    title: 'Toaster',
    note: 'toast.success / error / info; stacked, auto-dismiss, pauses on hover.',
    states: { toasts: () => <ToastDemo /> },
  },
  {
    group: 'Input',
    title: 'CommandMenu',
    note: 'Cmd/Ctrl+K palette with fuzzy filter.',
    states: { palette: () => <CommandDemo /> },
  },
  {
    group: 'Input',
    title: 'SidePanel',
    note: 'Sliding work/preview pane.',
    states: { right: () => <PanelDemo side="right" />, left: () => <PanelDemo side="left" /> },
  },
] satisfies Story[];
