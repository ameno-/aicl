/// <reference types="vite/client" />
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { useMemo, useState } from 'react';
import { FxProvider } from '@aicl/fx';
import '@aicl/styles';
import '../tailwind.css';
import type { Story } from './types.ts';

const modules = import.meta.glob<{ default: Story | Story[] }>('./stories/*.tsx', { eager: true });
const stories: Story[] = Object.keys(modules)
  .sort()
  .flatMap((k) => {
    const d = modules[k]!.default;
    return Array.isArray(d) ? d : [d];
  });

function Gallery() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [motion, setMotion] = useState<'user' | 'always'>('user');
  const [filter, setFilter] = useState('');
  const groups = useMemo(() => {
    const m = new Map<string, Story[]>();
    for (const s of stories) {
      if (filter && !`${s.group} ${s.title}`.toLowerCase().includes(filter.toLowerCase())) continue;
      m.set(s.group, [...(m.get(s.group) ?? []), s]);
    }
    return [...m];
  }, [filter]);
  return (
    <div data-aicl-root="" data-theme={theme} className="min-h-screen bg-background text-foreground">
      <MotionConfig reducedMotion={motion}>
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/90 px-6 py-3 backdrop-blur">
          <strong>@aicl/fx</strong>
          <span className="text-sm text-muted-foreground">{stories.length} components</span>
          <input
            aria-label="Filter"
            placeholder="Filter…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="ml-auto rounded-md border border-border bg-card px-2 py-1 text-sm"
          />
          <button className="rounded-md border border-border px-2 py-1 text-sm" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <button className="rounded-md border border-border px-2 py-1 text-sm" onClick={() => setMotion(motion === 'user' ? 'always' : 'user')}>
            {motion === 'user' ? 'Reduce motion' : 'Allow motion'}
          </button>
        </header>
        <main className="flex flex-col gap-10 px-6 py-8">
          {groups.map(([group, list]) => (
            <section key={group} className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">{group}</h2>
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(360px,1fr))]">
                {list.map((s) => (
                  <article
                    key={s.title}
                    data-story={s.title}
                    className={`flex flex-col gap-3 rounded-lg border border-border bg-card p-4 ${s.wide ? 'col-span-full' : ''}`}
                  >
                    <div>
                      <h3 className="font-medium">{s.title}</h3>
                      {s.note ? <p className="text-sm text-muted-foreground">{s.note}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {Object.entries(s.states).map(([name, render]) => (
                        <div key={name} data-state={name} className="flex min-w-0 flex-1 basis-[300px] flex-col gap-2">
                          <span className="text-xs uppercase tracking-wide text-faint">{name}</span>
                          <div className="relative min-w-0">{render()}</div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </main>
      </MotionConfig>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <FxProvider>
    <Gallery />
  </FxProvider>,
);
