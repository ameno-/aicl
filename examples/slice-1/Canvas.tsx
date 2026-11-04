import { useState, type ReactNode } from 'react';
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Collapsible,
  Composer,
  Empty,
  Field,
  Kbd,
  PLAYGROUND_INPUTS,
  PlanChecklist,
  Progress,
  STARTER_PROMPT,
  SegmentedControl,
  Select,
  Separator,
  Skeleton,
  Spinner,
  Switch,
  Tabs,
  Tooltip,
  composePrompt,
  type PlaygroundId,
} from '@aicl/react';

function readPrompt(): string {
  const params = new URLSearchParams(window.location.search);
  return params.has('prompt') ? (params.get('prompt') ?? '') : STARTER_PROMPT;
}

function isInput(id: string): id is PlaygroundId {
  return PLAYGROUND_INPUTS.some((input) => input.id === id);
}

function Block({ id }: { id: PlaygroundId }): ReactNode {
  switch (id) {
    case 'button':
      return <Button>Continue</Button>;
    case 'badges':
      return (
        <div className="row">
          <Badge>Default</Badge>
          <Badge variant="success">Live</Badge>
          <Badge variant="destructive">Failed</Badge>
        </div>
      );
    case 'separator':
      return <Separator />;
    case 'kbd':
      return (
        <span>
          Open the palette <Kbd>⌘K</Kbd>
        </span>
      );
    case 'field':
      return (
        <Field label="API base URL" description="Used for new chats" required>
          <input defaultValue="http://localhost" />
        </Field>
      );
    case 'switch':
      return <SwitchBlock />;
    case 'select':
      return <SelectBlock />;
    case 'segmented':
      return <SegmentedBlock />;
    case 'progress':
      return (
        <>
          <Progress value={40} label="Tokens" />
          <Progress label="Working" />
        </>
      );
    case 'skeleton':
      return <Skeleton width={160} />;
    case 'spinner':
      return <Spinner label="Thinking" />;
    case 'alert':
      return (
        <Alert variant="warning">
          <Alert.Title>Needs you</Alert.Title>
          <Alert.Description>Approve the command before the agent continues.</Alert.Description>
        </Alert>
      );
    case 'card':
      return (
        <Card>
          <Card.Header>
            <Card.Title>Plan</Card.Title>
            <Card.Description>Three steps, one of them done.</Card.Description>
          </Card.Header>
          <Card.Body>Write the failing test, then the primitive, then the gallery.</Card.Body>
          <Card.Footer>
            <Badge variant="secondary">1 / 3</Badge>
          </Card.Footer>
        </Card>
      );
    case 'empty':
      return (
        <Empty>
          <Empty.Title>No sessions yet</Empty.Title>
          <Empty.Description>Start one from the composer.</Empty.Description>
          <Empty.Actions>
            <Button size="sm">New session</Button>
          </Empty.Actions>
        </Empty>
      );
    case 'tooltip':
      return (
        <Tooltip content="Copies the message">
          <Button variant="outline" size="sm" icon="copy">
            Copy
          </Button>
        </Tooltip>
      );
    case 'tabs':
      return (
        <Tabs defaultValue="plan">
          <Tabs.List aria-label="Work">
            <Tabs.Tab value="plan">Plan</Tabs.Tab>
            <Tabs.Tab value="files">Files</Tabs.Tab>
            <Tabs.Tab value="terminal">Terminal</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="plan">The plan lives here.</Tabs.Panel>
          <Tabs.Panel value="files">Two files changed.</Tabs.Panel>
          <Tabs.Panel value="terminal">Checks passed.</Tabs.Panel>
        </Tabs>
      );
    case 'collapsible':
      return (
        <Collapsible>
          <Collapsible.Trigger>Worked for 11s</Collapsible.Trigger>
          <Collapsible.Panel>Edited two files. The panel height animates open.</Collapsible.Panel>
        </Collapsible>
      );
    case 'accordion':
      return (
        <Accordion defaultValue="read">
          <Accordion.Item value="read">
            <Accordion.Trigger>Read the diff</Accordion.Trigger>
            <Accordion.Panel>Opening the next row closes this one.</Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item value="run">
            <Accordion.Trigger>Run the checks</Accordion.Trigger>
            <Accordion.Panel>Typecheck, then the component tests.</Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      );
    case 'plan':
      return (
        <PlanChecklist
          title="Ship the frame"
          items={[
            { id: '1', label: 'Name the inputs', status: 'done' },
            { id: '2', label: 'Place them on the frame', status: 'running' },
            { id: '3', label: 'Read the JSX back', status: 'pending' },
          ]}
        />
      );
    case 'composer':
      return (
        <Composer placeholder="Ask the agent…" onSubmit={() => {}}>
          <Composer.Body>
            <Composer.Input />
            <Composer.Submit />
          </Composer.Body>
        </Composer>
      );
    default: {
      const unknown: never = id;
      return unknown;
    }
  }
}

