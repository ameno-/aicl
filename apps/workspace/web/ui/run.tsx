import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { kitForPreset } from '../../shared/kits.ts';
import { KitComposer } from '../kits/composer.tsx';
import { useScreenKit } from './nodes.tsx';
import type { ScreenSpec, UiNode } from '../../shared/ui-spec.ts';
import { describe } from '../agentSteps.tsx';
import { useSessionChat } from '../sessionsApi.ts';
import { buildThread, findRunTargets, type RunTargets } from './run-thread.ts';

/** What a screen in run mode swaps in: the live thread and the live composer. */
export interface RunState extends RunTargets {
  thread: UiNode[];
  busy: boolean;
  status: 'idle' | 'submitted' | 'streaming' | 'error' | (string & {});
  send: (text: string) => Promise<void>;
  stop: () => void;
}

const RunContext = createContext<RunState | null>(null);
export const useRun = () => useContext(RunContext);

export function RunProvider({ sessionId, spec, children }: { sessionId: string; spec: ScreenSpec; children: ReactNode }) {
  const chat = useSessionChat(sessionId);
  const targets = useMemo(() => findRunTargets(spec.root), [spec.root]);
  const thread = useMemo(
    () => buildThread(chat.messages, { busy: chat.isBusy, streamingId: chat.streamingId, label: describe, kit: kitForPreset(spec.theme?.preset ?? 'default') }),
    [chat.messages, chat.isBusy, chat.streamingId, spec.theme?.preset],
  );
  const value: RunState = { ...targets, thread, busy: chat.isBusy, status: chat.status, send: chat.send, stop: chat.stop };
  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

/** The screen's own composer, wired to the bound session. */
export function LiveComposer({ props, run }: { props: Record<string, unknown>; run: RunState }) {
  const kit = useScreenKit();
  const [draft, setDraft] = useState('');
  const hero = props['variant'] === 'hero';
  const placeholder = typeof props['placeholder'] === 'string' ? props['placeholder'] : 'Message';
  const model = typeof props['model'] === 'string' ? props['model'] : undefined;
  return (
    <div className="aicl-ui-composer" data-ui-variant={hero ? 'hero' : 'docked'} data-ui-live="" data-kit={kit.id}>
      <KitComposer
        kit={kit}
        status={run.status === 'streaming' || run.status === 'submitted' ? 'streaming' : run.status === 'error' ? 'error' : 'ready'}
        value={draft}
        onChange={setDraft}
        placeholder={placeholder}
        variant={hero ? 'hero' : 'bottom'}
        onSubmit={(text) => {
          setDraft('');
          void run.send(text);
        }}
        onStop={run.stop}
      />
      {model ? <div className="aicl-ui-composer-model">{model}</div> : null}
    </div>
  );
}
