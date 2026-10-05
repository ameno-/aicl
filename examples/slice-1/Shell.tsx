import { useMemo, useRef, useState, type ComponentType } from 'react';
import {
  bucketByRecency,
  createRendererRegistry,
  createSessionStore,
  createToastQueue,
  type ArtifactPart,
  type ChatTransport,
  type Message,
  type SessionMeta,
  type StreamEvent,
} from '@aicl/core';
import {
  AlertDialog,
  ArtifactCard,
  CodeBlock,
  Composer,
  Dialog,
  Field,
  MentionMenu,
  PlanChecklist,
  SegmentedControl,
  Select,
  SessionList,
  SidebarNav,
  SlashMenu,
  Switch,
  TerminalOutput,
  ToastRegion,
  Transcript,
  UnknownPart,
  useChat,
  useReadable,
  type PartProps,
  type PlanItem,
} from '@aicl/react';
import { BookOpen, Ellipsis, PanelRight, Search, Settings, Share, SquarePen, X } from 'lucide-react';

/**
 * A composed agent workspace built only from library primitives, laid out the
 * way Devin and Manus converge: flat sidebar with sessions, a centred thread
 * with a card composer, and a work pane that opens from an artifact card.
 * The agent is a scripted transport so the page runs offline.
 */

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true });
  });

const PLAN: PlanItem[] = [
  { id: 'p1', label: 'Read the session store and its tests', status: 'done' },
  { id: 'p2', label: 'Find the double-submit path', status: 'done' },
  { id: 'p3', label: 'Patch the guard and add a regression test', status: 'running' },
  { id: 'p4', label: 'Run the full suite', status: 'pending' },
];

function scriptedAgent(): ChatTransport {
  return {
    async *send(req, signal) {
      const asked = req.messages[req.messages.length - 1]?.parts.find((p) => p.type === 'text');
      const topic = asked && asked.type === 'text' ? asked.text : 'that';
      const events: Array<[number, StreamEvent]> = [
        [300, { type: 'message-start', id: `a-${Date.now()}`, role: 'assistant' }],
        [100, { type: 'part-start', index: 0, part: { type: 'reasoning', text: '' } }],
        [500, { type: 'part-delta', index: 0, delta: 'The user wants this fixed end to end. ' }],
        [400, { type: 'part-delta', index: 0, delta: 'Start from the failing path, then patch and verify.' }],
        [100, { type: 'part-end', index: 0, part: { type: 'reasoning', text: 'The user wants this fixed end to end. Start from the failing path, then patch and verify.', durationMs: 4000 } }],
        [200, { type: 'part-start', index: 1, part: { type: 'tool-call', toolCallId: 't1', name: 'Reading packages/core/src/chat.ts', args: { path: 'packages/core/src/chat.ts' }, status: 'running' } }],
        [700, { type: 'part-end', index: 1, part: { type: 'tool-call', toolCallId: 't1', name: 'Read packages/core/src/chat.ts', args: { path: 'packages/core/src/chat.ts' }, status: 'success' } }],
        [200, { type: 'part-start', index: 2, part: { type: 'tool-call', toolCallId: 't2', name: 'Running npm test', args: { cmd: 'npm test' }, status: 'running' } }],
        [900, { type: 'part-end', index: 2, part: { type: 'tool-call', toolCallId: 't2', name: 'Ran npm test · 16 passed', args: { cmd: 'npm test' }, status: 'success' } }],
        [200, { type: 'part-start', index: 3, part: { type: 'text', text: '' } }],
      ];
      for (const [ms, event] of events) {
        await wait(ms, signal);
        if (signal.aborted) return;
        yield event;
      }
      const answer = `Done. I traced "${topic}" to the send guard: a second submit could slip through before the status flipped to submitted. I moved the status change ahead of the transport call and added a regression test. The patch is in the artifact below.`;
      for (const word of answer.split(/(\s+)/)) {
        await wait(25, signal);
        if (signal.aborted) return;
        yield { type: 'part-delta', index: 3, delta: word };
      }
      await wait(150, signal);
      yield { type: 'part-start', index: 4, part: { type: 'artifact', artifactId: 'patch', kind: 'diff', title: 'Fix double submit in ChatController', version: 2 } };
      yield { type: 'message-end', finishReason: 'stop' };
    },
  };
}

const now = Date.now();
const HISTORY: Message[] = [
  { id: 'u0', role: 'user', createdAt: now - 3_600_000, parts: [{ type: 'text', text: 'The send button sometimes submits twice on a slow network. Can you find out why?' }] },
  {
    id: 'a0',
    role: 'assistant',
    createdAt: now - 3_590_000,
    parts: [
      { type: 'reasoning', text: 'Look at the status machine first.', durationMs: 9000 },
      { type: 'tool-call', toolCallId: 'h1', name: 'Searched for "submitted"', args: { q: 'submitted' }, status: 'success' },
      { type: 'text', text: 'Here is the plan. I will keep it updated as I go.' },
      { type: 'data-plan', data: { title: 'Fix the double submit', items: PLAN } },
    ],
  },
];

