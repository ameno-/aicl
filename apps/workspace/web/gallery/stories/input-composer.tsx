import { PromptComposer, type PromptStatus } from '@aicl/fx';
import { useState } from 'react';
import type { Story } from '../types.ts';

const MODES = [
  { id: 'normal', label: 'Normal', description: 'Ask before risky actions' },
  { id: 'plan', label: 'Plan', description: 'Think first, no edits' },
  { id: 'auto', label: 'Auto', description: 'Run without asking' },
];
const MODELS = [
  { id: 'fast', label: 'Fast', description: 'Quick answers' },
  { id: 'smart', label: 'Smart', description: 'Deeper reasoning' },
];

function Demo({ variant, initialStatus = 'ready' }: { variant: 'bottom' | 'hero'; initialStatus?: PromptStatus }) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<PromptStatus>(initialStatus);
  const [sent, setSent] = useState<string[]>([]);
  const [mode, setMode] = useState('normal');
  const [model, setModel] = useState('smart');
  const [files, setFiles] = useState([{ id: 'a', name: 'notes.md' }]);
  return (
    <div className="flex flex-col gap-2" data-testid={`composer-${variant}`}>
      <PromptComposer
        variant={variant}
        value={value}
        onChange={setValue}
        status={status}
        onSubmit={(v) => {
          setSent((s) => [...s, v]);
          setValue('');
        }}
        onStop={() => setStatus('ready')}
        attachments={files}
        onAttach={() => setFiles((f) => [...f, { id: String(f.length), name: `file-${f.length}.txt` }])}
        onRemoveAttachment={(id) => setFiles((f) => f.filter((x) => x.id !== id))}
        modes={MODES}
        mode={mode}
        onModeChange={setMode}
        models={MODELS}
        model={model}
        onModelChange={setModel}
        chips={[{ id: 'c1', label: 'apps/workspace', onRemove: () => undefined }, { id: 'c2', label: 'main' }]}
        progress={{ label: 'Tasks', done: 4, total: 4 }}
        placeholder={variant === 'hero' ? 'What should we build?' : 'Message the agent…'}
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>status:</span>
        {(['ready', 'streaming', 'error'] as const).map((s) => (
          <button key={s} className="rounded border border-border px-1.5 py-0.5" onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>
      <pre data-testid="sent" className="m-0 whitespace-pre-wrap rounded bg-muted p-2 text-xs">
        {sent.length ? sent.map((s) => JSON.stringify(s)).join('\n') : 'nothing sent'}
      </pre>
    </div>
  );
}

export default {
  group: 'Input',
  title: 'PromptComposer',
  note: 'Auto-growing input: Enter sends, Shift+Enter adds a line, send morphs to Stop while streaming.',
  wide: true,
  states: {
    bottom: () => <Demo variant="bottom" />,
    streaming: () => <Demo variant="bottom" initialStatus="streaming" />,
    hero: () => <Demo variant="hero" />,
  },
} satisfies Story;
