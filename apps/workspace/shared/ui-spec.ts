/**
 * The screen spec: a chat UI as a JSON tree of decoupled elements.
 *
 * A screen is what a designer would draw as a frame: layout containers
 * (`row`, `column`) holding chat elements (`userMessage`, `toolStep`,
 * `composer`, `sessionList`…) that each map onto an @aicl/react primitive.
 * The agent creates and edits screens by node id; the browser renders them
 * live; `toReactCode` turns one into code that uses the library.
 *
 * JSON trees, not free-form shapes, because an agent can edit a tree
 * reliably (stable ids, local patches) and a tree is already a layout.
 *
 * Pure data and types only — shared by server, browser, and tests.
 */

/* ── Tree ─────────────────────────────────────────────────────────── */

export interface UiNode {
  /** Unique within the screen; stable across edits. Short slugs: "composer", "msg-2". */
  id: string;
  type: UiNodeType;
  props?: Record<string, unknown>;
  /** Only for container types (`row`, `column`). */
  children?: UiNode[];
}

export type ScreenFrame = 'desktop' | 'tablet' | 'panel' | 'mobile';

export const FRAME_SIZES: Record<ScreenFrame, { w: number; h: number; label: string }> = {
  desktop: { w: 1280, h: 800, label: 'Desktop 1280×800' },
  tablet: { w: 834, h: 1112, label: 'Tablet 834×1112' },
  panel: { w: 420, h: 760, label: 'Side panel 420×760' },
  mobile: { w: 390, h: 844, label: 'Mobile 390×844' },
};

export interface ScreenSpec {
  name: string;
  frame: ScreenFrame;
  /** A preset name from THEME_PRESETS plus optional token overrides. */
  theme: { preset: ThemePresetName; overrides?: Partial<ThemeTokens> };
  root: UiNode;
}

/* ── Element catalog ──────────────────────────────────────────────── */

export interface UiNodeSpec {
  type: string;
  /** Containers take children; everything else is a leaf. */
  container: boolean;
  /** Which library primitive renders it (for docs and codegen). */
  primitive: string;
  description: string;
  /** Props as a compact TypeScript-ish hint for the agent. */
  propsHint: string;
}

const LAYOUT_PROPS =
  "{ gap?: 'none'|'xs'|'sm'|'md'|'lg'|'xl'; padding?: 'none'|'xs'|'sm'|'md'|'lg'|'xl'; align?: 'start'|'center'|'end'|'stretch'; justify?: 'start'|'center'|'end'|'between'; grow?: boolean; width?: number; height?: number; maxWidth?: number; surface?: 'none'|'bg'|'surface'|'sidebar'|'elevated'|'inset'; border?: 'none'|'all'|'top'|'right'|'bottom'|'left'; radius?: 'none'|'sm'|'md'|'lg'|'xl'; scroll?: boolean }";

