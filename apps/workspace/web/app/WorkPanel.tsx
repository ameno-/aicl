/**
 * The work panel beside the conversation (kit.layout.workPanel):
 *   tabs      Devin: Terminal / Files / Preview / Plan tabs
 *   computer  Manus: "<Agent>'s computer" showing the current step, with a scrubber
 *   preview   Lovable: a big preview of what is being built
 *   board     Cofounder: the plan as a board
 * Resizable (drag the left edge), collapsible, and opened by the agent starting work.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AnimatedPlan, LiveTerminal, type PlanStep } from '@aicl/fx';
import type { ToolCallPart } from '@aicl/core';
import { Check, ChevronLeft, FileText, Folder, GitCompare, Globe, ListChecks, Loader, Monitor, Terminal as TerminalIcon, TriangleAlert, X } from 'lucide-react';
import type { ProviderKit } from '../../shared/kits.ts';
import { usePlan, useTerminal } from '../agentic/liveData.ts';
import { AppletHost, useApplets } from '../applets/index.tsx';
import { useSessionChat } from '../sessionsApi.ts';
import { setPrefs, usePrefs } from './prefs.ts';
import { BrowserPane, ChangesPane, TerminalsPane } from './SurfacePanes.tsx';
import { SurfaceView } from '../surfaces/index.tsx';
import { Tree } from '../files/index.ts';

type TabId = ProviderKit['layout']['workTabs'][number];

const TAB_META: Record<TabId, { label: string; icon: ReactNode }> = {
  plan: { label: 'Plan', icon: <ListChecks size={14} aria-hidden="true" /> },
  terminal: { label: 'Terminal', icon: <TerminalIcon size={14} aria-hidden="true" /> },
  files: { label: 'Files', icon: <Folder size={14} aria-hidden="true" /> },
  preview: { label: 'Preview', icon: <Monitor size={14} aria-hidden="true" /> },
  browser: { label: 'Browser', icon: <Globe size={14} aria-hidden="true" /> },
  changes: { label: 'Changes', icon: <GitCompare size={14} aria-hidden="true" /> },
};

const MIN_WIDTH = 320;

/* ── Data ─────────────────────────────────────────────────────────── */

/** Every tool call of the conversation, in order: the "steps" the agent took. */
export function useSteps(sessionId: string): ToolCallPart[] {
  const { messages } = useSessionChat(sessionId);
  return useMemo(
    () => messages.flatMap((m) => (m.role === 'assistant' ? m.parts.filter((p): p is ToolCallPart => p.type === 'tool-call') : [])),
    [messages],
  );
}

const argOf = (call: ToolCallPart, key: string): string | undefined => {
  const v = (call.args as Record<string, unknown> | undefined)?.[key];
  return typeof v === 'string' ? v : undefined;
};

/* ── Panes ────────────────────────────────────────────────────────── */

const Empty = ({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) => (
  <div className="wp-empty">
    {icon}
    <p className="wp-empty-title">{title}</p>
    {hint ? <p className="wp-empty-hint">{hint}</p> : null}
  </div>
);

export function TerminalPane({ sessionId, toolCallId }: { sessionId: string; toolCallId?: string }) {
  const term = useTerminal(sessionId, toolCallId);
  if (!term) return <Empty icon={<TerminalIcon size={22} aria-hidden="true" />} title="No commands yet" hint="Shell commands the agent runs appear here, live." />;
  const lines = term.partial ? [...term.lines, term.partial] : term.lines;
  return (
    <div className="wp-terminal" data-pane="terminal" data-done={term.done || undefined}>
      <LiveTerminal lines={lines} running={!term.done} command={term.command} {...(term.exitCode !== undefined ? { exitCode: term.exitCode } : term.done ? { exitCode: 0 } : {})} />
    </div>
  );
}

const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;

function FileViewer({ path, content }: { path: string; content?: string }) {
  const [state, setState] = useState<{ text?: string; error?: string; truncated?: boolean } | null>(null);
  useEffect(() => {
    if (content !== undefined || IMAGE.test(path)) return;
    let live = true;
    setState(null);
    void fetch(`/api/file/text?path=${encodeURIComponent(path)}`)
      .then(async (r) => {
        const body = (await r.json()) as { text?: string; truncated?: boolean; message?: string };
        if (!r.ok) throw new Error(body.message ?? `HTTP ${r.status}`);
        if (live) setState({ text: body.text ?? '', truncated: body.truncated ?? false });
      })
      .catch((e: unknown) => live && setState({ error: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
    };
  }, [path, content]);
  if (IMAGE.test(path)) return <img className="wp-image" alt={path} src={`/api/file?path=${encodeURIComponent(path)}`} />;
  if (content !== undefined) return <pre className="wp-file" data-pane="file-content">{content}</pre>;
  if (!state) return <p className="wp-note">Loading…</p>;
  if (state.error) return <p className="wp-note">Cannot show this file: {state.error}</p>;
  return (
    <pre className="wp-file" data-pane="file-content">
      {state.text}
      {state.truncated ? '\n… (truncated)' : ''}
    </pre>
  );
}

/** The workspace tree (@pierre/trees); a picked file opens as a live file surface (CodeMirror, pinnable). */
export function FilesPane({ refreshKey }: { refreshKey: unknown }) {
  const [file, setFile] = useState<string | null>(null);
  const open = (path: string) => {
    setFile(path);
    void fetch('/api/surfaces/file/open', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path }) });
  };
  return (
    <div className="wp-files" data-pane="files">
      {file ? (
        <>
          <button type="button" className="wp-back" onClick={() => setFile(null)}>
            <ChevronLeft size={14} aria-hidden="true" /> {file}
          </button>
          <div className="wp-surface-body" data-pane="file-content">
            <SurfaceView kind="file" id={file} variant="panel" />
          </div>
        </>
      ) : (
        <Tree onOpen={open} refreshKey={refreshKey} />
      )}
    </div>
  );
}