const SESSIONS: SessionMeta[] = [
  { id: 's1', title: 'Fix the double submit', status: 'running', statusLine: 'Running tests · 3/4', updatedAt: now - 60_000 },
  { id: 's2', title: 'Draft the Q4 roadmap', preview: 'Here is a first outline with three themes…', updatedAt: now - 2 * 3_600_000 },
  { id: 's3', title: 'Why is the build slow?', status: 'awaiting-input', statusLine: 'Needs your approval', updatedAt: now - 26 * 3_600_000, unread: true },
  { id: 's4', title: 'Refactor the session store', statusLine: 'PR is ready · ⎇1', updatedAt: now - 3 * 86_400_000 },
  { id: 's5', title: 'Migrate to tldraw 5', status: 'error', statusLine: 'Failed: type errors', updatedAt: now - 9 * 86_400_000 },
];

const DIFF = `--- a/packages/core/src/chat.ts
+++ b/packages/core/src/chat.ts
@@ -112,9 +112,10 @@ export class ChatController {
   async send(draft: string | ChatDraft): Promise<void> {
-    if (this.busy) return;
-    this.appendToPath(userMessage(draft));
-    await this.run();
+    if (this.busy) return;
+    // Flip to submitted before awaiting anything: a second click in the
+    // same tick must see the guard.
+    this.store.update((s) => ({ ...s, status: 'submitted' }));
+    this.appendToPath(userMessage(draft));
+    await this.run();
   }`;

const COMMANDS = [{ id: 'plan', label: 'plan' }, { id: 'review', label: 'review' }, { id: 'test', label: 'test' }];
const PEOPLE = [{ id: 'a', label: 'ameno' }, { id: 'g', label: 'grace' }];
const MODELS = [
  { value: 'opus', label: 'Opus 5.5' },
  { value: 'sonnet', label: 'Sonnet 5.5' },
  { value: 'haiku', label: 'Haiku 4.5' },
];

function WorkPane({ artifact, onClose }: { artifact: ArtifactPart; onClose: () => void }) {
  const [tab, setTab] = useState('diff');
  return (
    <aside className="pane" aria-label="Work pane">
      <header className="pane-header">
        <div>
          <strong>{artifact.title}</strong>
          <span className="pane-meta">Agent workspace · v{artifact.version}</span>
        </div>
        <button type="button" className="icon-button" aria-label="Close pane" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="pane-tabs">
        <SegmentedControl
          ariaLabel="Pane view"
          value={tab}
          onValueChange={setTab}
          options={[
            { value: 'diff', label: 'Changes' },
            { value: 'terminal', label: 'Terminal' },
          ]}
        />
      </div>
      <div className="pane-body">
        {tab === 'diff' ? (
          <CodeBlock language="diff" content={DIFF} />
        ) : (
          <TerminalOutput
            lines={['$ npm test', '> @aicl/core test', '✔ stop() preserves partial output', '✔ rejects a second submit while a turn is in flight', '✔ double submit in the same tick is ignored', '# pass 17', '# fail 0']}
          />
        )}
      </div>
    </aside>
  );
}

