/**
 * Wave 3b contract: what a provider kit renders (AICL-32, package K) and the
 * surfaces the application composes them into (AICL-34, package A).
 *
 *   K owns web/kits/* (except state.ts): KitScope, KitTranscript, KitComposer,
 *     KitThinking — conversation rendering per kit, built from @aicl/fx.
 *   A owns web/shell/* + web/app/*: layout, navigation, sessions, work panel,
 *     settings, shortcuts, production serving. A renders conversations ONLY
 *     through the components below and never branches on kit.id for
 *     conversation details (layout decisions read kit.layout).
 *
 * The stubs below are the current behaviour, so both packages can start.
 */
import type { CSSProperties, ReactNode } from 'react';
import { Transcript } from '@aicl/react';
import { PromptComposer } from '@aicl/fx';
import type { Message } from '@aicl/core';
import type { ProviderKit } from '../../shared/kits.ts';
import { themeVars } from '../ui/theme.ts';
import { workspaceRegistry } from '../agentSteps.tsx';
import { TranscriptSession } from '../sessionsApi.ts';

export { setKit, useKit } from './state.ts';

/** Applies the kit's tokens (as --aicl-* variables) and data-theme/data-kit to a subtree. */
export function KitScope({ kit, children, className, style }: { kit: ProviderKit; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div data-kit={kit.id} data-theme={kit.tokens.mode} className={className} style={{ ...themeVars(kit.tokens), ...style }}>
      {children}
    </div>
  );
}

export interface KitTranscriptProps {
  kit: ProviderKit;
  sessionId: string;
  messages: Message[];
  status: 'ready' | 'submitted' | 'streaming' | 'error' | string;
  streamingId?: string;
  /** Re-send the last user message (message action "retry"). */
  onRetry?: () => void;
  /** Empty state shown when there are no messages (the app passes its hero). */
  empty?: ReactNode;
}

/** A whole conversation, rendered the kit's way (rows vs bubbles, tool-call style, reasoning, actions, streaming). */
export function KitTranscript({ sessionId, messages, status, streamingId, empty }: KitTranscriptProps) {
  if (!messages.length && empty) return <>{empty}</>;
  return (
    <TranscriptSession.Provider value={sessionId}>
      <Transcript messages={messages} status={status as never} {...(streamingId ? { streamingId } : {})} registry={workspaceRegistry} />
    </TranscriptSession.Provider>
  );
}

export interface KitComposerProps {
  kit: ProviderKit;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  onStop?: () => void;
  status: 'ready' | 'streaming' | 'error';
  variant: 'bottom' | 'hero';
  /** Live plan progress for kits with composer.progressChip. */
  progress?: { label: string; done: number; total: number };
  /** Context chips (kits with composer.contextChips), e.g. workspace name, model. */
  chips?: string[];
  /** The app's model picker, rendered where the kit puts it. */
  model?: { value: string; options: Array<{ id: string; label: string; description?: string }>; onChange: (id: string) => void };
  autoFocus?: boolean;
}

/** The kit's composer: modes, integrations, progress chip, attach label, hero vs bottom. */
export function KitComposer({ kit, value, onChange, onSubmit, onStop, status, variant }: KitComposerProps) {
  return (
    <PromptComposer
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      {...(onStop ? { onStop } : {})}
      status={status}
      variant={variant}
      placeholder={kit.vocabulary.placeholder}
    />
  );
}
