/**
 * The Agents tab (aicl:/agents): every session as a live tree (roots → the
 * sub-agents they spawned), with state, current step, elapsed time and cost per
 * row; the selected agent's transcript with a composer to steer it and a Stop
 * button; an aggregate header; an inbox of every pending approval/question
 * across all sessions; and the handoff log.
 */
import { useMemo, useState } from 'react';
import { Inbox, OctagonX, ScrollText } from 'lucide-react';
import type { ProviderKit } from '../../shared/kits.ts';
import { MAIN_SESSION_ID, type SessionInfo } from '../../shared/runtime.ts';
import type { SwarmEvent } from '../../shared/swarm.ts';
import { ApprovalCard, QuestionCard, useHitl } from '../agentic/hitl.tsx';
import { toasts } from '../chatStore.ts';
import { KitComposer, KitTranscript } from '../kits/index.tsx';
import { sendToSession, useSessions } from '../sessionsApi.ts';
import { messageAgent, stopAgent, useNow, useServerMessages, useSwarmLog } from './store.ts';
import { aggregate, buildRows, elapsedOf, formatCost, formatElapsed, formatTokens, stateOf } from './tree.ts';
import './swarm.css';

const excerpt = (s: string | undefined, max = 90): string => {
  const flat = (s ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function AgentsView({ kit }: { kit: ProviderKit }) {
  const sessions = useSessions();
  const rows = useMemo(() => buildRows(sessions), [sessions]);
  const totals = useMemo(() => aggregate(sessions), [sessions]);
  const now = useNow(totals.running > 0);
  const [picked, setPicked] = useState<string | null>(null);
  const selected = sessions.find((s) => s.id === picked) ?? sessions.find((s) => s.id === MAIN_SESSION_ID) ?? sessions[0];
  const cost = formatCost(totals.costUsd);

  return (
    <div className="swarm" data-swarm="view">
      <header className="swarm-head">
        <h1>Agents</h1>
        <span className="swarm-stat" data-swarm="running">
          <b>{totals.running}</b> running
        </span>
        <span className="swarm-stat" data-swarm="total">
          <b>{totals.agents}</b> sub-agent{totals.agents === 1 ? '' : 's'} · {totals.total} total
        </span>
        <span className="swarm-stat" data-swarm="tokens">
          <b>{formatTokens(totals.inputTokens + totals.outputTokens)}</b> tokens
          <small>
            {' '}
            ({formatTokens(totals.inputTokens)} in · {formatTokens(totals.outputTokens)} out)
          </small>
        </span>
        {cost ? (
          <span className="swarm-stat" data-swarm="cost">
            <b>{cost}</b>
          </span>
        ) : null}
      </header>

      <div className="swarm-body">
        <section className="swarm-col swarm-tree" aria-label="Agent tree">
          <ul role="tree">
            {rows.map(({ session: s, depth }) => (
              <Row key={s.id} s={s} depth={depth} now={now} selected={s.id === selected?.id} onPick={() => setPicked(s.id)} />
            ))}
          </ul>
          {totals.agents === 0 ? (
            <p className="swarm-hint">
              No sub-agents yet. Ask the agent to delegate (it can use spawn_agent), or start a workflow from the command menu.
            </p>
          ) : null}
        </section>

        <section className="swarm-col swarm-detail" aria-label="Selected agent">
          {selected ? <Detail key={selected.id} kit={kit} s={selected} sessions={sessions} now={now} /> : null}
        </section>

        <aside className="swarm-col swarm-side">
          <InboxPane sessions={sessions} />
          <LogPane />
        </aside>
      </div>
    </div>
  );
}

function Row({ s, depth, now, selected, onPick }: { s: SessionInfo; depth: number; now: number; selected: boolean; onPick: () => void }) {
  const state = stateOf(s);
  const elapsed = elapsedOf(s, now);
  const tokens = s.usage ? s.usage.inputTokens + s.usage.outputTokens : 0;
  const cost = formatCost(s.usage?.costUsd ?? 0);
  const line = state === 'running' ? (s.currentStep ?? 'starting') : excerpt(s.preview) || (s.task ? excerpt(s.task) : '');
  return (
    <li role="treeitem" aria-selected={selected} aria-level={depth + 1}>
      <button
        type="button"
        className="swarm-row"
        data-swarm="row"
        data-session-id={s.id}
        data-state={state}
        data-depth={depth}
        data-selected={selected || undefined}
        style={{ paddingLeft: `calc(var(--aicl-space-3) + ${depth * 18}px)` }}
        onClick={onPick}
      >
        <span className="swarm-dot" data-state={state} title={state} />
        <span className="swarm-row-main">
          <span className="swarm-row-title">
            <b data-swarm="name">{s.title}</b>
            {s.role ? <small>{excerpt(s.role, 60)}</small> : null}
          </span>
          <span className="swarm-row-step" data-swarm="step" data-live={state === 'running' || undefined}>
            {line || state}
          </span>
        </span>
        <span className="swarm-row-meta">
          {elapsed !== undefined ? <span data-swarm="elapsed">{formatElapsed(elapsed)}</span> : null}
          {tokens ? (
            <span data-swarm="usage">
              {formatTokens(tokens)} tok{cost ? ` · ${cost}` : ''}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

function Detail({ kit, s, sessions, now }: { kit: ProviderKit; s: SessionInfo; sessions: SessionInfo[]; now: number }) {
  const running = s.status === 'running';
  const messages = useServerMessages(s.id, running, `${s.status}:${s.updatedAt}:${s.usage?.outputTokens ?? 0}`);
  const [draft, setDraft] = useState('');
  const state = stateOf(s);
  const parent = s.parentId ? sessions.find((x) => x.id === s.parentId) : undefined;
  const below = sessions.filter((x) => x.rootId === s.id || x.parentId === s.id).filter((x) => x.status === 'running').length;
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  const send = async (text: string) => {
    setDraft('');
    // A finished top-level chat is driven from the browser like any conversation; everything else goes through the swarm.
    if (!s.parentId && !running) {
      sendToSession(text, s.id);
      return;
    }
    const r = await messageAgent(s.id, text);
    if (!r.ok) toasts.push({ title: 'Could not send', description: r.message ?? 'The agent did not accept the message.', variant: 'error' });
  };

  return (
    <div className="swarm-detail-inner" data-swarm="detail" data-session-id={s.id}>
      <header className="swarm-detail-head">
        <span className="swarm-dot" data-state={state} />
        <div className="swarm-detail-title">
          <h2 data-swarm="detail-name">{s.title}</h2>
          <p>
            {state}
            {parent ? ` · spawned by ${parent.title}` : ''}
            {s.role ? ` · ${excerpt(s.role, 120)}` : ''}
            {running && s.startedAt ? ` · ${formatElapsed(now - s.startedAt)}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="swarm-stop"
          data-swarm="stop"
          disabled={!running}
          title={below ? 'Stop this agent and everything it spawned' : 'Stop this agent'}
          onClick={() => void stopAgent(s.id)}
        >
          <OctagonX size={14} aria-hidden="true" />
          Stop
        </button>
      </header>
      {s.task ? (
        <p className="swarm-task" data-swarm="task">
          <b>Task</b> {s.task}
        </p>
      ) : null}
      <div className="swarm-transcript" data-swarm="transcript">
        <KitTranscript
          kit={kit}
          sessionId={s.id}
          messages={messages}
          status={running ? 'streaming' : 'ready'}
          {...(running && lastAssistant ? { streamingId: lastAssistant.id } : {})}
          empty={<p className="swarm-hint">{running ? 'Working…' : 'Nothing here yet.'}</p>}
        />
      </div>
      <div className="swarm-composer">
        <KitComposer
          kit={kit}
          value={draft}
          onChange={setDraft}
          onSubmit={(t) => void send(t)}
          status="ready"
          variant="bottom"
          placeholder={running ? `Steer ${s.title}… (delivered after its current step)` : `Message ${s.title}`}
        />
      </div>
    </div>
  );
}

function InboxPane({ sessions }: { sessions: SessionInfo[] }) {
  const { pending } = useHitl();
  const byId = new Map(sessions.map((s) => [s.id, s]));
  return (
    <section className="swarm-pane" data-swarm="inbox" aria-label="Inbox">
      <h3>
        <Inbox size={14} aria-hidden="true" /> Inbox <span className="swarm-count">{pending.length}</span>
      </h3>
      {pending.length === 0 ? <p className="swarm-hint">Nothing is waiting for you.</p> : null}
      <ul>
        {pending.map((r) => {
          const owner = byId.get(r.sessionId);
          const parent = owner?.parentId ? byId.get(owner.parentId) : undefined;
          return (
            <li key={r.id} data-swarm="inbox-item" data-session-id={r.sessionId}>
              <div className="swarm-inbox-who">
                <b>{owner?.title ?? r.sessionId}</b>
                {parent ? <small>via {parent.title}</small> : null}
                {owner?.role ? <small>{excerpt(owner.role, 50)}</small> : null}
              </div>
              {r.kind === 'approval' ? <ApprovalCard request={r} /> : <QuestionCard request={r} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function describe(e: SwarmEvent): string {
  switch (e.type) {
    case 'spawn':
      return `${e.fromName} spawned ${e.toName}: ${excerpt(e.text, 120)}`;
    case 'message':
      return `${e.fromName} → ${e.toName}: ${excerpt(e.text, 120)}`;
    case 'stop':
      return `${e.fromName} stopped ${e.toName}`;
    case 'result':
      return `${e.fromName} finished (${e.status ?? 'done'}): ${excerpt(e.text, 120)}`;
  }
}

function LogPane() {
  const events = useSwarmLog();
  const recent = [...events].reverse().slice(0, 60);
  return (
    <section className="swarm-pane" data-swarm="log" aria-label="Handoff log">
      <h3>
        <ScrollText size={14} aria-hidden="true" /> Handoffs <span className="swarm-count">{events.length}</span>
      </h3>
      {recent.length === 0 ? <p className="swarm-hint">Spawns, messages and results show up here.</p> : null}
      <ul>
        {recent.map((e) => (
          <li key={e.id} data-swarm="log-item" data-type={e.type}>
            <time>{clock(e.at)}</time>
            <span>{describe(e)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
