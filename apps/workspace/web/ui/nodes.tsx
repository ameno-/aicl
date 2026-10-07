import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { Attachment, Message, SessionMeta, ToastState } from '@aicl/core';
import { createRendererRegistry } from '@aicl/core';
import {
  ArtifactCard,
  AttachmentChip,
  CodeBlock,
  Composer,
  SessionList,
  SidebarNav,
  SuggestionChips,
  TerminalOutput,
  Toast,
  type PartProps,
  type PlanItem,
  type SidebarNavItem,
} from '@aicl/react';
import { MarkdownTextPart } from '@aicl/react/markdown';
import { AnimatedPlan } from '@aicl/fx';
import { kitForPreset, type ProviderKit } from '../../shared/kits.ts';
import { KitComposer } from '../kits/composer.tsx';
import { AssistantHeader, AssistantText, KitActions, KitRenderContext, ScreenReasoning, ScreenStep, UserTurn, WorkGroup } from '../kits/parts.tsx';
import type { WorkItem } from '../kits/model.ts';
import type { ComponentType } from 'react';
import {
  Bell,
  BookOpen,
  Bot,
  Calendar,
  Check,
  ChevronDown,
  Circle,
  Clock,
  Code,
  Download,
  FileText,
  Folder,
  Globe,
  History,
  House,
  Image as ImageIcon,
  Library,
  MessageSquare,
  Mic,
  PanelRight,
  PanelLeft,
  Paperclip,
  Plus,
  Search,
  Settings,
  Share,
  Share2,
  Sparkles,
  SquarePen,
  Star,
  Terminal,
  Trash2,
  Upload,
  User,
  Users,
  X,
  Zap,
  Ellipsis,
  type LucideIcon,
} from 'lucide-react';
import type { ThemePresetName, UiNode } from '../../shared/ui-spec.ts';
import { SCALE } from './theme.ts';

/* ── value helpers: unknown JSON in, safe values out ──────────────── */

type Props = Record<string, unknown>;
export const isObj = (v: unknown): v is Props => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : undefined;
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const oneOf = <T extends string>(v: unknown, options: readonly T[]): T | undefined =>
  options.find((o) => o === v);
const strings = (v: unknown): string[] => arr(v).flatMap((x) => str(x) ?? []);

/* ── icons ────────────────────────────────────────────────────────── */

const ICONS: Record<string, LucideIcon> = {
  bell: Bell,
  'book-open': BookOpen,
  bot: Bot,
  calendar: Calendar,
  check: Check,
  'chevron-down': ChevronDown,
  clock: Clock,
  code: Code,
  download: Download,
  'file-text': FileText,
  folder: Folder,
  globe: Globe,
  history: History,
  home: House,
  house: House,
  image: ImageIcon,
  library: Library,
  'message-square': MessageSquare,
  mic: Mic,
  more: Ellipsis,
  'more-horizontal': Ellipsis,
  ellipsis: Ellipsis,
  'panel-right': PanelRight,
  'panel-left': PanelLeft,
  paperclip: Paperclip,
  plus: Plus,
  search: Search,
  settings: Settings,
  share: Share,
  'share-2': Share2,
  sparkles: Sparkles,
  'square-pen': SquarePen,
  star: Star,
  terminal: Terminal,
  trash: Trash2,
  'trash-2': Trash2,
  upload: Upload,
  user: User,
  users: Users,
  x: X,
  zap: Zap,
};

/** Unknown or missing name → a neutral dot. */
export function UiIcon({ name, size = 16 }: { name?: unknown; size?: number }) {
  const Glyph = typeof name === 'string' ? ICONS[name.toLowerCase()] : undefined;
  if (Glyph) return <Glyph aria-hidden="true" size={size} strokeWidth={1.75} />;
  return <Circle aria-hidden="true" size={Math.max(6, Math.round(size / 3))} strokeWidth={0} fill="currentColor" opacity={0.4} />;
}

/* ── layout ───────────────────────────────────────────────────────── */

