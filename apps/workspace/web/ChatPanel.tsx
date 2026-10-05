import { useEffect, useMemo, useState } from 'react';
import { createSseTransport } from '@aicl/core';
import { Composer, Transcript, useChat } from '@aicl/react';

/** The chat docked beside the canvas, driven by the workspace's Pi agent. */
export function ChatPanel() {
  const transport = useMemo(() => createSseTransport({ url: '/api/chat' }), []);
  const chat = useChat({ transport });
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/info')
      .then((r) => r.json() as Promise<{ model: string | null }>)
      .then((info) => setModel(info.model));
  }, []);

  return (
    <aside className="chat" aria-label="Agent chat">
      <header className="chat-header">
        <strong>Agent</strong>
        <span className="chat-model" title="Pi model">
          {model ?? '…'}
        </span>
      </header>
      <Transcript messages={chat.messages} status={chat.status} streamingId={chat.streamingId} />
      {chat.status === 'error' && chat.error ? (
        <p className="chat-error" role="alert">
          {chat.error.message}
        </p>
      ) : null}
      <Composer
        status={chat.status}
        placeholder="Ask the agent to sketch something"
        onSubmit={(text) => void chat.send(text)}
        onStop={chat.stop}
      />
    </aside>
  );
}