function SwitchBlock() {
  const [on, setOn] = useState(true);
  return <Switch checked={on} onCheckedChange={setOn} label="Stream reasoning" />;
}

function SelectBlock() {
  const [value, setValue] = useState('sonnet');
  return (
    <Select
      ariaLabel="Model"
      value={value}
      onValueChange={setValue}
      options={[
        { value: 'sonnet', label: 'Sonnet 5.5' },
        { value: 'opus', label: 'Opus 5.5' },
      ]}
    />
  );
}

function SegmentedBlock() {
  const [value, setValue] = useState('list');
  return (
    <SegmentedControl
      ariaLabel="Layout"
      value={value}
      onValueChange={setValue}
      options={[
        { value: 'list', label: 'List' },
        { value: 'grid', label: 'Grid' },
      ]}
    />
  );
}

/**
 * A frame, a palette, and a prompt. The palette is the vocabulary: every
 * input is a primitive the library exports, and the JSX beside the frame
 * is the composition the prompt produced.
 */
export function Canvas() {
  const [prompt, setPrompt] = useState(readPrompt);
  const [draft, setDraft] = useState(prompt);
  const [copied, setCopied] = useState(false);
  const composition = composePrompt(prompt);
  const blocks = composition.blocks.filter(isInput);

  const commit = (next: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'canvas');
    url.searchParams.set('prompt', next);
    window.history.replaceState(null, '', url);
    setPrompt(next);
    setDraft(next);
  };

  const toggle = (id: PlaygroundId) => {
    const next = blocks.includes(id) ? blocks.filter((item) => item !== id) : [...blocks, id];
    const written = next
      .map((item) => PLAYGROUND_INPUTS.find((input) => input.id === item)?.phrases[0] ?? '')
      .filter((phrase) => phrase.length > 0)
      .join(', ');
    commit(written);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(composition.jsx);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="canvas-app">
      <aside className="canvas-palette">
        <p className="canvas-kicker">Inputs</p>
        <h1>Canvas</h1>
        <p className="canvas-lead">Each input is a primitive. Pick one, or name it in the prompt.</p>
        <ul>
          {PLAYGROUND_INPUTS.map((input) => (
            <li key={input.id}>
              <button type="button" aria-pressed={blocks.includes(input.id)} onClick={() => toggle(input.id)}>
                {input.label}
              </button>
            </li>
          ))}
        </ul>
        <a href="?view=components">Component gallery</a>
      </aside>
      <main className="canvas-stage">
        <form
          className="canvas-prompt"
          onSubmit={(event) => {
            event.preventDefault();
            commit(draft);
          }}
        >
          <label htmlFor="canvas-prompt">Prompt</label>
          <textarea
            id="canvas-prompt"
            value={draft}
            rows={3}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="row">
            <Button type="submit">Place on the frame</Button>
            <Button type="button" variant="ghost" onClick={() => commit(STARTER_PROMPT)}>
              Starter
            </Button>
          </div>
        </form>
        <p className="canvas-note" role="status">
          {composition.note}
        </p>
        <div className="canvas-frame" data-aicl-root="">
          <div className="canvas-stack">
            {blocks.map((id) => (
              <div key={id} data-canvas-input={id}>
                <Block id={id} />
              </div>
            ))}
          </div>
        </div>
      </main>
      <aside className="canvas-code">
        <div className="row">
          <p className="canvas-kicker">JSX</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <pre>
          <code>{composition.jsx}</code>
        </pre>
      </aside>
    </div>
  );
}
