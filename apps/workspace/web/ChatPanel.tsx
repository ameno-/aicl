import { useEffect, useRef, useState } from 'react';
import { Composer, SuggestionChips, ToastRegion, Transcript } from '@aicl/react';
import { SquarePen } from 'lucide-react';
import { workspaceRegistry } from './agentSteps.tsx';
import { newWorkspaceChat, toasts, useWorkspaceChat } from './chatStore.ts';

const STARTERS = [
  { id: 'arch', label: 'Sketch the architecture of this project' },
  { id: 'read', label: 'What is on the canvas right now?' },
  { id: 'flow', label: 'Draw a user sign-up flow' },
];

/** The chat docked beside the canvas, driven by the workspace's Pi agent. */
export function ChatPanel() {
  const chat = useWorkspaceChat();
  const [model, setModel] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

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
        <button type="button" className="icon-button" aria-label="New chat" title="New chat" onClick={newWorkspaceChat} disabled={chat.isBusy}>
          <SquarePen size={16} aria-hidden="true" />
        </button>
      </header>
      {empty ? (
        <div className="chat-empty">
          <p className="chat-empty-title">What should we sketch?</p>
          <p className="chat-empty-hint">The agent draws on the canvas beside you, and sees what you draw.</p>
        </div>
      ) : (
        <Transcript messages={chat.messages} status={chat.status} streamingId={chat.streamingId} registry={workspaceRegistry} />
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
