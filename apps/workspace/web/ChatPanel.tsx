import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { createRendererRegistry, createSseTransport, createToastQueue, type ToolCallPart } from '@aicl/core';
import {
  Composer,
  SuggestionChips,
  ToastRegion,
  ToolCallDisclosure,
  Transcript,
  UnknownPart,
  useChat,
  type PartProps,
} from '@aicl/react';
import { MarkdownTextPart } from '@aicl/react/markdown';
import { SquarePen } from 'lucide-react';

const STARTERS = [
  { id: 'arch', label: 'Sketch the architecture of this project' },
  { id: 'read', label: 'What is on the canvas right now?' },
  { id: 'flow', label: 'Draw a user sign-up flow' },
];

const count = (args: unknown, key: string) => {
  const list = (args as Record<string, unknown> | undefined)?.[key];
  return Array.isArray(list) ? list.length : 0;
};
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** Agent steps in the product's voice ("Drew 4 shapes"), not tool ids. */
function describe(part: ToolCallPart): string {
  const done = part.status === 'success';
  const args = part.args as Record<string, unknown> | undefined;
  switch (part.name) {
    case 'scratch_read':
      return done ? 'Read the canvas' : 'Reading the canvas';
    case 'scratch_view':
      return done ? 'Looked at the canvas' : 'Looking at the canvas';
    case 'scratch_add': {
      const n = count(args, 'shapes');
      return done ? `Drew ${plural(n, 'shape')}` : n ? `Drawing ${plural(n, 'shape')}` : 'Drawing';
    }
    case 'scratch_update':
      return done ? `Edited ${plural(count(args, 'shapes'), 'shape')}` : 'Editing shapes';
    case 'scratch_delete':
      return done ? `Deleted ${plural(count(args, 'ids'), 'shape')}` : 'Deleting shapes';
    case 'scratch_clear':
      return done ? 'Cleared the canvas' : 'Clearing the canvas';
    case 'read':
      return `${done ? 'Read' : 'Reading'} ${String(args?.['path'] ?? 'a file')}`;
    case 'grep':
    case 'find':
      return `${done ? 'Searched' : 'Searching'} for ${String(args?.['pattern'] ?? 'files')}`;
    case 'ls':
      return `${done ? 'Listed' : 'Listing'} ${String(args?.['path'] ?? 'files')}`;
    default:
      return part.name;
  }
}

function AgentStep(props: PartProps) {
  if (props.part.type !== 'tool-call') return null;
  return <ToolCallDisclosure {...props} part={{ ...props.part, name: describe(props.part) }} />;
}

/** The chat docked beside the canvas, driven by the workspace's Pi agent. */
export function ChatPanel() {
  const [session, setSession] = useState(0);
  return <ChatSession key={session} onNew={() => setSession((n) => n + 1)} />;
}

function ChatSession({ onNew }: { onNew: () => void }) {
  const transport = useMemo(() => createSseTransport({ url: '/api/chat' }), []);
  const toasts = useMemo(() => createToastQueue(), []);
  const chat = useChat({
    transport,
    onError: (e) => toasts.push({ title: 'The agent stopped', description: e.message, variant: 'error' }),
  });
  const [model, setModel] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const registry = useMemo(
    () =>
      createRendererRegistry<ComponentType<PartProps>>(
        // Only overrides: PartRenderer falls back to the defaults for every other type.
        { text: MarkdownTextPart as ComponentType<PartProps>, 'tool-call': AgentStep },
        UnknownPart,
      ),
    [],
  );

  useEffect(() => {
    void fetch('/api/info')
      .then((r) => r.json() as Promise<{ model: string | null }>)
      .then((info) => setModel(info.model));
  }, []);

  const empty = chat.messages.length === 0;

  return (
    <aside className="chat" aria-label="Agent chat">
      <header className="chat-header">
        <div>
          <strong>Agent</strong>
          <span className="chat-model" title="Pi model">
            {model ?? '…'}
          </span>
        </div>
        <button type="button" className="icon-button" aria-label="New chat" title="New chat" onClick={onNew} disabled={chat.isBusy}>
          <SquarePen size={16} aria-hidden="true" />
        </button>
      </header>
      {empty ? (
        <div className="chat-empty">
          <p className="chat-empty-title">What should we sketch?</p>
          <p className="chat-empty-hint">The agent draws on the canvas beside you, and sees what you draw.</p>
        </div>
      ) : (
        <Transcript messages={chat.messages} status={chat.status} streamingId={chat.streamingId} registry={registry} />
      )}
      <div className="chat-composer">
        {empty ? (
          <SuggestionChips suggestions={STARTERS} behavior="send" onSelect={(s) => void chat.send(s.label)} />
        ) : null}
        <Composer
          status={chat.status}
          value={draft}
          onChange={setDraft}
          inputRef={inputRef}
          placeholder="Ask the agent to sketch something"
          onSubmit={(text) => void chat.send(text)}
          onStop={chat.stop}
        />
      </div>
      <ToastRegion queue={toasts} placement="top-center" />
    </aside>
  );
}
