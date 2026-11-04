import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Message, SessionMeta } from '@aicl/core';
import { FluidHoverHighlight, WeightText, useFluidHover } from '@aicl/motion/react';
import {
  Accordion,
  Button,
  Collapsible,
  Composer,
  Dialog,
  Progress,
  SegmentedControl,
  Select,
  SessionList,
  Skeleton,
  Spinner,
  Switch,
  Tabs,
  Transcript,
} from '@aicl/react';

/**
 * A tour of the library, in the shape of Fluid Functionalism's demo:
 * one sticky "Go to" list whose highlight travels with the pointer, and a
 * stop for each primitive, rendered live. The last stop is "Make them
 * yours": the same objects, under the LooseLeaf experience.
 *
 * The stops are data. Adding a primitive is one entry and one stage.
 */

type Skin = 'default' | 'looseleaf';

const STOPS = [
  { id: 'button', title: 'Button', line: 'Variants, sizes, and a press. Hold one.' },
  { id: 'composer', title: 'Composer', line: 'Type, then send. The field is the product.' },
  { id: 'transcript', title: 'Transcript', line: 'One live region. Messages arrive; they do not pop.' },
  { id: 'choice', title: 'Choice', line: 'A switch, a segment, a select. Keyboard first.' },
  { id: 'motion', title: 'Motion', line: 'A pill that travels, a panel that folds, a placeholder that shimmers.' },
  { id: 'dialog', title: 'Dialog', line: 'A sheet that lands, then gets out of the way.' },
  { id: 'sessions', title: 'Sessions', line: 'The list beside the thread. Arrows move, Enter opens.' },
  { id: 'yours', title: 'Make them yours', line: 'Same components. A different object.' },
] as const;

type StopId = (typeof STOPS)[number]['id'];

const SEEDED: Message[] = [
  { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Show the work' }], createdAt: Date.parse('2026-10-01T12:00:00Z') },
  {
    id: 'a1',
    role: 'assistant',
    parts: [{ type: 'text', text: 'Edited two files. Checks passed.' }],
    createdAt: Date.parse('2026-10-03T12:00:00Z'),
  },
];

const MODELS = [
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'haiku', label: 'Haiku' },
];

const now = Date.now();
const BY_ID: Record<string, SessionMeta> = {
  a: { id: 'a', title: 'Fix the double submit', preview: 'Running tests · 3/4', updatedAt: now, status: 'running', statusLine: 'Running tests' },
  b: { id: 'b', title: 'Draft the Q4 roadmap', preview: 'Here is a first outline', updatedAt: now - 86_400_000 },
  c: { id: 'c', title: 'Why is the build slow?', preview: 'Needs your approval', updatedAt: now - 172_000_000, status: 'awaiting-input', statusLine: 'Needs your approval' },
};

function setExperience(kind: 'skin' | 'theme', value: string) {
  window.dispatchEvent(new CustomEvent(`aicl:${kind}`, { detail: value }));
}

function GoTo({ current }: { current: StopId }) {
  const hover = useFluidHover();
  return (
    <nav className="tour-goto" aria-label="Go to" ref={hover.containerRef} {...hover.handlers}>
      <p className="tour-kicker">Go to</p>
      <FluidHoverHighlight hover={hover} />
      {STOPS.map((stop, index) => (
        <a
          key={stop.id}
          href={`#${stop.id}`}
          ref={(element) => hover.registerItem(index, element)}
          aria-current={current === stop.id ? 'true' : undefined}
        >
          <WeightText active={current === stop.id || hover.activeIndex === index}>{stop.title}</WeightText>
        </a>
      ))}
    </nav>
  );
}

function ButtonStop() {
  const [loading, setLoading] = useState(false);
  return (
    <div className="tour-row">
      <Button>Send</Button>
      <Button variant="secondary" icon="plus">New task</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Delete</Button>
      <Button loading={loading} onClick={() => setLoading((value) => !value)}>
        {loading ? 'Working' : 'Hold to work'}
      </Button>
    </div>
  );
}

function ComposerStop() {
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  return (
    <div className="tour-stack">
      <Composer
        value={draft}
        onChange={setDraft}
        placeholder="Ask the agent to build, fix, or explain…"
        suggestions={sent ? [] : ['Show the work', 'Why is this stiff?']}
        onSelectSuggestion={setDraft}
        onSubmit={(text) => {
          setSent(text);
          setDraft('');
        }}
      />
      {sent ? <p className="tour-note">Sent: {sent}</p> : null}
    </div>
  );
}

function TranscriptStop({ skin }: { skin: string }) {
  const [play, setPlay] = useState(0);
  return (
    <div className="tour-stack">
      <div className="tour-transcript" key={`${skin}-${play}`}>
        <Transcript messages={SEEDED} status="idle" />
      </div>
      <Button variant="secondary" onClick={() => setPlay((value) => value + 1)}>
        Play the arrival
      </Button>
    </div>
  );
}

