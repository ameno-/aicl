import { useEffect, useState } from 'react';
import { SuggestionChips } from '@aicl/react';
import { Check, ChevronDown, SquarePen, X } from 'lucide-react';
import type { SessionInfo } from '../shared/runtime.ts';
import type { ProviderKit } from '../shared/kits.ts';
import { useConversation } from './app/Conversation.tsx';
import { KitComposer, KitTranscript } from './kits/index.tsx';
import { clearCanvasSelection, newWorkspaceChat, screenName, useSelectedShapeIds } from './chatStore.ts';
import { HitlStrip } from './agentic/hitl.tsx';
import { removePendingContext, setActiveSession, useActiveSessionId, usePendingContext, useSessions } from './sessionsApi.ts';
import { setUiSelection, useUiSelection } from './ui/selection.ts';

const STARTERS = [
  { id: 'arch', label: 'Sketch the architecture of this project' },
  { id: 'read', label: 'What is on the canvas right now?' },
  { id: 'flow', label: 'Draw a user sign-up flow' },
  { id: 'design', label: 'Design a mobile chat screen' },
  { id: 'restyle', label: 'Restyle this screen like Lovable' },
  { id: 'recreate', label: 'Recreate the screenshot as a screen' },
];

const DOT: Record<SessionInfo['status'], string> = { idle: '#a8a8a3', running: '#2f9e44', error: '#e03131' };

function StatusDot({ status }: { status: SessionInfo['status'] }) {
  return (
    <span
      aria-label={status}
      title={status}
      style={{ flex: 'none', width: 8, height: 8, borderRadius: 999, background: DOT[status], boxShadow: status === 'running' ? '0 0 0 3px rgba(47,158,68,.2)' : undefined }}
    />
  );
}

const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', border: 0, borderRadius: 6, color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' } as const;

/** Title of the active session, with a dropdown to switch or start another. */
function SessionSwitcher({ kit }: { kit: ProviderKit }) {
  const sessions = useSessions();
  const activeId = useActiveSessionId();
  const [open, setOpen] = useState(false);
  const active = sessions.find((s) => s.id === activeId);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Switch ${kit.vocabulary.sessions.toLowerCase().replace(/s$/, '')}`}
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%', padding: '2px 6px 2px 0', border: 0, background: 'transparent', color: 'inherit', font: 'inherit', fontWeight: 600, cursor: 'pointer' }}
      >
        {active ? <StatusDot status={active.status} /> : null}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active?.title ?? 'Chat'}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
          <ul
            role="listbox"
            aria-label={kit.vocabulary.sessions}
            style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, minWidth: 240, maxWidth: 320, maxHeight: '60vh', overflowY: 'auto', margin: '4px 0 0', padding: 4, listStyle: 'none', border: '1px solid var(--aicl-border, #e7e7e5)', borderRadius: 10, background: 'var(--aicl-surface, #fff)', boxShadow: '0 8px 24px rgba(0,0,0,.14)' }}
          >
            <li>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  newWorkspaceChat();
                }}
                style={{ ...rowStyle, background: 'transparent' }}
              >
                <SquarePen size={14} aria-hidden="true" /> {kit.vocabulary.newSession}
              </button>
            </li>
            {sessions.map((s) => (
              <li key={s.id} role="option" aria-selected={s.id === activeId}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setActiveSession(s.id);
                  }}
                  style={{ ...rowStyle, background: s.id === activeId ? 'var(--aicl-surface-tint, #f3f3f1)' : 'transparent' }}
                >
                  <StatusDot status={s.status} />
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                    {s.preview ? (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, opacity: 0.6 }}>{s.preview}</span>
                    ) : null}
                  </span>
                  {s.id === activeId ? <Check size={14} aria-hidden="true" /> : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** The chat docked beside the canvas, driven by the workspace's Pi agent. */
export function ChatPanel({ kit }: { kit: ProviderKit }) {
  const activeSessionId = useActiveSessionId();
  const { chat, composerProps, retry } = useConversation(activeSessionId, kit);
  const model = composerProps.model?.value ?? null;

  const empty = chat.messages.length === 0;
  const selectedShapes = useSelectedShapeIds();
  const uiSelection = useUiSelection();
  const pendingContext = usePendingContext();
  const chip = uiSelection
    ? `Editing ${uiSelection.nodeId} in ${screenName(uiSelection.shapeId) ?? 'screen'}`
    : selectedShapes.length
      ? `${selectedShapes.length} shape${selectedShapes.length === 1 ? '' : 's'} selected`
      : null;

  return (
    <aside className="chat" aria-label="Agent chat">
      <header className="chat-header">
        <div>
          <SessionSwitcher kit={kit} />
          <span className="chat-model" title="Pi model">
            {model ?? '…'}
          </span>
        </div>
        <button type="button" className="icon-button" aria-label={kit.vocabulary.newSession} title={kit.vocabulary.newSession} onClick={newWorkspaceChat}>
          <SquarePen size={16} aria-hidden="true" />
        </button>
      </header>
      <KitTranscript
        kit={kit}
        sessionId={activeSessionId}
        messages={chat.messages}
        status={chat.status}
        {...(chat.streamingId ? { streamingId: chat.streamingId } : {})}
        onRetry={retry}
        empty={
          <div className="chat-empty">
            <p className="chat-empty-title">What should we sketch?</p>
            <p className="chat-empty-hint">The agent draws on the canvas beside you, and sees what you draw.</p>
          </div>
        }
      />
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
        {pendingContext.map((p) => (
          <div key={p.id} className="chat-context" role="status" title={p.text.slice(0, 400)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 8px', margin: '0 0 6px', border: '1px solid var(--aicl-border, #e7e7e5)', borderRadius: 999, width: 'fit-content', maxWidth: '100%' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>
            <button type="button" className="icon-button" aria-label={`Remove ${p.label}`} title="Remove" onClick={() => removePendingContext(p.id)}>
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        ))}
        {empty ? (
          <SuggestionChips suggestions={STARTERS} behavior="send" onSelect={(s) => void chat.send(s.label)} />
        ) : null}
        <HitlStrip sessionId={activeSessionId} />
        <KitComposer {...composerProps} variant="bottom" />
      </div>
    </aside>
  );
}
