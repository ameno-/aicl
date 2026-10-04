import { useMemo, useRef, useState, type ReactNode } from 'react';
import { bucketByRecency, createSessionStore, createToastQueue, type Attachment, type SessionMeta } from '@aicl/core';
import {
  AlertDialog,
  AttachmentChip,
  AttachmentDropzone,
  Composer,
  Dialog,
  Drawer,
  Field,
  MentionMenu,
  SegmentedControl,
  Select,
  SessionList,
  SessionSearch,
  SidebarNav,
  SlashMenu,
  SuggestionChips,
  Switch,
  ToastRegion,
  useAttachmentPicker,
  useReadable,
} from '@aicl/react';

/**
 * Interactive kitchen sink for the blueprint inventory beyond slice 1:
 * composer surface (§4.12), sessions (§4.14–§4.17), platform (§4.18–§4.20).
 */

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} data-feature={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

const COMMANDS = [
  { id: 'summarize', label: 'summarize' },
  { id: 'explain', label: 'explain' },
  { id: 'translate', label: 'translate' },
  { id: 'deploy', label: 'deploy', disabled: true },
];
const PEOPLE = [
  { id: 'u1', label: 'ameno' },
  { id: 'u2', label: 'alexey' },
  { id: 'u3', label: 'grace' },
];

function ComposerWithMenus() {
  const [value, setValue] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  return (
    <div className="composer-host">
      <SlashMenu
        inputRef={inputRef}
        value={value}
        onValueChange={setValue}
        items={COMMANDS}
        getKey={(c) => c.id}
        getLabel={(c) => c.label}
        isDisabled={(c) => !!c.disabled}
        onSelect={(c) => setLog((l) => [...l, `/${c.label}`])}
      />
      <MentionMenu
        inputRef={inputRef}
        value={value}
        onValueChange={setValue}
        items={PEOPLE}
        getKey={(p) => p.id}
        getLabel={(p) => p.label}
        onSelect={(_p, r) => setLog((l) => [...l, `mention ${JSON.stringify(r.mentioned)}`])}
      />
      <Composer
        status="idle"
        value={value}
        onChange={setValue}
        inputRef={inputRef}
        placeholder="Type / for commands or @ to mention"
        onSubmit={(text) => setLog((l) => [...l, `sent: ${text}`])}
      />
      <output className="demo-log" data-testid="menu-log">
        {log.join(' · ') || 'Nothing yet'}
      </output>
    </div>
  );
}

function DropzoneDemo() {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [note, setNote] = useState('Drop, paste, or pick an image or markdown file (max 2 MB).');
  return (
    <AttachmentDropzone
      accept="image/*,.md"
      maxSizeBytes={2 * 1024 * 1024}
      onFiles={(list, origin) => {
        setNote(`${list.length} file(s) via ${origin}`);
        setFiles((prev) => [
          ...prev,
          ...list.map((f, i) => ({
            id: `${Date.now()}-${i}`,
            name: f.name,
            size: f.size,
            mediaType: f.type || 'application/octet-stream',
            status: 'ready' as const,
            ...(f.type.startsWith('image/') ? { previewUrl: URL.createObjectURL(f) } : {}),
          })),
        ]);
      }}
      onReject={(reason, list) => setNote(`Rejected (${reason}): ${list.map((f) => f.name).join(', ')}`)}
    >
      <DropzoneInner files={files} note={note} onRemove={(id) => setFiles((f) => f.filter((x) => x.id !== id))} />
    </AttachmentDropzone>
  );
}

function DropzoneInner({ files, note, onRemove }: { files: Attachment[]; note: string; onRemove: (id: string) => void }) {
  const { openPicker } = useAttachmentPicker();
  return (
    <div className="dropzone-body">
      <p className="note">{note}</p>
      <Composer status="idle" attachments={files} onRemoveAttachment={onRemove} onAttach={openPicker} onSubmit={() => {}} />
    </div>
  );
}

const now = Date.now();
const hour = 3_600_000;
const SESSIONS: SessionMeta[] = [
  { id: 's1', title: 'Fix the login redirect loop', status: 'running', statusLine: 'Running tests · 3/7', updatedAt: now - 5 * 60_000, unread: true },
  { id: 's2', title: 'Draft the Q4 roadmap', preview: 'Here is a first outline with three themes…', updatedAt: now - 2 * hour },
  { id: 's3', title: 'Why is the build slow?', status: 'awaiting-input', statusLine: 'Needs your approval', updatedAt: now - 26 * hour, starred: true },
  { id: 's4', title: 'Refactor the session store', updatedAt: now - 3 * 24 * hour },
  { id: 's5', title: 'Migrate to tldraw 5', status: 'error', statusLine: 'Failed: type errors', updatedAt: now - 12 * 24 * hour },
  { id: 's6', title: 'Old experiment', updatedAt: now - 60 * 24 * hour, archivedAt: now - 40 * 24 * hour },
];

function SessionsDemo() {
  const store = useMemo(() => createSessionStore(bucketByRecency(SESSIONS, Date.now())), []);
  const state = useReadable(store);
  const [selected, setSelected] = useState<string>('none');
  return (
    <div className="split-demo">
      <div className="panel" style={{ height: 360 }}>
        <SessionList
          groups={state.groups}
          byId={state.byId}
          activeId={state.activeId}
          onActiveChange={store.setActive}
          onSelect={(id) => setSelected(id)}
          actions={['Rename', 'Archive']}
          onAction={(a, m) => setSelected(`${a} → ${m.title}`)}
          header={<button type="button" className="demo-button" onClick={() => store.upsert({ id: `n${Date.now()}`, title: 'New session', updatedAt: Date.now() })}>+ New session</button>}
        />
      </div>
      <div className="panel" style={{ height: 360 }}>
        <SessionList groups={[]} byId={{}} loading />
      </div>
      <p className="note">Selected: {selected}</p>
    </div>
  );
}

function SearchDemo() {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState('none');
  const byId = Object.fromEntries(SESSIONS.map((s) => [s.id, s]));
  const hits = SESSIONS.filter((s) => s.title.toLowerCase().includes(q.toLowerCase()));
  const groups = q ? [{ id: 'results', label: 'Results', ids: hits.map((s) => s.id) }] : [{ id: 'recent', label: 'Recent', ids: SESSIONS.slice(0, 3).map((s) => s.id) }];
  return (
    <div className="panel" style={{ height: 300 }}>
      <SessionSearch value={q} onChange={setQ} groups={groups} byId={byId} onSelect={(id) => setPicked(byId[id]!.title)} placeholder="Search sessions" />
      <p className="note">Opened: {picked}</p>
    </div>
  );
}

function NavDemo() {
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState('chat');
  const items = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'tasks', label: 'Tasks', icon: '✅', badge: '3' },
    { id: 'library', label: 'Library', icon: '📚' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ].map((i) => ({ ...i, active: i.id === active }));
  return (
    <div className="panel nav-panel" data-collapsed={collapsed || undefined}>
      <SidebarNav items={items} collapsed={collapsed} onCollapsedChange={setCollapsed} onNavigate={(i) => setActive(i.id)} />
    </div>
  );
}

