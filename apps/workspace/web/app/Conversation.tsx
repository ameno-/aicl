/**
 * One conversation, rendered through the kit contract (web/kits): KitTranscript
 * + KitComposer + HitlStrip, with the hero as the empty state. The page and
 * the dock both use useConversation() so the model slot, progress chip and
 * stop behaviour are identical.
 */
import { useCallback, useMemo, useState } from 'react';
import type { ProviderKit } from '../../shared/kits.ts';
import { HitlStrip } from '../agentic/hitl.tsx';
import { usePlan } from '../agentic/liveData.ts';
import { useWorkspaceConfig } from '../applets/index.tsx';
import { KitComposer, KitTranscript } from '../kits/index.tsx';
import { useSessionChat } from '../sessionsApi.ts';
import { Hero } from './Hero.tsx';
import { useSessionModel } from './models.ts';

type ComposerStatus = 'ready' | 'streaming' | 'error';

export function useConversation(sessionId: string, kit: ProviderKit) {
  const chat = useSessionChat(sessionId);
  const plan = usePlan(sessionId);
  const model = useSessionModel(sessionId);
  const [config] = useWorkspaceConfig();
  const [draft, setDraft] = useState('');

  const status: ComposerStatus = chat.isBusy ? 'streaming' : chat.status === 'error' ? 'error' : 'ready';
  const progress = useMemo(() => {
    if (!kit.composer.progressChip || !plan || !plan.steps.length) return undefined;
    return { label: plan.title ?? 'Plan', done: plan.steps.filter((s) => s.status === 'done').length, total: plan.steps.length };
  }, [kit.composer.progressChip, plan]);
  const chips = useMemo(() => [config.name, model.value.split('/').slice(1).join('/') || model.value].filter(Boolean), [config.name, model.value]);

  const retry = useCallback(() => {
    const last = [...chat.messages].reverse().find((m) => m.role === 'user');
    const text = last?.parts.map((p) => (p.type === 'text' ? p.text : '')).join('\n').trim();
    if (text) void chat.send(text);
  }, [chat]);

  const modelSlot = model.options.length
    ? { value: model.value, options: model.options.map((o) => ({ id: o.id, label: o.label, description: o.provider })), onChange: (id: string) => void model.set(id) }
    : undefined;

  const composerProps = {
    kit,
    value: draft,
    onChange: setDraft,
    onSubmit: (text: string) => {
      setDraft('');
      void chat.send(text);
    },
    onStop: chat.stop,
    status,
    ...(progress ? { progress } : {}),
    chips,
    ...(modelSlot ? { model: modelSlot } : {}),
  };
  return { chat, status, draft, setDraft, composerProps, retry };
}

export function Conversation({ sessionId, kit }: { sessionId: string; kit: ProviderKit }) {
  const { chat, composerProps, retry, setDraft } = useConversation(sessionId, kit);
  const empty = chat.messages.length === 0;

  return (
    <div className="conversation" data-empty={empty || undefined}>
      <KitTranscript
        kit={kit}
        sessionId={sessionId}
        messages={chat.messages}
        status={chat.status}
        {...(chat.streamingId ? { streamingId: chat.streamingId } : {})}
        onRetry={retry}
        empty={
          <Hero
            kit={kit}
            composer={<KitComposer {...composerProps} variant="hero" autoFocus />}
            working={chat.isBusy}
            onPick={(prompt) => {
              setDraft(prompt);
              requestAnimationFrame(() => document.querySelector<HTMLElement>('.conversation [data-aicl=composer-input]')?.focus());
            }}
          />
        }
      />
      {empty ? null : (
        <div className="conversation-composer">
          <HitlStrip sessionId={sessionId} />
          <KitComposer {...composerProps} variant="bottom" autoFocus />
        </div>
      )}
    </div>
  );
}
