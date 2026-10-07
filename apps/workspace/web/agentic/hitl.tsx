/**
 * Wave 2, package A — human in the loop (browser). CONTRACT: shared/agentic.ts.
 * One store (pending + resolved requests, kept live by 'hitl' / 'hitl-resolved'
 * events) feeds three surfaces: the ask_user chat part, the approvals strip
 * above every composer, and the canvas "question" component.
 */
import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import type { PartProps } from '@aicl/react';
import { Check, ChevronRight, CircleHelp, ShieldAlert, X } from 'lucide-react';
import type { HitlAnswer, HitlRequest } from '../../shared/agentic.ts';
import { onServerEvent } from '../events.ts';

type Question = Extract<HitlRequest, { kind: 'question' }>;
type Approval = Extract<HitlRequest, { kind: 'approval' }>;

/* ── Store ────────────────────────────────────────────────────────── */

interface State {
  pending: HitlRequest[];
  /** Answered requests (the server keeps the latest), so cards can show "You chose …". */
  resolved: Array<{ request: HitlRequest; answer: HitlAnswer }>;
}

let state: State = { pending: [], resolved: [] };
const listeners = new Set<() => void>();
let started = false;

function set(next: State): void {
  state = next;
  for (const l of [...listeners]) l();
}

function start(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const add = (request: HitlRequest) => {
    if (!state.pending.some((p) => p.id === request.id)) set({ ...state, pending: [...state.pending, request] });
  };
  onServerEvent('hitl', (e) => add(e.request));
  onServerEvent('hitl-resolved', (e) => {
    const request = state.pending.find((p) => p.id === e.id);
    set({
      pending: state.pending.filter((p) => p.id !== e.id),
      resolved: request ? [...state.resolved, { request, answer: e.answer }].slice(-200) : state.resolved,
    });
  });
  // Requests raised before this page connected.
  void fetch('/api/hitl')
    .then((r) => r.json() as Promise<{ pending: HitlRequest[]; resolved?: State['resolved'] }>)
    .then((body) => {
      const seen = new Set(state.resolved.map((r) => r.request.id));
      const earlier = (body.resolved ?? []).filter((r) => !seen.has(r.request.id));
      if (earlier.length) set({ ...state, resolved: [...earlier, ...state.resolved] });
      body.pending.forEach(add);
    })
    .catch(() => {});
}

function useHitl(): State {
  start();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => state,
  );
}