function OverlaysDemo() {
  const [dialog, setDialog] = useState(false);
  const [alert, setAlert] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [confirm, setConfirm] = useState<'idle' | 'loading' | 'done'>('idle');
  const [last, setLast] = useState('none');
  const [name, setName] = useState('My workspace');
  return (
    <div className="row">
      <button type="button" className="demo-button" onClick={() => setDialog(true)}>Open dialog</button>
      <button type="button" className="demo-button" onClick={() => setAlert(true)}>Delete session…</button>
      <button type="button" className="demo-button" onClick={() => setDrawer(true)}>Open drawer</button>
      <span className="note">Last dismiss: {last}</span>

      <Dialog open={dialog} onOpenChange={(o, r) => (setDialog(o), setLast(r))} dirty={name !== 'My workspace'}>
        <Dialog.Title>Workspace settings</Dialog.Title>
        <Dialog.Description>Changes apply to every chat in this workspace.</Dialog.Description>
        <Field label="Name" description="Shown in the sidebar" dirty={name !== 'My workspace'}>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Dialog.Close />
      </Dialog>

      <AlertDialog
        open={alert}
        onOpenChange={(o, r) => (setAlert(o), setLast(r), setConfirm('idle'))}
        title="Delete “Draft the Q4 roadmap”?"
        variant="danger"
        consequence="This permanently deletes the session and its 42 messages. It cannot be undone."
        confirmationValue="delete"
        confirmStatus={confirm}
        onConfirm={() => {
          setConfirm('loading');
          setTimeout(() => (setConfirm('done'), setAlert(false), setLast('confirmed')), 800);
        }}
      />

      <Drawer open={drawer} side="right" onOpenChange={(o, r) => (setDrawer(o), setLast(r))}>
        <Dialog.Title>Run details</Dialog.Title>
        <Dialog.Description>Swipe right or press Escape to close.</Dialog.Description>
        <Dialog.Close />
      </Drawer>
    </div>
  );
}

