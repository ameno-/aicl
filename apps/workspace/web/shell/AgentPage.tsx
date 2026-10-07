import { useEffect, useMemo, useRef, useState } from 'react';
import { bucketByRecency, type SessionMeta } from '@aicl/core';
import { AlertDialog, Composer, Dialog, SessionList, SuggestionChips, ToastRegion, Transcript } from '@aicl/react';
import { SquarePen } from 'lucide-react';
import { MAIN_SESSION_ID, type SessionInfo } from '../../shared/runtime.ts';
import { workspaceRegistry } from '../agentSteps.tsx';
import { toasts } from '../chatStore.ts';
import { createSession, deleteSession, renameSession, setActiveSession, useActiveSessionId, useSessionChat, useSessions } from '../sessionsApi.ts';

const STARTERS = [
  { id: 'widget', label: 'Build me a widget that…', prompt: 'Build me a widget that shows ' },
  { id: 'design', label: 'Design a chat screen…', prompt: 'Design a chat screen for ' },
  { id: 'arch', label: 'Sketch the architecture of this project' },
  { id: 'read', label: 'What is on the canvas right now?' },
];

const toMeta = (s: SessionInfo): SessionMeta => ({
  id: s.id,
  title: s.title || 'New chat',
  ...(s.updatedAt ? { updatedAt: s.updatedAt } : {}),
  ...(s.createdAt ? { createdAt: s.createdAt } : {}),
  status: s.status,
  ...(s.status === 'running' ? { statusLine: 'Working…' } : s.status === 'error' ? { statusLine: 'Failed' } : {}),
  ...(s.preview ? { preview: s.preview } : {}),
});

export function AgentPage({ routeSessionId }: { routeSessionId?: string }) {
  const sessions = useSessions();
  const activeId = useActiveSessionId();
  const chat = useSessionChat(activeId);
  const [draft, setDraft] = useState('');
  const [toDelete, setToDelete] = useState<SessionMeta | null>(null);
  const [toRename, setToRename] = useState<SessionMeta | null>(null);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (routeSessionId) setActiveSession(routeSessionId);
  }, [routeSessionId]);

  const { groups, byId } = useMemo(() => {
    const byId: Record<string, SessionMeta> = {};
    const grouped = bucketByRecency(sessions.map(toMeta), Date.now())
      .filter((g) => g.sessions.length)
      .map((g) => ({
        id: g.id,
        ...(g.label !== undefined ? { label: g.label } : {}),
        ids: g.sessions.map((s) => {
          byId[s.id] = s;
          return s.id;
        }),
      }));
    return { groups: grouped, byId };
  }, [sessions]);

  const current = sessions.find((s) => s.id === activeId);
  const empty = chat.messages.length === 0;

  return (
    <div className="agent-page">
      <aside className="agent-sidebar" aria-label="Sessions">
        <button type="button" className="agent-new" onClick={() => void createSession()}>
          <SquarePen size={16} aria-hidden="true" />
          <span>New chat</span>
        </button>
        <div className="agent-sessions">
          <SessionList
            groups={groups}
            byId={byId}
            activeId={activeId}
            onActiveChange={setActiveSession}
            onSelect={setActiveSession}
            actions={['Rename', 'Delete']}
            onAction={(action, meta) => {
              if (action === 'Delete') {
                if (meta.id === MAIN_SESSION_ID) toasts.push({ title: 'The main chat cannot be deleted' });
                else setToDelete(meta);
              } else {
                setTitle(meta.title);
                setToRename(meta);
              }
            }}
          />
        </div>
      </aside>

      <main className="agent-thread" aria-label="Conversation">
        <header className="agent-thread-header">
          <h1>{current?.title || 'New chat'}</h1>
        </header>
        {empty ? (
          <div className="agent-empty">
            <p className="agent-empty-title">What should we build?</p>
            <p className="agent-empty-hint">Ask for widgets, views, or designs. The agent works on your canvas and workspace.</p>
            <SuggestionChips
              suggestions={STARTERS}
              behavior="insert"
              onSelect={(s) => {
                setDraft(s.prompt ?? s.label);
                inputRef.current?.focus();
              }}
            />
          </div>
        ) : (
          <Transcript messages={chat.messages} status={chat.status} streamingId={chat.streamingId} registry={workspaceRegistry} />
        )}
        <div className="agent-composer">
          <Composer
            status={chat.status}
            value={draft}
            onChange={setDraft}
            inputRef={inputRef}
            placeholder="Ask the agent to build, fix, or explain…"
            onSubmit={(text) => void chat.send(text)}
            onStop={chat.stop}
          />
        </div>
      </main>

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete “${toDelete?.title ?? ''}”?`}
        variant="danger"
        consequence="This permanently deletes the chat and its messages."
        onConfirm={() => {
          if (toDelete) void deleteSession(toDelete.id);
          setToDelete(null);
        }}
      />
      <Dialog open={toRename !== null} onOpenChange={(o) => !o && setToRename(null)} size="sm">
        <Dialog.Title>Rename chat</Dialog.Title>
        <form
          className="agent-rename"
          onSubmit={(e) => {
            e.preventDefault();
            if (toRename && title.trim()) void renameSession(toRename.id, title.trim());
            setToRename(null);
          }}
        >
          <input aria-label="Chat title" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
          <button type="submit">Save</button>
        </form>
        <Dialog.Close />
      </Dialog>
      <ToastRegion queue={toasts} placement="top-center" />
    </div>
  );
}