export const NODE_TYPES = [
  // Layout
  { type: 'row', container: true, primitive: 'layout', description: 'Horizontal flex container.', propsHint: LAYOUT_PROPS },
  { type: 'column', container: true, primitive: 'layout', description: 'Vertical flex container. The screen root is usually a row (sidebar | main | pane) or a column.', propsHint: LAYOUT_PROPS },
  // Navigation
  { type: 'brand', container: false, primitive: 'text', description: 'Product name and mark at the top of a sidebar.', propsHint: '{ name: string; mark?: string }' },
  { type: 'sidebarNav', container: false, primitive: 'SidebarNav', description: 'Primary nav items with icons.', propsHint: '{ items: { label: string; icon?: string; active?: boolean; badge?: string }[] }' },
  { type: 'sessionList', container: false, primitive: 'SessionList', description: 'Grouped list of past chats/tasks with status lines.', propsHint: "{ groups: { label?: string; sessions: { title: string; status?: 'idle'|'running'|'awaiting-input'|'error'; statusLine?: string; preview?: string; time?: string; unread?: boolean; active?: boolean }[] }[] }" },
  { type: 'header', container: false, primitive: 'header bar', description: 'Thread or page header: title, optional subtitle, model picker, icon actions.', propsHint: "{ title: string; subtitle?: string; model?: string; actions?: string[] /* lucide icon names: 'share','more','panel-right','settings' */ }" },
  // Conversation
  { type: 'userMessage', container: false, primitive: 'MessageItem (user)', description: 'A user message bubble.', propsHint: '{ text: string }' },
  { type: 'assistantMessage', container: false, primitive: 'MessageItem (assistant)', description: 'An assistant reply, Markdown, full width, optional action bar.', propsHint: '{ text: string; actions?: boolean }' },
  { type: 'reasoning', container: false, primitive: 'ReasoningDisclosure', description: 'A collapsed "Thought for Ns" row.', propsHint: '{ durationSec?: number; text?: string; streaming?: boolean }' },
  { type: 'toolStep', container: false, primitive: 'ToolCallDisclosure', description: 'One agent step line with status icon.', propsHint: "{ label: string; status?: 'pending'|'running'|'success'|'error'|'cancelled' }" },
  { type: 'plan', container: false, primitive: 'PlanChecklist', description: 'Checklist of steps with done/total.', propsHint: "{ title?: string; steps: { label: string; status: 'pending'|'running'|'done'|'error' }[] }" },
  { type: 'artifact', container: false, primitive: 'ArtifactCard', description: 'Card for a produced artifact with an Open button.', propsHint: "{ title: string; kind: 'code'|'document'|'diff'|'preview'|'terminal'|'table'|'chart'; version?: number }" },
  { type: 'code', container: false, primitive: 'CodeBlock', description: 'Code block with language label.', propsHint: '{ language?: string; content: string }' },
  { type: 'terminal', container: false, primitive: 'TerminalOutput', description: 'Terminal output lines.', propsHint: '{ lines: string[] }' },
  { type: 'statusLine', container: false, primitive: 'status line', description: 'Quiet status text such as "Stopped working" or "Devin went to sleep".', propsHint: '{ text: string }' },
  // Input
  { type: 'composer', container: false, primitive: 'Composer', description: 'Message input card with attach and send/stop.', propsHint: "{ placeholder?: string; value?: string; attach?: boolean; model?: string; chips?: string[]; state?: 'ready'|'streaming'; variant?: 'docked'|'hero' }" },
  { type: 'suggestions', container: false, primitive: 'SuggestionChips', description: 'Suggested prompts as chips or full-width rows.', propsHint: "{ items: string[]; layout?: 'chips'|'rows' }" },
  { type: 'attachments', container: false, primitive: 'AttachmentChip', description: 'Staged attachment chips.', propsHint: "{ files: { name: string; status?: 'uploading'|'ready'|'error' }[] }" },
  // Content
  { type: 'heading', container: false, primitive: 'text', description: 'A heading.', propsHint: '{ text: string; level?: 1|2|3; align?: "start"|"center" }' },
  { type: 'text', container: false, primitive: 'text', description: 'Body or muted text.', propsHint: "{ text: string; tone?: 'default'|'muted'|'faint'; size?: 'xs'|'sm'|'md'|'lg'; align?: 'start'|'center' }" },
  { type: 'button', container: false, primitive: 'button', description: 'A button.', propsHint: "{ label: string; variant?: 'primary'|'secondary'|'ghost'; icon?: string }" },
  { type: 'table', container: false, primitive: 'table', description: 'Small data table.', propsHint: '{ columns: string[]; rows: (string|number)[][] }' },
  { type: 'metric', container: false, primitive: 'metric', description: 'Headline number with label and delta.', propsHint: "{ label: string; value: string|number; delta?: string; trend?: 'up'|'down'|'flat' }" },
  { type: 'toast', container: false, primitive: 'Toast', description: 'An inline toast notification.', propsHint: "{ title: string; description?: string; variant?: 'info'|'success'|'error'; action?: string }" },
  { type: 'emptyState', container: false, primitive: 'empty state', description: 'Centered title and hint for empty screens.', propsHint: '{ title: string; hint?: string }' },
  { type: 'image', container: false, primitive: 'placeholder', description: 'Image or preview placeholder box with a label.', propsHint: '{ label?: string; height?: number }' },
  { type: 'divider', container: false, primitive: 'divider', description: 'A 1px separator.', propsHint: '{}' },
  { type: 'spacer', container: false, primitive: 'spacer', description: 'Flexible empty space (grows).', propsHint: '{ size?: number }' },
] as const satisfies readonly UiNodeSpec[];

export type UiNodeType = (typeof NODE_TYPES)[number]['type'];
export const NODE_TYPE_NAMES = NODE_TYPES.map((n) => n.type) as UiNodeType[];
export const nodeSpec = (type: string): UiNodeSpec | undefined => NODE_TYPES.find((n) => n.type === type);
export const isContainer = (type: string): boolean => nodeSpec(type)?.container ?? false;