const GAPS = ['none', 'xs', 'sm', 'md', 'lg', 'xl'] as const;
const SURFACE: Record<string, string> = {
  bg: 'var(--aicl-bg)',
  surface: 'var(--aicl-surface)',
  sidebar: 'var(--aicl-sidebar)',
  elevated: 'var(--aicl-surface-elevated)',
  inset: 'var(--aicl-surface-inset)',
};
const RADIUS: Record<string, string> = {
  none: '0',
  sm: 'var(--aicl-radius-sm)',
  md: 'var(--aicl-radius-md)',
  lg: 'var(--aicl-radius-lg)',
  xl: 'var(--aicl-radius-xl)',
};
const ALIGN: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };
const JUSTIFY: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' };
const BORDER = '1px solid var(--aicl-border)';

const scale = (v: unknown) => {
  const k = oneOf(v, GAPS);
  return k ? `var(--ui-s-${k}, ${SCALE[k]}px)` : undefined;
};

/** Layout props → inline style for a node's wrapper element. Works for any node type. */
export function layoutStyle(node: UiNode): CSSProperties {
  const p = isObj(node.props) ? node.props : {};
  const isRow = node.type === 'row';
  const isContainer = isRow || node.type === 'column';
  const style: CSSProperties = { minWidth: 0 };
  if (isContainer) {
    style.display = 'flex';
    style.flexDirection = isRow ? 'row' : 'column';
    if (!('height' in p) && !p['grow']) style.minHeight = 0;
  }
  const gap = scale(p['gap']);
  if (gap !== undefined && isContainer) style.gap = gap;
  const pad = scale(p['padding']);
  if (pad !== undefined) style.padding = pad;
  const align = oneOf(p['align'], ['start', 'center', 'end', 'stretch'] as const);
  if (align && isContainer) style.alignItems = ALIGN[align];
  const justify = oneOf(p['justify'], ['start', 'center', 'end', 'between'] as const);
  if (justify && isContainer) style.justifyContent = JUSTIFY[justify];
  if (p['grow'] === true) {
    style.flex = '1 1 0';
    style.minHeight = 0;
  } else if (isContainer || node.type === 'spacer') {
    style.flex = '0 0 auto';
  }
  const w = num(p['width']);
  if (w !== undefined && w > 0) {
    style.width = w;
    style.flexShrink = 0;
  }
  const h = num(p['height']);
  if (h !== undefined && h > 0) {
    style.height = h;
    style.flexShrink = 0;
  }
  const mw = num(p['maxWidth']);
  if (mw !== undefined && mw > 0) {
    style.maxWidth = mw;
    if (w === undefined) style.width = '100%';
    style.marginInline = 'auto';
  }
  const surface = SURFACE[str(p['surface']) ?? ''];
  if (surface) style.background = surface;
  const border = oneOf(p['border'], ['none', 'all', 'top', 'right', 'bottom', 'left'] as const);
  if (border === 'all') style.border = BORDER;
  else if (border === 'top') style.borderTop = BORDER;
  else if (border === 'right') style.borderRight = BORDER;
  else if (border === 'bottom') style.borderBottom = BORDER;
  else if (border === 'left') style.borderLeft = BORDER;
  const radius = RADIUS[str(p['radius']) ?? ''];
  if (radius) style.borderRadius = radius;
  if (p['scroll'] === true) {
    style.overflowY = 'auto';
    style.minHeight = 0;
  }
  return style;
}

/* ── provider kit of the screen ───────────────────────────────────── */

/** The screen's theme preset (set by SpecRenderer); chat elements render in that preset's provider kit. */
export const PresetContext = createContext<ThemePresetName>('default');
export const useScreenKit = (): ProviderKit => kitForPreset(useContext(PresetContext));

/* ── shared message plumbing ──────────────────────────────────────── */

const mdRegistry = createRendererRegistry<ComponentType<PartProps>>({
  text: MarkdownTextPart as ComponentType<PartProps>,
});

const textMessage = (role: 'user' | 'assistant', text: string): Message => ({
  id: `ui-${role}`,
  role,
  parts: [{ type: 'text', text }],
});

const Quiet = ({ children }: { children?: ReactNode }) => <div className="aicl-ui-quiet">{children}</div>;

/* ── per-type renderers ───────────────────────────────────────────── */

type NodeProps = { props: Props };

function Brand({ props }: NodeProps) {
  const name = str(props['name']) ?? 'Product';
  const mark = str(props['mark']);
  return (
    <div className="aicl-ui-brand">
      <span className="aicl-ui-brand-mark" aria-hidden="true">
        {mark ?? name.slice(0, 1).toUpperCase()}
      </span>
      <span className="aicl-ui-brand-name">{name}</span>
    </div>
  );
}

