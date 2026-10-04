import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  createRendererRegistry,
  type ChatTransport,
  type Message,
  type StreamEvent,
} from '@aicl/core';
import {
  ArtifactCard,
  Composer,
  Transcript,
  UnknownPart,
  useChat,
  type PartProps,
} from '@aicl/react';

export type Scenario =
  | 'empty'
  | 'submitted'
  | 'streaming'
  | 'tool-running'
  | 'tool-error'
  | 'artifact'
  | 'unknown'
  | 'stopped'
  | 'error'
  | 'play'
  | 'remote';

const SCENARIOS: Array<{ id: Scenario; label: string }> = [
  { id: 'empty', label: 'Empty' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'streaming', label: 'Streaming' },
  { id: 'tool-running', label: 'Tool running' },
  { id: 'tool-error', label: 'Tool error' },
  { id: 'artifact', label: 'Artifact card' },
  { id: 'unknown', label: 'Unknown part' },
  { id: 'stopped', label: 'Stopped' },
  { id: 'error', label: 'Error + retry' },
  { id: 'play', label: 'Play turn' },
  { id: 'remote', label: 'Remote SSE' },
];

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

function hold(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve();
    else signal.addEventListener('abort', () => resolve(), { once: true });
  });
}

function scripted(events: StreamEvent[], pauseMs = 40): ChatTransport {
  return {
    async *send(_req, signal) {
      for (const event of events) {
        if (signal.aborted) return;
        await wait(pauseMs, signal);
        if (signal.aborted) return;
        yield event;
      }
      await hold(signal);
    },
  };
}

function playTransport(): ChatTransport {
  return {
    async *send(_req, signal) {
      const events: StreamEvent[] = [
        { type: 'message-start', id: 'play', role: 'assistant' },
        { type: 'part-start', index: 0, part: { type: 'reasoning', text: 'Checking the diff.' } },
        { type: 'part-start', index: 1, part: { type: 'text', text: '' } },
        { type: 'part-delta', index: 1, delta: 'Edited two files. ' },
        { type: 'part-delta', index: 1, delta: 'Checks passed.' },
        {
          type: 'part-start',
          index: 2,
          part: { type: 'tool-call', toolCallId: 't1', name: 'search', args: {}, status: 'running' },
        },
        {
          type: 'part-end',
          index: 2,
          part: {
            type: 'tool-call',
            toolCallId: 't1',
            name: 'search',
            args: { q: 'slice' },
            status: 'success',
          },
        },
        {
          type: 'part-start',
          index: 3,
          part: { type: 'artifact', artifactId: 'a', kind: 'document', title: 'Slice notes', version: 1 },
        },
        {
          type: 'part-start',
          index: 4,
          part: {
            type: 'data-run-receipt',
            data: { files: 2, checks: 14, elapsed: '4s' },
          },
        },
        { type: 'part-start', index: 5, part: { type: 'data-mystery', data: {} } },
        { type: 'message-end', finishReason: 'stop' },
      ];
      for (const event of events) {
        if (signal.aborted) return;
        await wait(80, signal);
        if (signal.aborted) return;
        yield event;
      }
    },
  };
}

function errorThenRetry(): ChatTransport {
  let attempt = 0;
  return {
    async *send(_req, signal) {
      attempt += 1;
      if (signal.aborted) return;
      yield { type: 'message-start', id: `err-${attempt}`, role: 'assistant' };
      yield { type: 'part-start', index: 0, part: { type: 'text', text: 'partial' } };
      if (attempt === 1) throw new Error('upstream 503');
      yield { type: 'part-delta', index: 0, delta: ' recovered' };
      yield { type: 'message-end', finishReason: 'stop' };
    },
  };
}