/* ── Theme ────────────────────────────────────────────────────────── */

/** Everything a screen can restyle. Maps onto --aicl-* CSS variables on the screen root. */
export interface ThemeTokens {
  mode: 'light' | 'dark';
  /** Primary action colour (send button, active states). */
  accent: string;
  accentFg: string;
  bg: string;
  surface: string;
  sidebar: string;
  text: string;
  textMuted: string;
  border: string;
  bubbleUser: string;
  /** Corner radius scale: sm/md/lg/xl px are derived from this base (px). */
  radius: number;
  font: 'system' | 'inter' | 'serif' | 'mono' | 'rounded';
  density: 'compact' | 'comfortable' | 'spacious';
}

export type ThemePresetName = 'default' | 'devin' | 'manus' | 'cofounder' | 'lovable';

export const THEME_PRESETS: Record<ThemePresetName, { label: string; description: string; tokens: ThemeTokens }> = {
  default: {
    label: 'AICL',
    description: 'Neutral, near-monochrome; the library default.',
    tokens: {
      mode: 'light', accent: '#18181b', accentFg: '#fafafa', bg: '#f8f8f7', surface: '#ffffff', sidebar: '#f2f2f1',
      text: '#18181b', textMuted: '#52525b', border: '#e7e7e5', bubbleUser: '#efefee', radius: 10, font: 'system', density: 'comfortable',
    },
  },
  devin: {
    label: 'Devin-like',
    description: 'Cool greys, black primary, dense lists, green status.',
    tokens: {
      mode: 'light', accent: '#111111', accentFg: '#ffffff', bg: '#fafafa', surface: '#ffffff', sidebar: '#f4f4f4',
      text: '#111111', textMuted: '#5f6368', border: '#e5e5e5', bubbleUser: '#f1f1f1', radius: 8, font: 'inter', density: 'compact',
    },
  },
  manus: {
    label: 'Manus-like',
    description: 'Warm off-white, soft cards, generous spacing.',
    tokens: {
      mode: 'light', accent: '#1a1a1a', accentFg: '#ffffff', bg: '#f8f8f7', surface: '#ffffff', sidebar: '#efefed',
      text: '#1a1a1a', textMuted: '#6b6b6b', border: '#e8e8e6', bubbleUser: '#ffffff', radius: 14, font: 'system', density: 'spacious',
    },
  },
  cofounder: {
    label: 'Cofounder-like',
    description: 'Beige paper, quiet type, rounded panels.',
    tokens: {
      mode: 'light', accent: '#2b2b2b', accentFg: '#ffffff', bg: '#f0efeb', surface: '#fbfbf9', sidebar: '#e9e8e3',
      text: '#2b2b2b', textMuted: '#77756f', border: '#e2e0da', bubbleUser: '#f3f2ee', radius: 16, font: 'serif', density: 'comfortable',
    },
  },
  lovable: {
    label: 'Lovable-like',
    description: 'Dark, expressive, pink-violet accent.',
    tokens: {
      mode: 'dark', accent: '#e14a8b', accentFg: '#ffffff', bg: '#151515', surface: '#1f1f1f', sidebar: '#111111',
      text: '#f4f4f5', textMuted: '#a1a1aa', border: '#2e2e2e', bubbleUser: '#2a2a2a', radius: 16, font: 'inter', density: 'comfortable',
    },
  },
};

/** Neutral palettes used when a screen flips a preset to the other mode. */
const MODE_PALETTES: Record<ThemeTokens['mode'], Pick<ThemeTokens, 'bg' | 'surface' | 'sidebar' | 'text' | 'textMuted' | 'border' | 'bubbleUser'>> = {
  light: { bg: '#f8f8f7', surface: '#ffffff', sidebar: '#f2f2f1', text: '#18181b', textMuted: '#52525b', border: '#e7e7e5', bubbleUser: '#efefee' },
  dark: { bg: '#161616', surface: '#1c1c1c', sidebar: '#111111', text: '#f4f4f5', textMuted: '#a1a1aa', border: '#2a2a2a', bubbleUser: '#262626' },
};

/** Rough relative luminance of a #rgb/#rrggbb colour (0 dark … 1 light); undefined if unparseable. */
function luminance(color: string): number | undefined {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())?.[1];
  if (!hex) return undefined;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/**
 * Preset tokens + overrides. When the overrides flip the preset's mode
 * (e.g. "devin, but dark"), colours the overrides do not set come from a
 * neutral palette for that mode — otherwise "dark" would only change
 * color-scheme over light colours. A near-black/near-white accent is
 * inverted so the primary action stays visible.
 */
