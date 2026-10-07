/** Canvas component "agent": a compact chat window for one independent agent (wave 2, package C). */
import { useEffect, useRef, useState } from 'react';
import { Composer, Transcript } from '@aicl/react';
import { workspaceRegistry } from '../agentSteps.tsx';
import { TranscriptSession, useSessionChat, useSessions } from '../sessionsApi.ts';
import type { ComponentRendererProps } from './types.ts';
import './agent.css';

const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/** One in-flight creation per shape, so re-renders never make two sessions. */
const creating = new Map<string, Promise<string>>();

function createNodeSession(key: string, title: string): Promise<string> {
  let p = creating.get(key);
  if (!p) {
    p = fetch('/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, kind: 'node' }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Could not create a session (${r.status})`);
        return r.json() as Promise<{ session: { id: string } }>;
      })
      .then(({ session }) => session.id)
      .finally(() => setTimeout(() => creating.delete(key), 5000));
    creating.set(key, p);
  }
  return p;
}

function Editable({ value, placeholder, className, onSave }: { value: string; placeholder: string; className: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <button
        type="button"
        className={className}
        title="Click to edit"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value || placeholder}
      </button>
    );
  }
  const finish = (save: boolean) => {
    setEditing(false);
    if (save && draft.trim() !== value) onSave(draft.trim());
  };
  return (
    <input
      className={className}
      autoFocus
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      }}
    />
  );
}

export function AgentRenderer({ props, shapeId, onPropsChange }: ComponentRendererProps) {
  const sessionId = text(props['sessionId']) || undefined;
  const name = text(props['name']) || 'Agent';
  const role = text(props['role']);
  const latest = useRef({ props, onPropsChange });
  latest.current = { props, onPropsChange };

  useEffect(() => {
    if (sessionId || !onPropsChange) return;
    let live = true;
    void createNodeSession(shapeId ?? name, name).then((id) => {
      // Re-read props: the user may have renamed the node meanwhile.
      if (live && !text(latest.current.props['sessionId'])) latest.current.onPropsChange?.({ ...latest.current.props, sessionId: id });
    });
    return () => {
      live = false;
    };
  }, [sessionId, shapeId, name, onPropsChange]);

  return (
    <div className="aicl-cmp-chat" onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      <Header sessionId={sessionId} name={name} role={role} onChange={(patch) => onPropsChange?.({ ...props, ...patch })} />
      {sessionId ? <Conversation sessionId={sessionId} /> : <div className="aicl-cmp-empty">Starting…</div>}
    </div>
  );
}

function Header(p: { sessionId: string | undefined; name: string; role: string; onChange: (patch: Record<string, string>) => void }) {
  const sessions = useSessions();
  const status = sessions.find((s) => s.id === p.sessionId)?.status ?? 'idle';
  return (
    <div className="aicl-agent-head">
      <span className="aicl-agent-dot" data-status={status} title={status} />
      <Editable className="aicl-agent-name" value={p.name} placeholder="Name" onSave={(v) => p.onChange({ name: v || 'Agent' })} />
      <Editable className="aicl-agent-role" value={p.role} placeholder="Add a role…" onSave={(v) => p.onChange({ role: v })} />
    </div>
  );
}

function Conversation({ sessionId }: { sessionId: string }) {
  const chat = useSessionChat(sessionId);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  return (
    <>
      {chat.messages.length === 0 ? (
        <div className="aicl-cmp-empty">Message this agent</div>
      ) : (
        <TranscriptSession.Provider value={sessionId}>
          <Transcript messages={chat.messages} status={chat.status} streamingId={chat.streamingId} registry={workspaceRegistry} />
        </TranscriptSession.Provider>
      )}
      <div className="aicl-cmp-chat-composer">
        <Composer
          status={chat.status}
          value={draft}
          onChange={setDraft}
          inputRef={inputRef}
          placeholder="Message this agent"
          onSubmit={(t) => void chat.send(t)}
          onStop={chat.stop}
        />
      </div>
    </>
  );
}
