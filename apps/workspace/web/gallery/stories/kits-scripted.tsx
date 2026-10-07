import { useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { KIT_IDS, KITS } from '../../../shared/kits.ts';
import { KitComposer, KitScope, KitTranscript } from '../../kits/index.tsx';
import { SCRIPT_END, SCRIPT_SESSION, scriptedAt } from '../../kits/demo.ts';
import type { Story } from '../types.ts';

/** One clock for every kit: the same run, replayable. */
function useScript() {
  const [run, setRun] = useState(0);
  const [t, setT] = useState(0);
  const origin = useRef(Date.now());
  useEffect(() => {
    origin.current = Date.now();
    setT(0);
    const start = performance.now();
    const id = setInterval(() => setT(Math.min(SCRIPT_END, performance.now() - start)), 80);
    return () => clearInterval(id);
  }, [run]);
  return { t, run, replay: () => setRun((r) => r + 1), origin: origin.current };
}

function Kits() {
  const { t, run, replay, origin } = useScript();
  const frame = useMemo(() => scriptedAt(t, origin), [t, origin]);
  const [draft, setDraft] = useState('');
  return (
    <div data-kits-gallery className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <button type="button" data-kits-replay onClick={replay} className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-muted">
          Replay
        </button>
        <span className="tabular-nums">
          {(t / 1000).toFixed(1)}s / {(SCRIPT_END / 1000).toFixed(1)}s
        </span>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(340px,1fr))]">
        {KIT_IDS.map((id) => {
          const kit = KITS[id];
          return (
            <section key={id} data-kit-column={id} aria-label={kit.label} className="flex min-w-0 flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <strong className="text-sm">{kit.label}</strong>
                <span className="truncate text-xs text-faint">
                  {kit.transcript.toolCalls} · {kit.transcript.reasoning} · {kit.transcript.streaming}
                </span>
              </div>
              <KitScope
                kit={kit}
                className="flex h-[680px] flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground"
                style={{ fontFamily: 'var(--aicl-font-sans)' }}
              >
                <MotionConfig key={run}>
                  <div className="flex min-h-0 flex-1 flex-col">
                    <KitTranscript
                      key={run}
                      kit={kit}
                      sessionId={SCRIPT_SESSION}
                      messages={frame.messages}
                      status={frame.status}
                      {...(frame.streamingId ? { streamingId: frame.streamingId } : {})}
                      terminals={frame.terminals}
                    />
                  </div>
                </MotionConfig>
                <div className="border-t border-border p-3">
                  <KitComposer
                    kit={kit}
                    variant="bottom"
                    value={draft}
                    onChange={setDraft}
                    onSubmit={() => setDraft('')}
                    status={frame.status === 'streaming' ? 'streaming' : 'ready'}
                    progress={{ label: 'Plan', done: t > 7800 ? 3 : t > 6200 ? 2 : t > 4600 ? 1 : 0, total: 3 }}
                    chips={['aicl workspace', 'Ubuntu']}
                  />
                </div>
              </KitScope>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default {
  group: 'Provider kits',
  title: 'Kit conversation (scripted)',
  note: 'The same run (ask, thinking, read + grep, a plan, bash, a streamed reply) in each kit. Replay to watch the animation.',
  wide: true,
  states: { 'All kits': () => <Kits /> },
} satisfies Story;