function ChoiceStop() {
  const [on, setOn] = useState(true);
  const [density, setDensity] = useState('cozy');
  const [model, setModel] = useState('opus');
  return (
    <div className="tour-stack">
      <Switch checked={on} onCheckedChange={setOn} label="Stream reasoning" />
      <SegmentedControl
        ariaLabel="Density"
        value={density}
        onValueChange={setDensity}
        options={[
          { value: 'cozy', label: 'Cozy' },
          { value: 'compact', label: 'Compact' },
        ]}
      />
      <Select ariaLabel="Model" value={model} onValueChange={setModel} options={MODELS} />
    </div>
  );
}

function MotionStop() {
  const [tab, setTab] = useState('plan');
  return (
    <div className="tour-stack">
      <div className="tour-row">
        <Spinner label="Thinking" />
        <Skeleton width={140} />
        <div style={{ width: 160 }}>
          <Progress value={64} label="Tokens" />
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <Tabs.List aria-label="Work">
          <Tabs.Tab value="plan">Plan</Tabs.Tab>
          <Tabs.Tab value="files">Files</Tabs.Tab>
          <Tabs.Tab value="terminal">Terminal</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="plan">Write the failing test first.</Tabs.Panel>
        <Tabs.Panel value="files">Two files changed.</Tabs.Panel>
        <Tabs.Panel value="terminal">Checks passed.</Tabs.Panel>
      </Tabs>
      <Collapsible defaultOpen>
        <Collapsible.Trigger>Worked for 11s</Collapsible.Trigger>
        <Collapsible.Panel>Edited two files. Close it and the row folds.</Collapsible.Panel>
      </Collapsible>
      <Accordion defaultValue="read">
        <Accordion.Item value="read">
          <Accordion.Trigger>Read the diff</Accordion.Trigger>
          <Accordion.Panel>Opening the next row closes this one.</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="run">
          <Accordion.Trigger>Run the checks</Accordion.Trigger>
          <Accordion.Panel>The chevron turns as the panel opens.</Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </div>
  );
}

function DialogStop() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open the sheet</Button>
      <Dialog open={open} onOpenChange={(next) => setOpen(next)}>
        <Dialog.Title>A sheet of the conversation</Dialog.Title>
        <Dialog.Description>Escape or the scrim puts it back on the pile.</Dialog.Description>
        <Dialog.Close />
      </Dialog>
    </>
  );
}

function SessionsStop() {
  const [active, setActive] = useState('a');
  return (
    <div className="tour-sessions">
      <SessionList
        ariaLabel="Sessions"
        groups={[{ id: 'today', label: 'Today', ids: ['a', 'b', 'c'] }]}
        byId={BY_ID}
        activeId={active}
        onSelect={setActive}
      />
    </div>
  );
}

function YoursStop() {
  return (
    <div className="tour-stack">
      <p className="tour-note">
        Default is a flat control: a hairline, no press, a two-pixel fade. LooseLeaf is paper on a desk — a hard
        offset, a press that sits the card down, and an arrival that tips as it lands.
      </p>
      <div className="tour-row">
        <Button variant="secondary" onClick={() => setExperience('skin', 'default')}>
          Default
        </Button>
        <Button onClick={() => setExperience('skin', 'looseleaf')}>LooseLeaf</Button>
        <Button variant="ghost" onClick={() => setExperience('theme', 'light')}>
          Light
        </Button>
        <Button variant="ghost" onClick={() => setExperience('theme', 'dark')}>
          Dark
        </Button>
      </div>
      <div className="tour-row">
        <Button>Send</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
      </div>
    </div>
  );
}

const STAGES: Record<StopId, (skin: string) => ReactNode> = {
  button: () => <ButtonStop />,
  composer: () => <ComposerStop />,
  transcript: (skin) => <TranscriptStop skin={skin} />,
  choice: () => <ChoiceStop />,
  motion: () => <MotionStop />,
  dialog: () => <DialogStop />,
  sessions: () => <SessionsStop />,
  yours: () => <YoursStop />,
};

export function Tour() {
  const [current, setCurrent] = useState<StopId>('button');
  const [skin, setSkin] = useState<Skin>('default');

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setSkin(root.getAttribute('data-aicl-theme') === 'looseleaf' ? 'looseleaf' : 'default');
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['data-aicl-theme'] });
    return () => observer.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    const line = window.innerHeight * 0.35;
    let next: StopId = STOPS[0].id;
    for (const stop of STOPS) {
      const element = document.getElementById(stop.id);
      if (!element) continue;
      if (element.getBoundingClientRect().top <= line) next = stop.id;
    }
    setCurrent(next);
  }, []);

  useEffect(() => {
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  return (
    <div className="tour">
      <GoTo current={current} />
      <main className="tour-main">
        <header className="tour-intro">
          <h1>AICL</h1>
          <p>The component library, walked once. Every stop is the real primitive.</p>
        </header>
        {STOPS.map((stop) => (
          <section key={stop.id} id={stop.id} className="tour-stop" aria-labelledby={`${stop.id}-title`}>
            <h2 id={`${stop.id}-title`}>{stop.title}</h2>
            <p>{stop.line}</p>
            <div className="tour-stage">{STAGES[stop.id](skin)}</div>
          </section>
        ))}
      </main>
    </div>
  );
}