function SidebarNavNode({ props }: NodeProps) {
  const items: SidebarNavItem[] = arr(props['items']).flatMap((raw, i) => {
    const o = isObj(raw) ? raw : { label: raw };
    const label = str(o['label']);
    if (!label) return [];
    const badge = str(o['badge']);
    return [
      {
        id: `nav-${i}`,
        label,
        icon: <UiIcon name={o['icon']} />,
        active: o['active'] === true,
        ...(badge ? { badge } : {}),
      },
    ];
  });
  if (items.length === 0) return <Quiet>No nav items</Quiet>;
  return <SidebarNav items={items} />;
}

const SESSION_STATUS = ['idle', 'running', 'awaiting-input', 'error'] as const;

function SessionListNode({ props }: NodeProps) {
  const { groups, byId, activeId, times } = useMemo(() => {
    const byId: Record<string, SessionMeta> = {};
    const times: string[] = [];
    let activeId: string | undefined;
    const groups = arr(props['groups']).flatMap((g, gi) => {
      if (!isObj(g)) return [];
      const ids: string[] = [];
      arr(g['sessions']).forEach((s, si) => {
        if (!isObj(s)) return;
        const title = str(s['title']);
        if (!title) return;
        const id = `s-${gi}-${si}`;
        const time = str(s['time']);
        const meta: SessionMeta = { id, title };
        const status = oneOf(s['status'], SESSION_STATUS);
        if (status) meta.status = status;
        const statusLine = str(s['statusLine']);
        if (statusLine) meta.statusLine = statusLine;
        const preview = str(s['preview']);
        if (preview) meta.preview = preview;
        if (s['unread'] === true) meta.unread = true;
        if (time) {
          times.push(time);
          meta.updatedAt = times.length; // sentinel: formatTime maps it back to the authored string
        }
        if (s['active'] === true) activeId = id;
        byId[id] = meta;
        ids.push(id);
      });
      const label = str(g['label']);
      return [{ id: `g-${gi}`, ...(label ? { label } : {}), ids }];
    });
    return { groups, byId, activeId, times };
  }, [props]);
  if (Object.keys(byId).length === 0) return <Quiet>No sessions</Quiet>;
  return (
    <SessionList
      groups={groups}
      byId={byId}
      {...(activeId ? { activeId } : {})}
      formatTime={(ts) => times[ts - 1] ?? ''}
    />
  );
}

function Header({ props }: NodeProps) {
  const title = str(props['title']) ?? 'Untitled';
  const subtitle = str(props['subtitle']);
  const model = str(props['model']);
  const actions = strings(props['actions']);
  return (
    <header className="aicl-ui-header">
      <div className="aicl-ui-header-title">
        <span className="aicl-ui-header-name">{title}</span>
        {subtitle ? <span className="aicl-ui-header-sub">{subtitle}</span> : null}
      </div>
      {model ? (
        <span className="aicl-ui-chip">
          {model}
          <ChevronDown size={13} aria-hidden="true" />
        </span>
      ) : null}
      {actions.length ? (
        <div className="aicl-ui-header-actions">
          {actions.map((a, i) => (
            <button key={`${a}-${i}`} type="button" className="aicl-ui-iconbtn" aria-label={a}>
              <UiIcon name={a} size={16} />
            </button>
          ))}
        </div>
      ) : null}
    </header>
  );
}

function UserMessage({ props }: NodeProps) {
  const text = str(props['text']);
  const kit = useScreenKit();
  if (!text) return <Quiet>Empty message</Quiet>;
  return (
    <div className="aicl-ui-message" data-ui-role="user" data-kit={kit.id}>
      <UserTurn kit={kit}>{text}</UserTurn>
    </div>
  );
}

function AssistantMessage({ props }: NodeProps) {
  const text = str(props['text']);
  const kit = useScreenKit();
  if (!text) return <Quiet>Empty reply</Quiet>;
  const message = textMessage('assistant', text);
  return (
    <div className="aicl-ui-message" data-ui-role="assistant" data-ui-actions={props['actions'] === true ? 'on' : 'off'} data-kit={kit.id}>
      <KitRenderContext.Provider value={{ kit, sessionId: 'screen' }}>
        <div className="flex flex-col gap-2">
          {kit.transcript.assistantHeader ? <AssistantHeader kit={kit} /> : null}
          <AssistantText text={text} streaming={false} />
          {props['actions'] === true ? <KitActions kit={kit} message={message} /> : null}
        </div>
      </KitRenderContext.Provider>
    </div>
  );
}

