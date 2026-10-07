import { useEffect, useState } from 'react';
import type { Message } from '@aicl/core';
import { KIT_IDS, KITS } from '../../../shared/kits.ts';
import { KitScope, KitTranscript } from '../../kits/index.tsx';
import type { Story } from '../types.ts';

/** A real session's messages (GET /api/sessions/:id/messages) rendered by every kit. Pick the session with ?session=. */
function Live() {
  const sessionId = new URLSearchParams(location.search).get('session') ?? 'main';
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    fetch(`/api/sessions/${encodeURIComponent(sessionId)}/messages`)
      .then((r) => (r.ok ? (r.json() as Promise<{ messages: Message[] }>) : { messages: [] }))
      .then((b) => live && setMessages(b.messages))
      .catch(() => live && setMessages([]));
    return () => {
      live = false;
    };
  }, [sessionId, n]);
  return (
    <div data-kits-live className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <button type="button" onClick={() => setN((v) => v + 1)} className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-muted">
          Reload
        </button>
        <span>
          session “{sessionId}”: {messages ? `${messages.length} messages` : 'loading…'}
        </span>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(340px,1fr))]">
        {KIT_IDS.map((id) => (
          <section key={id} data-kit-column={id} aria-label={KITS[id].label} className="flex min-w-0 flex-col gap-2">
            <strong className="text-sm">{KITS[id].label}</strong>
            <KitScope
              kit={KITS[id]}
              className="flex h-[680px] flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground"
              style={{ fontFamily: 'var(--aicl-font-sans)' }}
            >
              <div className="flex min-h-0 flex-1 flex-col">
                <KitTranscript kit={KITS[id]} sessionId={sessionId} messages={messages ?? []} status="ready" empty={<p className="p-4 text-sm text-faint">No messages yet.</p>} />
              </div>
            </KitScope>
          </section>
        ))}
      </div>
    </div>
  );
}

export default {
  group: 'Provider kits',
  title: 'Kit conversation (live session)',
  note: 'Messages of a real session, rendered by every kit. Terminal, plan and questions read the live session.',
  wide: true,
  states: { 'All kits': () => <Live /> },
} satisfies Story;
