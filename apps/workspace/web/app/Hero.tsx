/**
 * The empty state of a conversation: the kit's hero title, the hero composer,
 * stacked starters, and (kits with `ambient`) a WebGPU backdrop. The ambient
 * shader is loaded on demand so it stays out of the main chunk.
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { SuggestionStack, type Suggestion } from '@aicl/fx';
import { Bug, Layout, Network, Sparkles } from 'lucide-react';
import type { ProviderKit } from '../../shared/kits.ts';

// A direct path (not the @aicl/fx barrel) so the bundler can split the shader runtime out.
const Ambient = lazy(() => import('../../../../packages/fx/src/components/Ambient.tsx').then((m) => ({ default: m.Ambient })));

export function starters(kit: ProviderKit): Array<Suggestion & { prompt: string }> {
  const icon = { size: 16, 'aria-hidden': true } as const;
  return [
    { id: 'widget', title: 'Build a live widget', description: `Ask ${kit.vocabulary.agent} for a small card that tracks something in this workspace.`, icon: <Layout {...icon} />, prompt: 'Build me a widget that shows ' },
    { id: 'arch', title: 'Sketch the architecture', description: 'Draw how this project fits together on the canvas.', icon: <Network {...icon} />, prompt: 'Sketch the architecture of this project on the canvas' },
    { id: 'plan', title: 'Plan and run a task', description: 'A short plan, a command run with your approval, a clear summary.', icon: <Sparkles {...icon} />, prompt: 'Make a 2-step plan, run `echo hello` with bash, then say done.' },
    { id: 'bug', title: 'Find something to fix', description: 'Read the workspace and point out what looks wrong.', icon: <Bug {...icon} />, prompt: 'Read this workspace and tell me what looks wrong or unfinished.' },
  ];
}

export function Hero({ kit, composer, working, onPick }: { kit: ProviderKit; composer: ReactNode; working: boolean; onPick: (prompt: string) => void }) {
  const items = starters(kit);
  return (
    <div className="hero" data-kit-hero={kit.id}>
      {kit.ambient ? (
        <div className="hero-ambient" aria-hidden="true">
          <Suspense fallback={null}>
            <Ambient colors={kit.ambient} mood={working ? 'working' : 'idle'} />
          </Suspense>
        </div>
      ) : null}
      <div className="hero-inner">
        <h1 className="hero-title">{kit.vocabulary.heroTitle}</h1>
        <div className="hero-composer">{composer}</div>
        <SuggestionStack className="hero-starters" suggestions={items} onPick={(s) => onPick(items.find((i) => i.id === s.id)?.prompt ?? s.title)} />
      </div>
    </div>
  );
}