function remoteTransport(): ChatTransport {
  return {
    async *send(req, signal) {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify({ messages: req.messages, ...req.body }),
        signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`Chat request failed: ${response.status} ${response.statusText}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          if (signal.aborted) break;
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf('\n\n');
          while (boundary !== -1) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf('\n\n');
            const data = frame
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trimStart())
              .join('\n');
            if (data === '[DONE]') return;
            if (!data) continue;
            try {
              yield JSON.parse(data) as StreamEvent;
            } catch {
              // ignore malformed frames
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}

function transportFor(scenario: Scenario): ChatTransport {
  if (scenario === 'remote') return remoteTransport();
  if (scenario === 'play') return playTransport();
  if (scenario === 'error') return errorThenRetry();
  if (scenario === 'submitted') {
    return {
      async *send(_req, signal) {
        await hold(signal);
      },
    };
  }
  if (scenario === 'streaming' || scenario === 'stopped') {
    return scripted([
      { type: 'message-start', id: 's1', role: 'assistant' },
      { type: 'part-start', index: 0, part: { type: 'text', text: '' } },
      { type: 'part-delta', index: 0, delta: 'Partial reply' },
      { type: 'part-delta', index: 0, delta: ' still arriving' },
    ]);
  }
  if (scenario === 'tool-running') {
    return scripted([
      { type: 'message-start', id: 's1', role: 'assistant' },
      { type: 'part-start', index: 0, part: { type: 'text', text: 'Looking.' } },
      {
        type: 'part-start',
        index: 1,
        part: { type: 'tool-call', toolCallId: 't1', name: 'search', args: {}, status: 'running' },
      },
    ]);
  }
  if (scenario === 'tool-error') {
    return scripted([
      { type: 'message-start', id: 's1', role: 'assistant' },
      {
        type: 'part-start',
        index: 0,
        part: {
          type: 'tool-call',
          toolCallId: 't1',
          name: 'search',
          args: { q: 'missing' },
          status: 'error',
        },
      },
    ]);
  }
  if (scenario === 'artifact') {
    return scripted([
      { type: 'message-start', id: 's1', role: 'assistant' },
      { type: 'part-start', index: 0, part: { type: 'text', text: 'Wrote the notes.' } },
      {
        type: 'part-start',
        index: 1,
        part: { type: 'artifact', artifactId: 'notes', kind: 'document', title: 'Slice notes', version: 2 },
      },
    ]);
  }
  if (scenario === 'unknown') {
    return scripted([
      { type: 'message-start', id: 's1', role: 'assistant' },
      { type: 'part-start', index: 0, part: { type: 'text', text: 'The thread continues.' } },
      { type: 'part-start', index: 1, part: { type: 'data-mystery', data: {} } },
    ]);
  }
  return { async *send() {} };
}

type ReceiptData = { files?: number; checks?: number; elapsed?: string };

type OpenedView =
  | { kind: 'artifact'; title: string; artifactKind: string; version?: number }
  | { kind: 'receipt'; files: number; checks: number; elapsed: string };

function receiptData(part: PartProps['part']): ReceiptData {
  if (part.type !== 'data-run-receipt' || !part.data || typeof part.data !== 'object') return {};
  return part.data as ReceiptData;
}

function RunReceipt({
  part,
  onOpen,
}: PartProps & { onOpen: (view: OpenedView) => void }) {
  const data = receiptData(part);
  return (
    <div data-aicl="part" data-part="data-run-receipt">
      <div>files {data.files ?? 0}</div>
      <div>checks {data.checks ?? 0}</div>
      <div>elapsed {data.elapsed ?? '—'}</div>
      <button
        type="button"
        onClick={() =>
          onOpen({
            kind: 'receipt',
            files: data.files ?? 0,
            checks: data.checks ?? 0,
            elapsed: data.elapsed ?? '—',
          })
        }
      >
        Open
      </button>
    </div>
  );
}

function registryFor(onOpen: (view: OpenedView) => void) {
  return createRendererRegistry<ComponentType<PartProps>>(
    {
      artifact: ((props: PartProps) =>
        props.part.type === 'artifact' ? (
          <ArtifactCard
            {...props}
            part={props.part}
            onOpen={(part) =>
              onOpen({
                kind: 'artifact',
                title: part.title ?? part.artifactId,
                artifactKind: part.kind,
                version: part.version,
              })
            }
          />
        ) : null) as ComponentType<PartProps>,
      'data-run-receipt': ((props: PartProps) => (
        <RunReceipt {...props} onOpen={onOpen} />
      )) as ComponentType<PartProps>,
    },
    UnknownPart,
  );
}

function WorkPane({ view, onClose }: { view: OpenedView; onClose: () => void }) {
  const title = view.kind === 'artifact' ? view.title : 'Run receipt';
  return (
    <aside className="work-pane" data-aicl="work-pane" aria-label="Opened work">
      <header>
        <strong>{title}</strong>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </header>
      {view.kind === 'artifact' ? (
        <p>
          {view.artifactKind}
          {view.version != null ? ` · v${view.version}` : ''}
        </p>
      ) : (
        <ul>
          <li>files {view.files}</li>
          <li>checks {view.checks}</li>
          <li>elapsed {view.elapsed}</li>
        </ul>
      )}
      <p className="pane-note">Opened from the thread. Not a library page.</p>
    </aside>
  );
}

function Stage({ scenario }: { scenario: Scenario }) {
  const transport = useMemo(() => transportFor(scenario), [scenario]);
  const [opened, setOpened] = useState<OpenedView | null>(null);
  const registry = useMemo(() => registryFor(setOpened), []);
  const chat = useChat({ transport, generateId: () => `id-${Math.random().toString(36).slice(2, 8)}` });

  const stopRef = useRef(chat.stop);
  stopRef.current = chat.stop;
  const statusRef = useRef(chat.status);
  statusRef.current = chat.status;

  useEffect(() => {
    if (scenario === 'empty') return;
    void chat.send(scenario === 'remote' ? 'Network round-trip' : 'Show the work');
    if (scenario !== 'stopped') return;
    const timer = setInterval(() => {
      if (statusRef.current === 'streaming') {
        stopRef.current();
        clearInterval(timer);
      }
    }, 30);
    return () => clearInterval(timer);
  }, [chat.send, scenario]);

  return (
    <div className={opened ? 'work work-open' : 'work'}>
      <div className="stage">
        <Transcript
          messages={chat.messages}
          status={chat.status}
          streamingId={chat.streamingId}
          registry={registry}
        />
        {chat.status === 'error' ? (
          <button type="button" className="retry" aria-label="Retry" onClick={() => void chat.regenerate()}>
            ↻
          </button>
        ) : null}
        <Composer
          status={chat.status}
          placeholder="Message"
          onSubmit={(text) => void chat.send(text)}
          onStop={chat.stop}
        />
      </div>
      {opened ? <WorkPane view={opened} onClose={() => setOpened(null)} /> : null}
    </div>
  );
}

export function App() {
  const selected = new URLSearchParams(window.location.search).get('scenario');
  const initial = SCENARIOS.some((item) => item.id === selected) ? (selected as Scenario) : 'empty';
  const [scenario, setScenario] = useState<Scenario>(initial);
  const choose = (next: Scenario) => {
    const url = new URL(window.location.href);
    url.searchParams.set('scenario', next);
    window.history.replaceState(null, '', url);
    setScenario(next);
  };
  return (
    <div className="app">
      <nav className="scenarios" aria-label="Scenarios">
        {SCENARIOS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={scenario === item.id}
            onClick={() => choose(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <Stage key={scenario} scenario={scenario} />
    </div>
  );
}