async function submit(id: string, answer: HitlAnswer): Promise<void> {
  await fetch(`/api/hitl/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(answer),
  }).catch(() => {});
}

/* ── Look (library tokens) ────────────────────────────────────────── */

const card: CSSProperties = {
  display: 'grid',
  gap: 'var(--aicl-space-2)',
  padding: 'var(--aicl-space-3)',
  border: '1px solid var(--aicl-border)',
  borderRadius: 'var(--aicl-radius-lg)',
  background: 'var(--aicl-surface)',
  color: 'var(--aicl-text)',
  fontSize: 'var(--aicl-text-sm)',
  lineHeight: 'var(--aicl-leading-snug)',
};
const btn = (kind: 'primary' | 'ghost' | 'danger' = 'ghost', selected = false): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 12px',
  border: `1px solid ${kind === 'primary' || selected ? 'var(--aicl-accent)' : 'var(--aicl-border-strong)'}`,
  borderRadius: 'var(--aicl-radius-md)',
  background: kind === 'primary' ? 'var(--aicl-accent)' : selected ? 'var(--aicl-accent-soft)' : 'var(--aicl-surface)',
  color: kind === 'primary' ? 'var(--aicl-accent-fg)' : kind === 'danger' ? 'var(--aicl-danger)' : 'var(--aicl-text)',
  font: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
});
const muted: CSSProperties = { color: 'var(--aicl-text-muted)', fontSize: 'var(--aicl-text-xs)' };
const input: CSSProperties = {
  padding: '5px 8px',
  border: '1px solid var(--aicl-border-strong)',
  borderRadius: 'var(--aicl-radius-md)',
  background: 'var(--aicl-surface-inset)',
  color: 'inherit',
  font: 'inherit',
  minWidth: 0,
};

const labelsOf = (q: Question, answer: HitlAnswer | undefined): string => {
  if (!answer || answer.kind !== 'question') return '';
  const chosen = answer.optionIds.map((id) => q.options.find((o) => o.id === id)?.label).filter(Boolean) as string[];
  if (answer.text?.trim()) chosen.push(`“${answer.text.trim()}”`);
  return chosen.join(', ');
};

/* ── Question card (chat and canvas) ──────────────────────────────── */

export function QuestionCard({ request, answer, fallbackQuestion }: { request?: Question; answer?: HitlAnswer; fallbackQuestion?: string }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);

  if (!request) {
    return (
      <div style={card}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <CircleHelp size={14} aria-hidden="true" />
          <strong>{fallbackQuestion ?? 'Question'}</strong>
        </div>
        <span style={muted}>{answer ? '' : 'Waiting…'}</span>
      </div>
    );
  }

  if (answer || sent) {
    const label = labelsOf(request, answer);
    return (
      <div style={card} data-hitl="answered">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <CircleHelp size={14} aria-hidden="true" />
          <span>{request.question}</span>
        </div>
        <span style={{ ...muted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Check size={12} aria-hidden="true" />
          {label ? `You chose: ${label}` : answer ? 'Dismissed' : 'Sending…'}
        </span>
      </div>
    );
  }

  const send = (optionIds: string[], extra?: string) => {
    setSent(true);
    void submit(request.id, { kind: 'question', optionIds, ...(extra?.trim() ? { text: extra.trim() } : {}) });
  };
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div style={card} data-hitl="question">
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600 }}>
        <CircleHelp size={14} aria-hidden="true" />
        {request.question}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--aicl-space-2)' }}>
        {request.options.map((o) => (
          <button
            key={o.id}
            type="button"
            title={o.description}
            style={btn('ghost', picked.includes(o.id))}
            onClick={() => (request.multiple ? toggle(o.id) : send([o.id]))}
          >
            {o.label}
            {o.description ? <span style={muted}>{o.description}</span> : null}
          </button>
        ))}
      </div>
      {request.allowText || request.multiple ? (
        <form
          style={{ display: 'flex', gap: 'var(--aicl-space-2)' }}
          onSubmit={(e) => {
            e.preventDefault();
            if (picked.length || text.trim()) send(picked, text);
          }}
        >
          {request.allowText ? (
            <input style={{ ...input, flex: 1 }} value={text} placeholder="Or type an answer…" onChange={(e) => setText(e.target.value)} />
          ) : null}
          <button type="submit" style={btn('primary')} disabled={!picked.length && !text.trim()}>
            Answer
          </button>
        </form>
      ) : null}
    </div>
  );
}

/** Chat rendering of an ask_user tool call (pending → options; answered → the choice). */
export function AskUserPart({ part }: PartProps) {
  const { pending, resolved } = useHitl();
  if (part.type !== 'tool-call') return null;
  const asked = (part.args as { question?: unknown } | undefined)?.question;
  const fallbackQuestion = typeof asked === 'string' ? asked : undefined;
  const live = pending.find((p): p is Question => p.kind === 'question' && p.toolCallId === part.toolCallId);
  if (live) return <QuestionCard request={live} />;
  const done = resolved.find((r) => r.request.kind === 'question' && r.request.toolCallId === part.toolCallId);
  if (done) return <QuestionCard request={done.request as Question} answer={done.answer} />;
  // Reloaded history: the request is gone; show the question and that it was handled.
  return <QuestionCard fallbackQuestion={fallbackQuestion} answer={part.status === 'running' ? undefined : { kind: 'question', optionIds: [] }} />;
}

/* ── Approvals strip ──────────────────────────────────────────────── */

function ApprovalCard({ request }: { request: Approval }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const decide = (approved: boolean) => {
    setBusy(true);
    void submit(request.id, { kind: 'approval', approved, ...(note.trim() ? { note: note.trim() } : {}) });
  };
  return (
    <div style={card} data-hitl="approval">
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <ShieldAlert size={14} aria-hidden="true" style={{ color: 'var(--aicl-warning)', flex: 'none' }} />
        <span style={muted}>{request.tool}</span>
        <strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{request.summary}</strong>
      </div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ ...muted, display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', width: 'fit-content' }}
      >
        <ChevronRight size={12} aria-hidden="true" style={{ transform: open ? 'rotate(90deg)' : undefined }} />
        Details
      </button>
      {open ? (
        <pre
          style={{
            margin: 0,
            padding: 'var(--aicl-space-2)',
            maxHeight: 160,
            overflow: 'auto',
            background: 'var(--aicl-code-bg)',
            color: 'var(--aicl-code-fg)',
            borderRadius: 'var(--aicl-radius-md)',
            fontFamily: 'var(--aicl-font-mono)',
            fontSize: 'var(--aicl-text-xs)',
          }}
        >
          {JSON.stringify(request.input, null, 2)}
        </pre>
      ) : null}
      <div style={{ display: 'flex', gap: 'var(--aicl-space-2)', alignItems: 'center' }}>
        <input style={{ ...input, flex: 1 }} value={note} placeholder="Note (optional)" aria-label="Note" onChange={(e) => setNote(e.target.value)} />
        <button type="button" style={btn('danger')} disabled={busy} onClick={() => decide(false)}>
          <X size={13} aria-hidden="true" />
          Deny
        </button>
        <button type="button" style={btn('primary')} disabled={busy} onClick={() => decide(true)}>
          <Check size={13} aria-hidden="true" />
          Approve
        </button>
      </div>
    </div>
  );
}

/** Pending approvals/questions for a session, rendered above its composer. */
export function HitlStrip({ sessionId }: { sessionId: string }) {
  const { pending } = useHitl();
  const mine = pending.filter((p) => p.sessionId === sessionId && (p.kind === 'approval' || !p.toolCallId));
  if (!mine.length) return null;
  const wrap = (children: ReactNode) => <div style={{ display: 'grid', gap: 'var(--aicl-space-2)', padding: 'var(--aicl-space-2) var(--aicl-space-3) 0' }}>{children}</div>;
  return wrap(mine.map((r) => (r.kind === 'approval' ? <ApprovalCard key={r.id} request={r} /> : <QuestionCard key={r.id} request={r} />)));
}

/* ── Canvas component ─────────────────────────────────────────────── */

/** The question for a canvas card: by id, else the latest pending one of any session. */
export function useQuestion(requestId?: string): { request?: Question; answer?: HitlAnswer } {
  const { pending, resolved } = useHitl();
  if (requestId) {
    const live = pending.find((p): p is Question => p.kind === 'question' && p.id === requestId);
    if (live) return { request: live };
    const done = resolved.find((r) => r.request.id === requestId && r.request.kind === 'question');
    return done ? { request: done.request as Question, answer: done.answer } : {};
  }
  const latest = [...pending].reverse().find((p): p is Question => p.kind === 'question');
  if (latest) return { request: latest };
  const last = [...resolved].reverse().find((r) => r.request.kind === 'question');
  return last ? { request: last.request as Question, answer: last.answer } : {};
}
