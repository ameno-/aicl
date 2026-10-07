import { useEffect, useState } from 'react';
import { StreamingText, ThinkingIndicator, type StreamingMode } from '@aicl/fx';
import type { Story } from '../types.ts';

const SAMPLE =
  'The workspace keeps one canvas per session. When the agent edits a node, the change streams back over server-sent events, so the graph, the transcript and the diff view stay in step without polling. Tokens arrive a few at a time; only the newest words animate in.';

/** Replays SAMPLE ~7 words per 140ms (about 50 tokens/s) and loops after a pause. */
function useStream(auto: boolean) {
  const words = SAMPLE.split(' ');
  const [n, setN] = useState(auto ? 0 : words.length);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setN((c) => (c >= words.length + 25 ? 0 : c + 1)), 140);
    return () => clearInterval(t);
  }, [auto, words.length]);
  const shown = Math.min(n, words.length);
  return { text: words.slice(0, shown).join(' '), streaming: auto && n < words.length };
}

function Streaming({ mode, auto = true }: { mode: StreamingMode; auto?: boolean }) {
  const { text, streaming } = useStream(auto);
  return (
    <div className="min-h-[7.5rem] text-sm leading-6" data-testid={`stream-${mode}-${auto ? 'live' : 'done'}`}>
      <StreamingText text={text} streaming={streaming} mode={mode} caret />
    </div>
  );
}

function Elapsed({ variant }: { variant: 'shimmer' | 'dots' | 'bars' }) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMs((m) => m + 1000), 1000);
    return () => clearInterval(t);
  }, []);
  return <ThinkingIndicator variant={variant} elapsedMs={ms} />;
}

export default [
  {
    group: 'Streaming',
    title: 'StreamingText',
    note: 'Only newly appended words animate; earlier words keep their DOM nodes. Plain text, or a render prop for markdown.',
    wide: true,
    states: {
      words: () => <Streaming mode="words" />,
      blur: () => <Streaming mode="blur" />,
      none: () => <Streaming mode="none" />,
      done: () => <Streaming mode="words" auto={false} />,
    },
  },
  {
    group: 'Streaming',
    title: 'ThinkingIndicator',
    note: 'Shimmer, dots or bars while thinking; "Thought for 24s" when done.',
    states: {
      shimmer: () => <Elapsed variant="shimmer" />,
      dots: () => <Elapsed variant="dots" />,
      bars: () => <Elapsed variant="bars" />,
      done: () => <ThinkingIndicator done elapsedMs={24000} />,
    },
  },
] satisfies Story[];
