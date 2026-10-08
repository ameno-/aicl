/**
 * Wave 3b contract: what a provider kit renders (AICL-32, package K) and the
 * surfaces the application composes them into (AICL-34, package A).
 *
 *   K owns web/kits/* (except state.ts): KitScope, KitTranscript, KitComposer —
 *     conversation rendering per kit, built from @aicl/fx.
 *   A owns web/shell/* + web/app/*: layout, navigation, sessions, work panel,
 *     settings, shortcuts, production serving. A renders conversations ONLY
 *     through the components below and never branches on kit.id for
 *     conversation details (layout decisions read kit.layout).
 */
import type { CSSProperties, ReactNode } from 'react';
import type { ProviderKit } from '../../shared/kits.ts';
import { themeVars } from '../ui/theme.ts';

export { useKit } from './state.ts';
export { KitTranscript, type KitTranscriptProps } from './transcript.tsx';
export { KitComposer, type KitComposerProps } from './composer.tsx';

/** Applies the kit's tokens (as --aicl-* variables) and data-theme/data-kit to a subtree. */
export function KitScope({ kit, children, className, style }: { kit: ProviderKit; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div data-kit={kit.id} data-theme={kit.tokens.mode} className={className} style={{ ...themeVars(kit.tokens), ...style }}>
      {children}
    </div>
  );
}