const STEP_STATUS = ['pending', 'running', 'success', 'error', 'cancelled'] as const;

/** Steps carried by a folded run-mode element ({ label, status }[]) as work items. */
function stepItems(raw: unknown, reasoningText?: string): WorkItem[] {
  const items: WorkItem[] = [];
  if (reasoningText) items.push({ kind: 'reasoning', part: { type: 'reasoning', text: reasoningText, durationMs: 1000 }, index: 0 });
  arr(raw).forEach((s, i) => {
    const o = isObj(s) ? s : {};
    items.push({
      kind: 'tool',
      index: i + 1,
      part: { type: 'tool-call', toolCallId: `ui-step-${i}`, name: str(o['label']) ?? 'Step', args: {}, status: oneOf(o['status'], STEP_STATUS) ?? 'success' },
    });
  });
  return items;
}

function Reasoning({ props }: NodeProps) {
  const kit = useScreenKit();
  const sec = num(props['durationSec']);
  const text = str(props['text']);
  const streaming = props['streaming'] === true;
  // A folded turn (run mode): the kit's own work group, with the steps inside.
  if (Array.isArray(props['steps'])) {
    return (
      <KitRenderContext.Provider value={{ kit, sessionId: 'screen' }}>
        <WorkGroup items={stepItems(props['steps'], text)} active={streaming} fallbackSeconds={sec ?? 1} />
      </KitRenderContext.Provider>
    );
  }
  return <ScreenReasoning kit={kit} text={text} durationSec={sec} streaming={streaming} />;
}

function ToolStep({ props }: NodeProps) {
  const kit = useScreenKit();
  if (Array.isArray(props['steps'])) {
    const items = stepItems(props['steps']);
    const active = items.some((i) => i.kind === 'tool' && (i.part.status === 'running' || i.part.status === 'pending'));
    return (
      <KitRenderContext.Provider value={{ kit, sessionId: 'screen' }}>
        <WorkGroup items={items} active={active} fallbackSeconds={1} />
      </KitRenderContext.Provider>
    );
  }
  return <ScreenStep kit={kit} label={str(props['label']) ?? 'Step'} status={oneOf(props['status'], STEP_STATUS) ?? 'success'} />;
}

const PLAN_STATUS = ['pending', 'running', 'done', 'error'] as const;

function Plan({ props }: NodeProps) {
  const items: PlanItem[] = arr(props['steps']).flatMap((s, i) => {
    const o = isObj(s) ? s : { label: s };
    const label = str(o['label']);
    if (!label) return [];
    return [{ id: `s${i}`, label, status: oneOf(o['status'], PLAN_STATUS) ?? 'pending' }];
  });
  if (items.length === 0) return <Quiet>No steps</Quiet>;
  return <AnimatedPlan steps={items} title={str(props['title']) ?? 'Plan'} />;
}

const KINDS = ['code', 'document', 'diff', 'preview', 'terminal', 'table', 'chart'] as const;

function Artifact({ props }: NodeProps) {
  const title = str(props['title']);
  if (!title) return <Quiet>No artifact</Quiet>;
  const version = num(props['version']);
  const part = {
    type: 'artifact' as const,
    artifactId: title,
    kind: oneOf(props['kind'], KINDS) ?? 'document',
    title,
    ...(version !== undefined ? { version } : {}),
  };
  const message: Message = { id: 'ui-artifact', role: 'assistant', parts: [part] };
  return (
    <ArtifactCard part={part} message={message} index={0} streaming={false} onOpen={() => undefined} />
  );
}

function CodeNode({ props }: NodeProps) {
  const content = str(props['content']);
  if (content === undefined) return <Quiet>No code</Quiet>;
  const language = str(props['language']);
  return <CodeBlock content={content} {...(language ? { language } : {})} />;
}

function TerminalNode({ props }: NodeProps) {
  const raw = props['lines'];
  const lines = typeof raw === 'string' ? raw.split('\n') : strings(raw);
  if (lines.length === 0) return <Quiet>No output</Quiet>;
  return <TerminalOutput lines={lines} />;
}