export function Shell() {
  const transport = useMemo(scriptedAgent, []);
  const chat = useChat({ transport, initialMessages: HISTORY });
  const sessions = useMemo(() => createSessionStore(bucketByRecency(SESSIONS, Date.now())), []);
  const sessionState = useReadable(sessions);
  const toasts = useMemo(() => createToastQueue(), []);
  const [opened, setOpened] = useState<ArtifactPart | null>(null);
  const [model, setModel] = useState<string | undefined>('opus');
  const [draft, setDraft] = useState('');
  const [settings, setSettings] = useState(false);
  const [stream, setStream] = useState(true);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') ?? 'system');
  const [toDelete, setToDelete] = useState<SessionMeta | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const registry = useMemo(
    () =>
      createRendererRegistry<ComponentType<PartProps>>(
        {
          artifact: ((props: PartProps) =>
            props.part.type === 'artifact' ? <ArtifactCard {...props} part={props.part} onOpen={setOpened} /> : null) as ComponentType<PartProps>,
          'data-plan': ((props: PartProps) => {
            const data = props.part.type === 'data-plan' ? (props.part.data as { title: string; items: PlanItem[] }) : null;
            return data ? <PlanChecklist title={data.title} items={data.items} /> : null;
          }) as ComponentType<PartProps>,
        },
        UnknownPart,
      ),
    [],
  );

  const active = sessionState.activeId ?? 's1';

  return (
    <div className={opened ? 'shell shell-pane' : 'shell'} data-aicl-root="">
      <aside className="sidebar" aria-label="Sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">◐</span>
          <span>aicl</span>
        </div>
        <SidebarNav
          ariaLabel="Workspace"
          items={[
            { id: 'new', label: 'New task', icon: <SquarePen size={16} /> },
            { id: 'search', label: 'Search', icon: <Search size={16} /> },
            { id: 'library', label: 'Library', icon: <BookOpen size={16} /> },
          ]}
          onNavigate={(item) => toasts.push({ title: `${item.label} is a recipe, not a primitive`, description: 'Compose it from SessionSearch and Dialog.' })}
        />
        <div className="sidebar-sessions">
          <SessionList
            groups={sessionState.groups}
            byId={sessionState.byId}
            activeId={active}
            onActiveChange={sessions.setActive}
            onSelect={sessions.setActive}
            actions={['Delete']}
            onAction={(_a, meta) => setToDelete(meta)}
          />
        </div>
        <button type="button" className="sidebar-footer" onClick={() => setSettings(true)}>
          <Settings size={16} aria-hidden="true" />
          <span>Settings</span>
        </button>
      </aside>

      <main className="thread" aria-label="Conversation">
        <header className="thread-header">
          <h1>{sessionState.byId[active]?.title ?? 'New task'}</h1>
          <div className="thread-actions">
            <Select ariaLabel="Model" size="sm" value={model} options={MODELS} onValueChange={(v) => (setModel(v), toasts.push({ title: 'Model switched', description: `Now using ${MODELS.find((m) => m.value === v)?.label}`, variant: 'success' }))} />
            <button type="button" className="icon-button" aria-label="Share" onClick={() => toasts.push({ title: 'Link copied', variant: 'success' })}>
              <Share size={16} aria-hidden="true" />
            </button>
            <button type="button" className="icon-button" aria-label="Toggle work pane" onClick={() => setOpened((o) => (o ? null : { type: 'artifact', artifactId: 'patch', kind: 'diff', title: 'Fix double submit in ChatController', version: 2 }))}>
              <PanelRight size={16} aria-hidden="true" />
            </button>
            <button type="button" className="icon-button" aria-label="More">
              <Ellipsis size={16} aria-hidden="true" />
            </button>
          </div>
        </header>
        <Transcript messages={chat.messages} status={chat.status} streamingId={chat.streamingId} registry={registry} />
        <div className="thread-composer">
          <SlashMenu inputRef={inputRef} value={draft} onValueChange={setDraft} items={COMMANDS} getKey={(c) => c.id} getLabel={(c) => c.label} onSelect={() => {}} />
          <MentionMenu inputRef={inputRef} value={draft} onValueChange={setDraft} items={PEOPLE} getKey={(p) => p.id} getLabel={(p) => p.label} onSelect={() => {}} />
          <Composer
            status={chat.status}
            value={draft}
            onChange={setDraft}
            inputRef={inputRef}
            placeholder="Ask the agent to build, fix, or explain…"
            onAttach={() => toasts.push({ title: 'Attach opens the file picker', description: 'Wrap the composer in AttachmentDropzone.' })}
            onSubmit={(text) => void chat.send(text)}
            onStop={chat.stop}
          />
        </div>
      </main>

      {opened ? <WorkPane artifact={opened} onClose={() => setOpened(null)} /> : null}

      <Dialog open={settings} onOpenChange={(o) => setSettings(o)}>
        <Dialog.Title>Settings</Dialog.Title>
        <Dialog.Description>Applies to every chat in this workspace.</Dialog.Description>
        <div className="settings-grid">
          <Field label="Default model" description="Used for new tasks" saveMode="auto" saveState="saved">
            <Select value={model} options={MODELS} onValueChange={setModel} />
          </Field>
          <Field label="Theme">
            <SegmentedControl
              ariaLabel="Theme"
              value={theme}
              onValueChange={(t) => {
                setTheme(t);
                if (t === 'system') document.documentElement.removeAttribute('data-theme');
                else document.documentElement.setAttribute('data-theme', t);
              }}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
          </Field>
          <Switch checked={stream} onCheckedChange={setStream} label="Show the agent's reasoning" />
        </div>
        <Dialog.Close />
      </Dialog>

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete “${toDelete?.title ?? ''}”?`}
        variant="danger"
        consequence="This permanently deletes the session and its messages."
        onConfirm={() => {
          if (toDelete) sessions.remove(toDelete.id);
          toasts.push({ title: 'Session deleted', variant: 'success' });
          setToDelete(null);
        }}
      />

      <ToastRegion queue={toasts} />
    </div>
  );
}