export function resolveTheme(theme: ScreenSpec['theme']): ThemeTokens {
  const base = (THEME_PRESETS[theme.preset] ?? THEME_PRESETS.default).tokens;
  const overrides = theme.overrides ?? {};
  const mode = overrides.mode ?? base.mode;
  if (mode === base.mode) return { ...base, ...overrides };

  const flipped: ThemeTokens = { ...base, ...MODE_PALETTES[mode], mode };
  const lum = luminance(base.accent);
  const neutralAccent = lum !== undefined && (mode === 'dark' ? lum < 0.2 : lum > 0.85);
  if (neutralAccent) {
    flipped.accent = mode === 'dark' ? '#fafafa' : '#18181b';
    flipped.accentFg = mode === 'dark' ? '#18181b' : '#fafafa';
  }
  return { ...flipped, ...overrides };
}

/* ── Edits ────────────────────────────────────────────────────────── */

/** Local, id-addressed edits. The agent never rewrites a whole screen to change one thing. */
export type UiPatchOp =
  | { op: 'update'; id: string; props: Record<string, unknown> } // shallow-merge props
  | { op: 'replace'; id: string; node: UiNode } // swap a node (and its subtree)
  | { op: 'insert'; parent: string; index?: number; node: UiNode } // index omitted → append
  | { op: 'remove'; id: string }
  | { op: 'move'; id: string; parent: string; index?: number }
  | { op: 'theme'; preset?: ThemePresetName; overrides?: Partial<ThemeTokens> } // overrides merge
  | { op: 'rename'; name: string }
  | { op: 'frame'; frame: ScreenFrame };

/* ── Example: a Devin/Manus-style agent thread ────────────────────── */

export const SAMPLE_SCREEN: ScreenSpec = {
  name: 'Agent thread',
  frame: 'desktop',
  theme: { preset: 'default' },
  root: {
    id: 'root',
    type: 'row',
    props: { surface: 'bg' },
    children: [
      {
        id: 'sidebar',
        type: 'column',
        props: { width: 260, surface: 'sidebar', border: 'right', padding: 'sm', gap: 'sm' },
        children: [
          { id: 'brand', type: 'brand', props: { name: 'Acme Agent' } },
          { id: 'nav', type: 'sidebarNav', props: { items: [{ label: 'New task', icon: 'square-pen' }, { label: 'Search', icon: 'search' }, { label: 'Library', icon: 'book-open' }] } },
          {
            id: 'sessions',
            type: 'sessionList',
            props: {
              groups: [
                { label: 'Today', sessions: [{ title: 'Fix the double submit', status: 'running', statusLine: 'Running tests · 3/4', active: true }, { title: 'Draft the Q4 roadmap', preview: 'Here is a first outline…' }] },
                { label: 'Yesterday', sessions: [{ title: 'Why is the build slow?', status: 'awaiting-input', statusLine: 'Needs your approval' }] },
              ],
            },
          },
        ],
      },
      {
        id: 'main',
        type: 'column',
        props: { grow: true },
        children: [
          { id: 'header', type: 'header', props: { title: 'Fix the double submit', model: 'Opus 5.5', actions: ['share', 'panel-right', 'more'] } },
          {
            id: 'thread',
            type: 'column',
            props: { grow: true, scroll: true, padding: 'lg', gap: 'md', maxWidth: 760 },
            children: [
              { id: 'msg-1', type: 'userMessage', props: { text: 'The send button sometimes submits twice. Can you find out why?' } },
              { id: 'think-1', type: 'reasoning', props: { durationSec: 9 } },
              { id: 'step-1', type: 'toolStep', props: { label: 'Read packages/core/src/chat.ts', status: 'success' } },
              { id: 'step-2', type: 'toolStep', props: { label: 'Ran npm test · 16 passed', status: 'success' } },
              { id: 'reply-1', type: 'assistantMessage', props: { text: 'Found it: the status flips **after** the request starts. I moved it before the await and added a regression test.', actions: true } },
              { id: 'patch', type: 'artifact', props: { title: 'Fix double submit in ChatController', kind: 'diff', version: 2 } },
            ],
          },
          { id: 'composer', type: 'composer', props: { placeholder: 'Ask the agent to build, fix, or explain…', attach: true } },
        ],
      },
    ],
  },
};