function StatusLine({ props }: NodeProps) {
  const text = str(props['text']);
  if (!text) return <Quiet>No status</Quiet>;
  return <p data-aicl="status-line">{text}</p>;
}

function ComposerNode({ props }: NodeProps) {
  const kit = useScreenKit();
  const initial = str(props['value']) ?? '';
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial]);
  const chips = strings(props['chips']);
  const model = str(props['model']);
  const hero = props['variant'] === 'hero';
  const streaming = props['state'] === 'streaming';
  return (
    <div className="aicl-ui-composer" data-ui-variant={hero ? 'hero' : 'docked'} data-kit={kit.id}>
      {chips.length ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chips.map((label, i) => (
            <button
              key={`${label}-${i}`}
              type="button"
              onClick={() => setDraft(label)}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      <KitComposer
        kit={kit}
        value={draft}
        onChange={setDraft}
        onSubmit={() => setDraft('')}
        status={streaming ? 'streaming' : 'ready'}
        variant={hero ? 'hero' : 'bottom'}
        placeholder={str(props['placeholder']) ?? 'Message'}
        {...(props['attach'] === true ? { onAttach: () => undefined } : {})}
      />
      {model ? <div className="aicl-ui-composer-model">{model}</div> : null}
    </div>
  );
}

function Suggestions({ props }: NodeProps) {
  const items = strings(props['items']);
  if (items.length === 0) return <Quiet>No suggestions</Quiet>;
  if (props['layout'] === 'rows') {
    return (
      <div className="aicl-ui-rows">
        {items.map((label, i) => (
          <button key={`${label}-${i}`} type="button" className="aicl-ui-row-btn">
            {label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <SuggestionChips
      suggestions={items.map((label, i) => ({ id: `${i}-${label}`, label }))}
      onSelect={() => undefined}
    />
  );
}

function Attachments({ props }: NodeProps) {
  const files: Attachment[] = arr(props['files']).flatMap((f, i) => {
    const o = isObj(f) ? f : { name: f };
    const name = str(o['name']);
    if (!name) return [];
    return [
      {
        id: `f${i}`,
        name,
        mediaType: 'application/octet-stream',
        status: oneOf(o['status'], ['uploading', 'ready', 'error'] as const) ?? 'ready',
      },
    ];
  });
  if (files.length === 0) return <Quiet>No attachments</Quiet>;
  return (
    <div className="aicl-ui-attachments">
      {files.map((a) => (
        <AttachmentChip key={a.id} attachment={a} />
      ))}
    </div>
  );
}

function Heading({ props }: NodeProps) {
  const text = str(props['text']);
  if (!text) return <Quiet>Empty heading</Quiet>;
  const level = props['level'] === 1 || props['level'] === 3 ? props['level'] : 2;
  const align = props['align'] === 'center' ? 'center' : 'start';
  return (
    <div className="aicl-ui-heading" data-level={level} role="heading" aria-level={level} style={{ textAlign: align }}>
      {text}
    </div>
  );
}

function TextNode({ props }: NodeProps) {
  const text = str(props['text']);
  if (!text) return <Quiet>Empty text</Quiet>;
  return (
    <p
      className="aicl-ui-text"
      data-tone={oneOf(props['tone'], ['default', 'muted', 'faint'] as const) ?? 'default'}
      data-size={oneOf(props['size'], ['xs', 'sm', 'md', 'lg'] as const) ?? 'md'}
      style={{ textAlign: props['align'] === 'center' ? 'center' : 'start' }}
    >
      {text}
    </p>
  );
}

function ButtonNode({ props }: NodeProps) {
  const label = str(props['label']);
  if (!label) return <Quiet>Button</Quiet>;
  const variant = oneOf(props['variant'], ['primary', 'secondary', 'ghost'] as const) ?? 'secondary';
  return (
    <button type="button" className="aicl-ui-button" data-variant={variant}>
      {props['icon'] ? <UiIcon name={props['icon']} size={15} /> : null}
      {label}
    </button>
  );
}

function TableNode({ props }: NodeProps) {
  const columns = arr(props['columns']).map((c) => str(c) ?? '');
  const rows = arr(props['rows']).map((r) => arr(r).map((c) => str(c) ?? ''));
  const width = Math.max(columns.length, ...rows.map((r) => r.length), 0);
  if (width === 0) return <Quiet>No data</Quiet>;
  const pad = (cells: string[]) => Array.from({ length: width }, (_, i) => cells[i] ?? '');
  return (
    <table className="aicl-ui-table">
      {columns.length ? (
        <thead>
          <tr>
            {pad(columns).map((c, i) => (
              <th key={i}>{c}</th>
            ))}
          </tr>
        </thead>
      ) : null}
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri}>
            {pad(r).map((c, ci) => (
              <td key={ci}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Metric({ props }: NodeProps) {
  const value = str(props['value']);
  if (value === undefined) return <Quiet>No value</Quiet>;
  const trend = oneOf(props['trend'], ['up', 'down', 'flat'] as const) ?? 'flat';
  const delta = str(props['delta']);
  const label = str(props['label']);
  return (
    <div className="aicl-ui-metric">
      {label ? <div className="aicl-ui-metric-label">{label}</div> : null}
      <div className="aicl-ui-metric-value">{value}</div>
      {delta ? (
        <div className="aicl-ui-metric-delta" data-trend={trend}>
          {trend === 'up' ? '↑ ' : trend === 'down' ? '↓ ' : ''}
          {delta}
        </div>
      ) : null}
    </div>
  );
}

function ToastNode({ props }: NodeProps) {
  const title = str(props['title']);
  if (!title) return <Quiet>No toast</Quiet>;
  const description = str(props['description']);
  const action = str(props['action']);
  const toast: ToastState = {
    id: 'ui-toast',
    title,
    variant: oneOf(props['variant'], ['info', 'success', 'error'] as const) ?? 'info',
    paused: false,
    ...(description ? { description } : {}),
    ...(action ? { action: { label: action, onAction: () => undefined } } : {}),
  } as ToastState;
  return (
    <div className="aicl-ui-toast">
      <Toast toast={toast} onDismiss={() => undefined} renderAction={(t) => (t.action ? <button type="button">{action}</button> : null)} />
    </div>
  );
}

function EmptyState({ props }: NodeProps) {
  const title = str(props['title']);
  if (!title) return <Quiet>Empty state</Quiet>;
  const hint = str(props['hint']);
  return (
    <div className="aicl-ui-empty">
      <div className="aicl-ui-empty-title">{title}</div>
      {hint ? <div className="aicl-ui-empty-hint">{hint}</div> : null}
    </div>
  );
}

function ImageNode({ props }: NodeProps) {
  const label = str(props['label']);
  const h = num(props['height']);
  return (
    <div className="aicl-ui-image" style={{ height: h && h > 0 ? h : 160 }}>
      <ImageIcon size={20} aria-hidden="true" strokeWidth={1.5} />
      {label ? <span>{label}</span> : null}
    </div>
  );
}

const Divider = () => <hr className="aicl-ui-divider" />;

function Spacer({ props }: NodeProps) {
  const size = num(props['size']);
  return <div className="aicl-ui-spacer" style={size && size > 0 ? { height: size, width: size } : undefined} />;
}

const LEAVES: Record<string, ComponentType<NodeProps>> = {
  brand: Brand,
  sidebarNav: SidebarNavNode,
  sessionList: SessionListNode,
  header: Header,
  userMessage: UserMessage,
  assistantMessage: AssistantMessage,
  reasoning: Reasoning,
  toolStep: ToolStep,
  plan: Plan,
  artifact: Artifact,
  code: CodeNode,
  terminal: TerminalNode,
  statusLine: StatusLine,
  composer: ComposerNode,
  suggestions: Suggestions,
  attachments: Attachments,
  heading: Heading,
  text: TextNode,
  button: ButtonNode,
  table: TableNode,
  metric: Metric,
  toast: ToastNode,
  emptyState: EmptyState,
  image: ImageNode,
  divider: Divider,
  spacer: Spacer,
};

/**
 * Renders one node's own content. Containers (`row`/`column`) just place their
 * already-rendered children; their layout lives on the wrapper (layoutStyle).
 */
export function NodeBody({ node, children }: { node: UiNode; children?: ReactNode }) {
  const props = isObj(node.props) ? node.props : {};
  if (node.type === 'row' || node.type === 'column') return <>{children}</>;
  const Leaf = LEAVES[node.type as string];
  if (!Leaf) return <Quiet>Unknown element “{String(node.type)}”</Quiet>;
  return <Leaf props={props} />;
}