function ToastDemo() {
  const queue = useMemo(() => createToastQueue(), []);
  return (
    <div className="row">
      <button type="button" className="demo-button" onClick={() => queue.push({ title: 'Saved', variant: 'success' })}>Success toast</button>
      <button type="button" className="demo-button" onClick={() => queue.push({ title: 'Model switched', description: 'Now using Opus 5.5' })}>Info toast</button>
      <button
        type="button"
        className="demo-button"
        onClick={() => queue.push({ title: 'Stream interrupted', description: 'The connection dropped mid-answer.', variant: 'error', action: { label: 'Retry', onAction: () => queue.push({ title: 'Retrying…' }) } })}
      >
        Error with action
      </button>
      <ToastRegion queue={queue} />
    </div>
  );
}

const MODELS = [
  { value: 'opus', label: 'Opus 5.5', description: 'Most capable' },
  { value: 'sonnet', label: 'Sonnet 5.5', description: 'Balanced' },
  { value: 'haiku', label: 'Haiku 4.5', description: 'Fastest' },
  { value: 'legacy', label: 'Legacy 3', description: 'Retired', disabled: true },
];

function FormsDemo() {
  const [model, setModel] = useState<string | undefined>('sonnet');
  const [on, setOn] = useState(true);
  const [flaky, setFlaky] = useState(false);
  const [flakyStatus, setFlakyStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [layout, setLayout] = useState('list');
  return (
    <div className="form-grid">
      <Field label="Model" description="Used for new chats" saveMode="auto" saveState="saved">
        <Select value={model} options={MODELS} onValueChange={setModel} />
      </Field>
      <Switch checked={on} onCheckedChange={setOn} label="Stream reasoning" />
      <Switch
        checked={flaky}
        status={flakyStatus}
        label="Optimistic toggle that fails (rolls back)"
        onCheckedChange={(next) => {
          setFlaky(next);
          setFlakyStatus('saving');
          setTimeout(() => (setFlaky(!next), setFlakyStatus('error')), 700);
        }}
      />
      <SegmentedControl
        ariaLabel="Layout"
        value={layout}
        onValueChange={setLayout}
        options={[
          { value: 'list', label: 'List' },
          { value: 'grid', label: 'Grid' },
          { value: 'board', label: 'Board' },
        ]}
      />
      <Field label="API base URL" error="Must start with https://" required>
        <input defaultValue="http://localhost" />
      </Field>
    </div>
  );
}

export function Components() {
  return (
    <main className="gallery components" data-aicl-root="">
      <h1>Components</h1>
      <Section id="trigger-menus" title="Slash and mention menus">
        <ComposerWithMenus />
      </Section>
      <Section id="suggestion-chips" title="Suggestion chips">
        <SuggestionChips
          suggestions={[
            { id: '1', label: 'Make it shorter' },
            { id: '2', label: 'Add tests' },
            { id: '3', label: 'Explain the tradeoffs' },
          ]}
          onSelect={() => {}}
        />
      </Section>
      <Section id="attachment-chips" title="Attachment chips">
        <div className="row">
          <AttachmentChip attachment={{ id: 'a', name: 'roadmap-q4.pdf', mediaType: 'application/pdf', status: 'ready', size: 482_000 }} onRemove={() => {}} />
          <AttachmentChip attachment={{ id: 'b', name: 'screenshot.png', mediaType: 'image/png', status: 'uploading', progress: 0.4 }} onRemove={() => {}} />
          <AttachmentChip attachment={{ id: 'c', name: 'huge-dataset.csv', mediaType: 'text/csv', status: 'error' }} onRetry={() => {}} onRemove={() => {}} />
        </div>
      </Section>
      <Section id="dropzone" title="Attachment dropzone">
        <DropzoneDemo />
      </Section>
      <Section id="session-list" title="Session list">
        <SessionsDemo />
      </Section>
      <Section id="session-search" title="Session search">
        <SearchDemo />
      </Section>
      <Section id="sidebar-nav" title="Sidebar nav">
        <NavDemo />
      </Section>
      <Section id="overlays" title="Dialog, alert dialog, drawer">
        <OverlaysDemo />
      </Section>
      <Section id="toasts" title="Toasts">
        <ToastDemo />
      </Section>
      <Section id="forms" title="Field, switch, select, segmented control">
        <FormsDemo />
      </Section>
    </main>
  );
}
