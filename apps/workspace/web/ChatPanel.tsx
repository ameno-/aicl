import { useEffect, useRef, useState } from 'react';
import { Composer, SuggestionChips, ToastRegion, Transcript } from '@aicl/react';
import { SquarePen, X } from 'lucide-react';
import { workspaceRegistry } from './agentSteps.tsx';
import { clearCanvasSelection, newWorkspaceChat, screenName, toasts, useSelectedShapeIds, useWorkspaceChat } from './chatStore.ts';
import { setUiSelection, useUiSelection } from './ui/selection.ts';

const STARTERS = [
  { id: 'arch', label: 'Sketch the architecture of this project' },
  { id: 'read', label: 'What is on the canvas right now?' },
  { id: 'flow', label: 'Draw a user sign-up flow' },
  { id: 'design', label: 'Design a mobile chat screen' },
  { id: 'restyle', label: 'Restyle this screen like Lovable' },
  { id: 'recreate', label: 'Recreate the screenshot as a screen' },
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
  const selectedShapes = useSelectedShapeIds();
  const uiSelection = useUiSelection();
  const chip = uiSelection
    ? `Editing ${uiSelection.nodeId} in ${screenName(uiSelection.shapeId) ?? 'screen'}`
    : selectedShapes.length
      ? `${selectedShapes.length} shape${selectedShapes.length === 1 ? '' : 's'} selected`
      : null;

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
        {chip ? (
          <div className="chat-context" role="status" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 8px', margin: '0 0 6px', border: '1px solid var(--aicl-border, #e7e7e5)', borderRadius: 999, width: 'fit-content', maxWidth: '100%' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chip}</span>
            <button
              type="button"
              className="icon-button"
              aria-label="Clear selection"
              title="Clear selection"
              onClick={() => {
                setUiSelection(null);
                clearCanvasSelection();
              }}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        ) : null}
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