/** The newest built applet (views first), with a picker when there are several. */
export function PreviewPane({ kit }: { kit: ProviderKit }) {
  const applets = useApplets();
  const ranked = useMemo(
    () => [...applets].filter((a) => !a.error).sort((a, b) => Number(b.kind === 'view') - Number(a.kind === 'view') || (b.builtAt ?? 0) - (a.builtAt ?? 0)),
    [applets],
  );
  const [pick, setPick] = useState<string | null>(null);
  const shown = ranked.find((a) => a.id === pick) ?? ranked[0];
  if (!shown) {
    return <Empty icon={<Monitor size={22} aria-hidden="true" />} title="Nothing to preview yet" hint={`Ask ${kit.vocabulary.agent} to build a widget or a view; it shows up here as soon as it builds.`} />;
  }
  return (
    <div className="wp-preview" data-pane="preview" data-applet={shown.id}>
      {ranked.length > 1 ? (
        <select aria-label="Previewed app" value={shown.id} onChange={(e) => setPick(e.target.value)}>
          {ranked.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      ) : null}
      <div className="wp-preview-frame">
        <AppletHost id={shown.id} />
      </div>
    </div>
  );
}

const planSteps = (steps: Array<{ id: string; label: string; status: PlanStep['status'] }>): PlanStep[] => steps.map((s) => ({ id: s.id, label: s.label, status: s.status }));

export function PlanPane({ sessionId, board }: { sessionId: string; board: boolean }) {
  const plan = usePlan(sessionId);
  const steps = useSteps(sessionId);
  if (!plan?.steps.length) {
    return board ? (
      <Timeline steps={steps} />
    ) : (
      <Empty icon={<ListChecks size={22} aria-hidden="true" />} title="No plan yet" hint="When the agent plans its work, the steps tick off here." />
    );
  }
  if (!board) return <AnimatedPlan steps={planSteps(plan.steps)} title={plan.title ?? 'Plan'} className="wp-plan" />;
  const columns: Array<{ id: PlanStep['status'][]; label: string }> = [
    { id: ['pending'], label: 'To do' },
    { id: ['running'], label: 'In progress' },
    { id: ['done'], label: 'Done' },
    { id: ['error'], label: 'Blocked' },
  ];
  return (
    <div className="wp-board" data-pane="board">
      <h3 className="wp-board-title">{plan.title ?? 'Plan'}</h3>
      <div className="wp-columns">
        {columns.map((c) => {
          const cards = plan.steps.filter((s) => c.id.includes(s.status));
          if (!cards.length && c.id[0] === 'error') return null;
          return (
            <section key={c.label} className="wp-column" aria-label={c.label} data-column={c.id[0]}>
              <h4>
                {c.label} <small>{cards.length}</small>
              </h4>
              <AnimatePresence initial={false}>
                {cards.map((s) => (
                  <motion.div key={s.id} layout layoutId={`card-${s.id}`} className="wp-card" data-status={s.status} transition={{ type: 'spring', stiffness: 220, damping: 28 }}>
                    {s.status === 'done' ? <Check size={13} aria-hidden="true" /> : s.status === 'running' ? <Loader size={13} className="wp-spin" aria-hidden="true" /> : s.status === 'error' ? <TriangleAlert size={13} aria-hidden="true" /> : null}
                    <span>{s.label}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </section>
          );
        })}
      </div>
      <Timeline steps={steps} />
    </div>
  );
}

const stepLabel = (c: ToolCallPart): string => {
  const detail = argOf(c, 'command') ?? argOf(c, 'path') ?? argOf(c, 'title') ?? '';
  return detail ? `${c.name} · ${detail.length > 60 ? `${detail.slice(0, 59)}…` : detail}` : c.name;
};

function Timeline({ steps }: { steps: ToolCallPart[] }) {
  if (!steps.length) return <Empty icon={<ListChecks size={22} aria-hidden="true" />} title="Nothing has run yet" hint="Each action the agent takes is listed here." />;
  return (
    <ol className="wp-timeline" aria-label="Actions">
      {steps.map((s) => (
        <li key={s.toolCallId} data-status={s.status}>
          <span className="wp-tl-dot" aria-hidden="true" />
          <span className="wp-tl-text">{stepLabel(s)}</span>
        </li>
      ))}
    </ol>
  );
}

/** Manus: the current step, live; drag the scrubber to look back. */
export function ComputerPane({ sessionId, kit }: { sessionId: string; kit: ProviderKit }) {
  const steps = useSteps(sessionId);
  const [pinned, setPinned] = useState<number | null>(null);
  const live = pinned === null || pinned >= steps.length - 1;
  const index = live ? steps.length - 1 : pinned;
  const step = steps[index];
  useEffect(() => setPinned(null), [sessionId]);

  if (!step) {
    return <Empty icon={<Monitor size={22} aria-hidden="true" />} title={`${kit.vocabulary.agent}'s computer is idle`} hint="When it starts working you can watch each step here." />;
  }
  const path = argOf(step, 'path');
  const body =
    step.name === 'bash' ? (
      <TerminalPane key={step.toolCallId} sessionId={sessionId} toolCallId={step.toolCallId} />
    ) : step.name === 'plan_update' ? (
      <PlanPane sessionId={sessionId} board={false} />
    ) : path ? (
      <div className="wp-files">
        <p className="wp-note">
          <FileText size={14} aria-hidden="true" /> {path}
        </p>
        <FileViewer key={step.toolCallId} path={path} {...(step.name === 'write' && argOf(step, 'content') !== undefined ? { content: argOf(step, 'content')! } : {})} />
      </div>
    ) : (
      <pre className="wp-file">{step.argsText || JSON.stringify(step.args, null, 2)}</pre>
    );
  return (
    <div className="wp-computer" data-pane="computer" data-live={live || undefined}>
      <div className="wp-screen" data-step={step.name}>
        {body}
      </div>
      <div className="wp-scrub">
        <input
          type="range"
          aria-label="Step"
          min={0}
          max={Math.max(steps.length - 1, 0)}
          value={index}
          disabled={steps.length < 2}
          onChange={(e) => setPinned(Number(e.target.value))}
        />
        <span className="wp-scrub-label">
          {step.status === 'running' || step.status === 'pending' ? <Loader size={12} className="wp-spin" aria-hidden="true" /> : null}
          Step {index + 1} of {steps.length} · {stepLabel(step)}
        </span>
        <button type="button" className="wp-live" disabled={live} onClick={() => setPinned(null)}>
          {live ? 'Live' : 'Jump to live'}
        </button>
      </div>
    </div>
  );
}

/* ── The panel ────────────────────────────────────────────────────── */

const titles: Record<'tabs' | 'computer' | 'preview' | 'board', (kit: ProviderKit) => string> = {
  tabs: () => 'Workbench',
  computer: (kit) => `${kit.vocabulary.agent}'s computer`,
  preview: () => 'Preview',
  board: () => 'Board',
};

export function WorkPanel({ kit, sessionId, busy, visible }: { kit: ProviderKit; sessionId: string; busy: boolean; visible: boolean }) {
  const prefs = usePrefs();
  const type = kit.layout.workPanel;
  // Plan only matters while a plan is in effect: no plan, no tab (the Tasks overlay covers the rest).
  const livePlan = usePlan(sessionId);
  const planSteps = livePlan?.steps ?? [];
  const planDone = planSteps.filter((s) => s.status === 'done').length;
  const hasPlan = planSteps.length > 0;
  // Stable identity: effects below depend on it, and a fresh array each render loops them.
  const tabs = useMemo(() => kit.layout.workTabs.filter((id) => id !== 'plan' || hasPlan || type === 'board'), [kit.layout.workTabs, hasPlan, type]);
  const picked = useRef(false);
  const terminal = useTerminal(sessionId);
  const [width, setWidth] = useState<number | null>(null);
  const [filesTick, setFilesTick] = useState(0);
  const steps = useSteps(sessionId);

  const tab: TabId = (tabs.includes(prefs.workTab as TabId) ? prefs.workTab : tabs[0]) as TabId;
  const choose = (id: string) => {
    picked.current = true;
    setPrefs({ workTab: id });
  };

  // A new run: the user's last tab choice no longer pins the view.
  useEffect(() => {
    if (busy) picked.current = false;
    else setFilesTick((t) => t + 1);
  }, [busy]);
  // Watch it happen: when a shell command starts, show the terminal (unless the user chose a tab this run).
  useEffect(() => {
    if (terminal?.command && !terminal.done && busy && !picked.current && tabs.includes('terminal') && type !== 'computer') setPrefs({ workTab: 'terminal' });
  }, [terminal?.toolCallId, terminal?.command, terminal?.done, busy, tabs, type]);
  // Likewise, a finished app shows up in the preview.
  const appletCount = useApplets().length;
  useEffect(() => {
    if (busy && !picked.current && appletCount && tabs.includes('preview') && type !== 'computer') setPrefs({ workTab: 'preview' });
  }, [appletCount]); // eslint-disable-line react-hooks/exhaustive-deps

  if (type === 'none') return null;

  const auto = type === 'preview' && prefs.workPanelWidth === 0;
  const px = width ?? (prefs.workPanelWidth || 460);

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const parent = e.currentTarget.parentElement?.parentElement;
    const room = (parent?.clientWidth ?? 1200) - MIN_WIDTH;
    const start = e.currentTarget.parentElement?.getBoundingClientRect().width ?? px;
    const from = e.clientX;
    let latest = start;
    const move = (m: PointerEvent) => {
      latest = Math.round(Math.min(Math.max(start + (from - m.clientX), MIN_WIDTH), Math.max(room, MIN_WIDTH)));
      setWidth(latest);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setPrefs({ workPanelWidth: latest });
      setWidth(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const content: ReactNode =
    type === 'computer' ? (
      <ComputerPane sessionId={sessionId} kit={kit} />
    ) : tab === 'terminal' ? (
      <TerminalsPane sessionId={sessionId} />
    ) : tab === 'browser' ? (
      <BrowserPane sessionId={sessionId} />
    ) : tab === 'changes' ? (
      <ChangesPane sessionId={sessionId} />
    ) : tab === 'files' ? (
      <FilesPane refreshKey={`${filesTick}:${steps.length}`} />
    ) : tab === 'plan' ? (
      <PlanPane sessionId={sessionId} board={type === 'board'} />
    ) : (
      <PreviewPane kit={kit} />
    );

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.aside
          key="panel"
          className="work-panel"
          aria-label="Work panel"
          data-panel={type}
          data-wp-tab={type === 'computer' ? undefined : tab}
          data-auto={auto || undefined}
          initial={auto ? { opacity: 0, x: 40 } : { width: 0, opacity: 0 }}
          animate={auto ? { opacity: 1, x: 0 } : { width: px, opacity: 1 }}
          exit={auto ? { opacity: 0, x: 40 } : { width: 0, opacity: 0 }}
          transition={width !== null ? { duration: 0 } : { type: 'spring', stiffness: kit.motion.spring.stiffness, damping: kit.motion.spring.damping }}
        >
          <div className="wp-inner" style={auto ? undefined : { width: px }}>
            <div className="wp-resize" role="separator" aria-orientation="vertical" aria-label="Resize work panel" tabIndex={0} onPointerDown={startResize} />
            <header className="wp-head" data-type={type}>
              {type === 'computer' ? (
                <h2 className="wp-title">
                  {busy ? <span className="s-dot" data-status="running" aria-hidden="true" /> : null}
                  {titles[type](kit)}
                </h2>
              ) : (
                <nav className="wp-tabs" role="tablist" aria-label="Work panel tabs">
                  {tabs.map((id) => (
                    <button key={id} type="button" role="tab" className="wp-tab" aria-selected={tab === id} data-tab={id} onClick={() => choose(id)}>
                      {TAB_META[id].icon}
                      <span>{TAB_META[id].label}</span>
                      {id === 'plan' && planSteps.length ? <small className="wp-tab-count">{`${planDone}/${planSteps.length}`}</small> : null}
                    </button>
                  ))}
                  {busy ? <span className="s-dot wp-busy" data-status="running" role="img" aria-label="Working" /> : null}
                </nav>
              )}
              <button type="button" className="icon-button wp-close" aria-label="Hide work panel" title="Hide work panel" onClick={() => setPrefs({ workPanelOpen: false })}>
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <div className="wp-body" role={type === 'computer' ? undefined : 'tabpanel'}>
              {content}
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
