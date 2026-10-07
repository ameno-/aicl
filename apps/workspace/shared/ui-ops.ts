/**
 * Pure operations over ScreenSpec (see ui-spec.ts). Shared by the server
 * (agent tools validate and summarise) and the browser (the executor applies
 * patches, the screen header exports code).
 *
 * CONTRACT: signatures are fixed; work package B implements the bodies.
 */

import {
  FRAME_SIZES,
  THEME_PRESETS,
  isContainer,
  nodeSpec,
  resolveTheme,
  type ScreenFrame,
  type ScreenSpec,
  type ThemePresetName,
  type ThemeTokens,
  type UiNode,
  type UiNodeType,
  type UiPatchOp,
} from './ui-spec.ts';

/** A patch or spec problem, phrased so the agent can fix its next call. */
export class UiSpecError extends Error {
  override name = 'UiSpecError';
}

/* ── Small helpers ────────────────────────────────────────────────── */

type Props = Record<string, unknown>;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFrame = (v: unknown): v is ScreenFrame => typeof v === 'string' && Object.hasOwn(FRAME_SIZES, v);
const isPreset = (v: unknown): v is ThemePresetName => typeof v === 'string' && Object.hasOwn(THEME_PRESETS, v);

const TOKEN_CHECKS: { [K in keyof ThemeTokens]: (v: unknown) => boolean } = {
  mode: (v) => v === 'light' || v === 'dark',
  accent: (v) => typeof v === 'string' && v.length > 0,
  accentFg: (v) => typeof v === 'string' && v.length > 0,
  bg: (v) => typeof v === 'string' && v.length > 0,
  surface: (v) => typeof v === 'string' && v.length > 0,
  sidebar: (v) => typeof v === 'string' && v.length > 0,
  text: (v) => typeof v === 'string' && v.length > 0,
  textMuted: (v) => typeof v === 'string' && v.length > 0,
  border: (v) => typeof v === 'string' && v.length > 0,
  bubbleUser: (v) => typeof v === 'string' && v.length > 0,
  radius: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
  font: (v) => v === 'system' || v === 'inter' || v === 'serif' || v === 'mono' || v === 'rounded',
  density: (v) => v === 'compact' || v === 'comfortable' || v === 'spacious',
};

/** Keep only known ThemeTokens keys whose values have the right shape. */
function sanitizeOverrides(raw: unknown): Partial<ThemeTokens> {
  const out: Record<string, unknown> = {};
  if (!isObject(raw)) return out as Partial<ThemeTokens>;
  for (const key of Object.keys(TOKEN_CHECKS) as (keyof ThemeTokens)[]) {
    if (Object.hasOwn(raw, key) && TOKEN_CHECKS[key](raw[key])) out[key] = raw[key];
  }
  return out as Partial<ThemeTokens>;
}

function collectIds(node: UiNode, into: Set<string>): Set<string> {
  into.add(node.id);
  for (const child of node.children ?? []) collectIds(child, into);
  return into;
}

function uniqueSlug(base: string, used: Set<string>): string {
  let n = 1;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Coerce one raw node (recursively). `used` holds every id already taken and
 * is updated as ids are assigned, so the result is unique against it.
 */
function normNode(raw: unknown, used: Set<string>): UiNode {
  const obj = isObject(raw) ? raw : {};
  const rawType = typeof obj.type === 'string' ? obj.type : undefined;
  const known = rawType !== undefined && nodeSpec(rawType) !== undefined;
  const type = (known ? rawType : 'text') as UiNodeType;

  let id: string | undefined;
  if (typeof obj.id === 'string' && obj.id.trim()) id = obj.id.trim();
  else if (typeof obj.id === 'number' && Number.isFinite(obj.id)) id = String(obj.id);
  if (id === undefined || used.has(id)) id = uniqueSlug(type, used);
  used.add(id);

  let props: Props = isObject(obj.props) ? { ...obj.props } : {};
  if (!known) {
    const label = !isObject(raw) ? 'Invalid element' : `Unknown element "${rawType ?? ''}"`;
    props = { text: label, tone: 'faint' };
  }

  const node: UiNode = { id, type, props };
  if (isContainer(type)) {
    node.children = Array.isArray(obj.children) && known ? obj.children.map((c) => normNode(c, used)) : [];
  }
  return node;
}

function normTheme(raw: unknown): ScreenSpec['theme'] {
  const obj = isObject(raw) ? raw : {};
  const preset: ThemePresetName = isPreset(obj.preset) ? obj.preset : 'default';
  const overrides = sanitizeOverrides(obj.overrides);
  return Object.keys(overrides).length ? { preset, overrides } : { preset };
}

/* ── normalizeSpec ────────────────────────────────────────────────── */

/**
 * Coerce agent/user JSON into a valid ScreenSpec: unknown node types become
 * `text` notices, missing ids are assigned (type-based slugs, unique),
 * children are dropped from leaves, frame/theme fall back to defaults.
 * Never throws for recoverable input; throws UiSpecError only when the input
 * is not an object at all.
 */
export function normalizeSpec(raw: unknown): ScreenSpec {
  if (!isObject(raw)) throw new UiSpecError('spec must be an object with { name, frame, theme, root }');
  const used = new Set<string>();
  const root = isObject(raw.root)
    ? normNode(raw.root, used)
    : normNode({ id: 'root', type: 'column', children: [{ type: 'emptyState', props: { title: 'Empty screen', hint: 'Add elements to get started.' } }] }, used);
  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Untitled screen',
    frame: isFrame(raw.frame) ? raw.frame : 'desktop',
    theme: normTheme(raw.theme),
    root,
  };
}

/* ── applyPatch ───────────────────────────────────────────────────── */

export function findNode(spec: ScreenSpec, id: string): { node: UiNode; parent: UiNode | null; index: number } | undefined {
  const walk = (node: UiNode, parent: UiNode | null, index: number): ReturnType<typeof findNode> => {
    if (node.id === id) return { node, parent, index };
    for (let i = 0; i < (node.children?.length ?? 0); i++) {
      const hit = walk(node.children![i]!, node, i);
      if (hit) return hit;
    }
    return undefined;
  };
  return walk(spec.root, null, -1);
}

const clampIndex = (index: unknown, length: number): number =>
  typeof index === 'number' && Number.isFinite(index) ? Math.max(0, Math.min(length, Math.trunc(index))) : length;

/**
 * Apply ops in order to a copy. Throws UiSpecError naming the failing op and id.
 * Ids stay unique. Op numbers in errors are 1-based.
 * An inserted node whose own id already exists is an error; ids deeper in the
 * inserted subtree that clash are renamed automatically.
 */
export function applyPatch(spec: ScreenSpec, ops: UiPatchOp[]): ScreenSpec {
  if (!Array.isArray(ops)) throw new UiSpecError('ops must be an array');
  const next: ScreenSpec = structuredClone(spec);

  ops.forEach((op, i) => {
    const at = (kind: string) => `op ${i + 1} (${kind}): `;
    const fail = (kind: string, msg: string): never => {
      throw new UiSpecError(at(kind) + msg);
    };
    const need = (kind: string, id: unknown) => {
      const hit = typeof id === 'string' ? findNode(next, id) : undefined;
      if (!hit) fail(kind, `id "${String(id)}" not found`);
      return hit!;
    };
    const container = (kind: string, id: unknown) => {
      const hit = typeof id === 'string' ? findNode(next, id) : undefined;
      if (!hit) return fail(kind, `parent "${String(id)}" not found`);
      if (!isContainer(hit.node.type)) return fail(kind, `parent "${hit.node.id}" is not a container (type ${hit.node.type})`);
      return hit.node;
    };

    if (!isObject(op)) throw new UiSpecError(at('?') + 'op must be an object');
    switch (op.op) {
      case 'update': {
        const { node } = need('update', op.id);
        if (!isObject(op.props)) fail('update', 'props must be an object');
        const props: Props = { ...(node.props ?? {}) };
        for (const [k, v] of Object.entries(op.props)) {
          if (v === null) delete props[k];
          else props[k] = v;
        }
        node.props = props;
        break;
      }
      case 'insert': {
        const parent = container('insert', op.parent);
        const rawId = isObject(op.node) && typeof op.node.id === 'string' ? op.node.id : undefined;
        const existing = collectIds(next.root, new Set());
        if (rawId !== undefined && existing.has(rawId)) fail('insert', `id "${rawId}" already exists`);
        const node = normNode(op.node, existing);
        parent.children ??= [];
        parent.children.splice(clampIndex(op.index, parent.children.length), 0, node);
        break;
      }
      case 'replace': {
        const { node: target, parent, index } = need('replace', op.id);
        const used = collectIds(next.root, new Set());
        collectIds(target, new Set()).forEach((id) => used.delete(id));
        const raw = isObject(op.node) ? { ...op.node, id: target.id } : { id: target.id };
        const node = normNode(raw, used);
        if (parent) parent.children![index] = node;
        else next.root = node;
        break;
      }
      case 'remove': {
        const { parent, index } = need('remove', op.id);
        if (!parent) fail('remove', 'cannot remove or move the root');
        parent!.children!.splice(index, 1);
        break;
      }
      case 'move': {
        const { node, parent, index } = need('move', op.id);
        if (!parent) fail('move', 'cannot remove or move the root');
        const dest = container('move', op.parent);
        if (collectIds(node, new Set()).has(dest.id)) fail('move', 'cannot move a node into its own subtree');
        parent!.children!.splice(index, 1);
        dest.children ??= [];
        dest.children.splice(clampIndex(op.index, dest.children.length), 0, node);
        break;
      }
      case 'theme': {
        if (op.preset !== undefined) {
          if (!isPreset(op.preset)) fail('theme', `unknown preset "${String(op.preset)}" (use ${Object.keys(THEME_PRESETS).join(', ')})`);
          next.theme.preset = op.preset as ThemePresetName;
        }
        const merged = { ...next.theme.overrides, ...sanitizeOverrides(op.overrides) };
        if (Object.keys(merged).length) next.theme.overrides = merged;
        break;
      }
      case 'rename': {
        if (typeof op.name !== 'string' || !op.name.trim()) fail('rename', 'name must be a non-empty string');
        next.name = op.name;
        break;
      }
      case 'frame': {
        if (!isFrame(op.frame)) fail('frame', `unknown frame "${String(op.frame)}" (use ${Object.keys(FRAME_SIZES).join(', ')})`);
        next.frame = op.frame;
        break;
      }
      default:
        throw new UiSpecError(at(String((op as { op?: unknown }).op)) + `unknown op "${String((op as { op?: unknown }).op)}"`);
    }
  });

  return normalizeSpec(next);
}

/* ── outlineSpec ──────────────────────────────────────────────────── */

const LAYOUT_OUTLINE_KEYS = ['surface', 'width', 'grow', 'scroll', 'border', 'maxWidth', 'height'];
const PRIMARY_KEYS = ['text', 'title', 'label', 'placeholder', 'name'];
const OUTLINE_EXTRAS: Partial<Record<UiNodeType, string[]>> = {
  heading: ['level'],
  text: ['tone'],
  button: ['variant'],
  toolStep: ['status'],
  artifact: ['kind', 'version'],
  reasoning: ['durationSec', 'streaming'],
  header: ['model', '#actions'],
  composer: ['variant', 'state', '#chips'],
  code: ['language'],
  metric: ['value', 'delta'],
  toast: ['variant'],
  image: ['height'],
  spacer: ['size'],
  suggestions: ['#items', 'layout'],
  sidebarNav: ['#items'],
  sessionList: ['#groups'],
  plan: ['#steps'],
  table: ['#columns', '#rows'],
  terminal: ['#lines'],
  attachments: ['#files'],
};

const flat = (s: string, max = 60) => {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
};

function outlineValue(v: unknown): string | undefined {
  if (typeof v === 'string') {
    const s = flat(v, 30);
    return /\s/.test(s) ? JSON.stringify(s) : s;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return undefined;
}

function outlineLine(node: UiNode): string {
  const props = node.props ?? {};
  const parts: string[] = [`${node.type}#${node.id}`];
  const extras: string[] = [];

  if (isContainer(node.type)) {
    for (const key of LAYOUT_OUTLINE_KEYS) {
      const v = props[key];
      if (v === undefined || v === false || v === 'none') continue;
      extras.push(v === true ? key : `${key}=${outlineValue(v) ?? ''}`);
    }
  } else {
    const key = PRIMARY_KEYS.find((k) => typeof props[k] === 'string' && (props[k] as string).length > 0);
    if (key) parts.push(JSON.stringify(flat(props[key] as string)));
    for (const k of OUTLINE_EXTRAS[node.type] ?? []) {
      if (k.startsWith('#')) {
        const arr = props[k.slice(1)];
        if (Array.isArray(arr)) extras.push(`${k.slice(1)}=${arr.length}`);
      } else if (k !== key) {
        const v = outlineValue(props[k]);
        if (v !== undefined && props[k] !== false) extras.push(props[k] === true ? k : `${k}=${v}`);
      }
    }
  }
  return [...parts, ...extras.slice(0, 3)].join(' ');
}

/**
 * A compact outline for the agent: one line per node, indented, with id,
 * type, and the few props that identify it (text truncated to ~60 chars).
 * Example:
 *   row#root surface=bg
 *     column#sidebar width=260
 *       brand#brand "Acme Agent"
 */
export function outlineSpec(spec: ScreenSpec): string {
  const overrides = Object.keys(spec.theme.overrides ?? {}).length;
  const lines = [
    `screen ${JSON.stringify(spec.name)} frame=${spec.frame} theme=${spec.theme.preset}${overrides ? `(+${overrides} overrides)` : ''}`,
  ];
  const walk = (node: UiNode, depth: number) => {
    lines.push(`${'  '.repeat(depth)}${outlineLine(node)}`);
    for (const child of node.children ?? []) walk(child, depth + 1);
  };
  walk(spec.root, 1);
  return lines.join('\n');
}

/* ── toReactCode ──────────────────────────────────────────────────── */

const SCALE: Record<string, number> = { none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
const RADIUS: Record<string, string> = { none: '0', sm: 'var(--aicl-radius-sm)', md: 'var(--aicl-radius-md)', lg: 'var(--aicl-radius-lg)', xl: 'var(--aicl-radius-xl)' };
const SURFACE: Record<string, string> = {
  bg: 'var(--aicl-bg)',
  surface: 'var(--aicl-surface)',
  sidebar: 'var(--aicl-sidebar)',
  elevated: 'var(--aicl-surface-elevated)',
  inset: 'var(--aicl-surface-inset)',
};
const ALIGN: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', between: 'space-between' };
const FONTS: Record<ThemeTokens['font'], string> = {
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  inter: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  serif: "'Iowan Old Style', Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  rounded: "ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif",
};

const TOOL_STATUSES = ['pending', 'running', 'success', 'error', 'cancelled'];
const PLAN_STATUSES = ['pending', 'running', 'done', 'error'];
const ARTIFACT_KINDS = ['code', 'document', 'diff', 'preview', 'terminal', 'table', 'chart'];

const str = (p: Props, k: string, d = ''): string => (typeof p[k] === 'string' ? (p[k] as string) : typeof p[k] === 'number' ? String(p[k]) : d);
const num = (p: Props, k: string): number | undefined => (typeof p[k] === 'number' && Number.isFinite(p[k]) ? (p[k] as number) : undefined);
const oneOf = (v: unknown, list: string[], d: string): string => (typeof v === 'string' && list.includes(v) ? v : d);
const list = (p: Props, k: string): unknown[] => (Array.isArray(p[k]) ? (p[k] as unknown[]) : []);
const objs = (p: Props, k: string): Props[] => list(p, k).map((x) => (isObject(x) ? x : {}));
const strs = (p: Props, k: string): string[] => list(p, k).map((x) => (typeof x === 'string' || typeof x === 'number' ? String(x) : ''));

const lit = (v: unknown): string => JSON.stringify(v);
const SIMPLE = /^[A-Za-z0-9 .,:;!?_\-/()]*$/;
const attr = (name: string, s: string) => (SIMPLE.test(s) ? `${name}="${s}"` : `${name}={${lit(s)}}`);
const txt = (s: string) => (SIMPLE.test(s) && s === s.trim() && !/ {2}/.test(s) && s.length > 0 ? s : `{${lit(s)}}`);

const pascal = (s: string) => {
  const p = s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join('');
  return /^[A-Za-z]/.test(p) ? p : `Screen${p}`;
};

/** Serialise a style object as a one-line JS object literal. */
function styleLit(style: Record<string, string | number>): string {
  const body = Object.entries(style)
    .map(([k, v]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : lit(k)}: ${typeof v === 'number' ? v : lit(v)}`)
    .join(', ');
  return `{{ ${body} }}`;
}

function layoutStyle(node: UiNode): Record<string, string | number> {
  const p = node.props ?? {};
  const s: Record<string, string | number> = {
    display: 'flex',
    flexDirection: node.type === 'row' ? 'row' : 'column',
    boxSizing: 'border-box',
    minWidth: 0,
  };
  const gap = SCALE[str(p, 'gap')];
  if (gap) s.gap = gap;
  const padding = SCALE[str(p, 'padding')];
  if (padding) s.padding = padding;
  if (ALIGN[str(p, 'align')]) s.alignItems = ALIGN[str(p, 'align')]!;
  if (ALIGN[str(p, 'justify')]) s.justifyContent = ALIGN[str(p, 'justify')]!;
  if (p.grow === true) {
    s.flex = '1 1 0%';
    s.minHeight = 0;
  }
  const width = num(p, 'width');
  if (width !== undefined) {
    s.width = width;
    s.flexShrink = 0;
  }
  const height = num(p, 'height');
  if (height !== undefined) s.height = height;
  const maxWidth = num(p, 'maxWidth');
  if (maxWidth !== undefined) {
    s.maxWidth = maxWidth;
    if (width === undefined) s.width = '100%';
    s.marginInline = 'auto';
  }
  if (SURFACE[str(p, 'surface')]) s.background = SURFACE[str(p, 'surface')]!;
  const border = str(p, 'border');
  if (border === 'all') s.border = '1px solid var(--aicl-border)';
  else if (['top', 'right', 'bottom', 'left'].includes(border)) s[`border${border[0]!.toUpperCase()}${border.slice(1)}`] = '1px solid var(--aicl-border)';
  if (RADIUS[str(p, 'radius')]) s.borderRadius = RADIUS[str(p, 'radius')]!;
  if (p.scroll === true) {
    s.overflowY = 'auto';
    s.minHeight = 0;
  }
  return s;
}

function themeEntries(spec: ScreenSpec): Record<string, string> {
  const t = resolveTheme(spec.theme);
  const r = t.radius;
  return {
    '--aicl-accent': t.accent,
    '--aicl-accent-fg': t.accentFg,
    '--aicl-bg': t.bg,
    '--aicl-surface': t.surface,
    '--aicl-surface-elevated': t.surface,
    '--aicl-surface-inset': t.bg,
    '--aicl-sidebar': t.sidebar,
    '--aicl-text': t.text,
    '--aicl-text-muted': t.textMuted,
    '--aicl-text-faint': `color-mix(in srgb, ${t.textMuted} 60%, ${t.bg})`,
    '--aicl-border': t.border,
    '--aicl-bubble-user': t.bubbleUser,
    '--aicl-radius-sm': `${Math.round(r * 0.6)}px`,
    '--aicl-radius-md': `${r}px`,
    '--aicl-radius-lg': `${Math.round(r * 1.4)}px`,
    '--aicl-radius-xl': `${Math.round(r * 1.8)}px`,
    '--aicl-font-sans': FONTS[t.font],
    colorScheme: t.mode,
  };
}

const STATUS_COLOR: Record<string, string> = {
  running: 'var(--aicl-tool-running)',
  'awaiting-input': 'var(--aicl-warning)',
  error: 'var(--aicl-danger)',
  idle: 'var(--aicl-text-faint)',
};
const PART_CTX = 'message={message} index={0} streaming={false}';
const TOAST_COLOR: Record<string, string> = { info: 'var(--aicl-info)', success: 'var(--aicl-success)', error: 'var(--aicl-danger)' };
const ACTION_GLYPH: Record<string, string> = { share: '↗', more: '⋯', 'panel-right': '▥', settings: '⚙' };

/**
 * A self-contained React + TypeScript module that renders the screen with
 * @aicl/react primitives (and plain elements for layout/text), with the
 * resolved theme applied as --aicl-* CSS variables on the root element.
 */
export function toReactCode(input: ScreenSpec): string {
  const spec = normalizeSpec(input);
  const used = new Set<string>();
  let usesMarkdown = false;
  let usesMessage = false;
  const prim = (name: string) => {
    used.add(name);
    if (name === 'ToolCallDisclosure' || name === 'ArtifactCard') usesMessage = true;
    return name;
  };

  /** Render one node to lines (relative indent `d` levels of two spaces). */
  const render = (node: UiNode, d: number): string[] => {
    const p = node.props ?? {};
    const out: string[] = [];
    const line = (s: string, extra = 0) => out.push(`${'  '.repeat(d + extra)}${s}`);
    const el = (tag: string, style: Record<string, string | number>, content?: string, attrs = '') => {
      const open = `<${tag}${attrs ? ` ${attrs}` : ''} style=${styleLit(style)}`;
      if (content === undefined) line(`${open} />`);
      else line(`${open}>${content}</${tag}>`);
    };

    switch (node.type) {
      case 'row':
      case 'column': {
        const kids = node.children ?? [];
        const style = layoutStyle(node);
        if (node === spec.root) Object.assign(style, { flex: '1 1 0%', minHeight: 0 });
        if (!kids.length) {
          line(`<div style=${styleLit(style)} />`);
        } else {
          line(`<div style=${styleLit(style)}>`);
          for (const k of kids) out.push(...render(k, d + 1));
          line('</div>');
        }
        break;
      }
      case 'brand': {
        const name = str(p, 'name', 'App');
        const mark = str(p, 'mark') || name.slice(0, 1).toUpperCase();
        line(`<div style=${styleLit({ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', fontWeight: 600 })}>`);
        line(`<span style=${styleLit({ display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 'var(--aicl-radius-sm)', background: 'var(--aicl-accent)', color: 'var(--aicl-accent-fg)', fontSize: 12 })}>${txt(mark)}</span>`, 1);
        line(`<span>${txt(name)}</span>`, 1);
        line('</div>');
        break;
      }
      case 'sidebarNav': {
        line(`<nav aria-label="Primary" style=${styleLit({ display: 'flex', flexDirection: 'column', gap: 2 })}>`);
        for (const item of objs(p, 'items')) {
          const active = item.active === true;
          const badge = str(item, 'badge');
          line(
            `<button type="button" style=${styleLit({ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: 0, borderRadius: 'var(--aicl-radius-md)', background: active ? 'var(--aicl-surface-inset)' : 'transparent', color: 'var(--aicl-text)', font: 'inherit', textAlign: 'left', cursor: 'pointer' })}>`,
            1,
          );
          line(`<span style=${styleLit({ flex: 1 })}>${txt(str(item, 'label'))}</span>`, 2);
          if (badge) line(`<span style=${styleLit({ fontSize: 12, color: 'var(--aicl-text-muted)' })}>${txt(badge)}</span>`, 2);
          line('</button>', 1);
        }
        line('</nav>');
        break;
      }
      case 'sessionList': {
        line(`<div style=${styleLit({ display: 'flex', flexDirection: 'column', gap: 12 })}>`);
        for (const g of objs(p, 'groups')) {
          line('<div>', 1);
          const label = str(g, 'label');
          if (label) line(`<div style=${styleLit({ padding: '4px 8px', fontSize: 12, color: 'var(--aicl-text-muted)' })}>${txt(label)}</div>`, 2);
          for (const s of objs(g, 'sessions')) {
            const status = str(s, 'status', 'idle');
            const secondary = str(s, 'statusLine') || str(s, 'preview');
            line(
              `<div style=${styleLit({ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 8px', borderRadius: 'var(--aicl-radius-md)', background: s.active === true ? 'var(--aicl-surface-inset)' : 'transparent' })}>`,
              2,
            );
            line(`<div style=${styleLit({ display: 'flex', alignItems: 'center', gap: 6, fontWeight: s.unread === true ? 600 : 400 })}>`, 3);
            line(`<span aria-hidden="true" style=${styleLit({ width: 6, height: 6, borderRadius: 999, background: STATUS_COLOR[status] ?? STATUS_COLOR.idle! })} />`, 4);
            line(`<span style=${styleLit({ flex: 1 })}>${txt(str(s, 'title'))}</span>`, 4);
            if (str(s, 'time')) line(`<span style=${styleLit({ fontSize: 12, color: 'var(--aicl-text-faint)' })}>${txt(str(s, 'time'))}</span>`, 4);
            line('</div>', 3);
            if (secondary) line(`<div style=${styleLit({ fontSize: 12, color: 'var(--aicl-text-muted)' })}>${txt(secondary)}</div>`, 3);
            line('</div>', 2);
          }
          line('</div>', 1);
        }
        line('</div>');
        break;
      }
      case 'header': {
        line(`<header style=${styleLit({ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--aicl-border)' })}>`);
        line(`<div style=${styleLit({ flex: 1, minWidth: 0 })}>`, 1);
        line(`<div style=${styleLit({ fontWeight: 600 })}>${txt(str(p, 'title'))}</div>`, 2);
        if (str(p, 'subtitle')) line(`<div style=${styleLit({ fontSize: 12, color: 'var(--aicl-text-muted)' })}>${txt(str(p, 'subtitle'))}</div>`, 2);
        line('</div>', 1);
        if (str(p, 'model'))
          line(`<span style=${styleLit({ padding: '2px 10px', fontSize: 12, border: '1px solid var(--aicl-border)', borderRadius: 999, color: 'var(--aicl-text-muted)' })}>${txt(str(p, 'model'))}</span>`, 1);
        for (const a of strs(p, 'actions')) {
          const glyph = ACTION_GLYPH[a] ?? (a.slice(0, 1).toUpperCase() || '·');
          line(
            `<button type="button" ${attr('aria-label', a)} style=${styleLit({ width: 28, height: 28, border: 0, borderRadius: 'var(--aicl-radius-md)', background: 'transparent', color: 'var(--aicl-text-muted)', cursor: 'pointer' })}>${txt(glyph)}</button>`,
            1,
          );
        }
        line('</header>');
        break;
      }
      case 'userMessage':
        el('div', { alignSelf: 'flex-end', maxWidth: '80%', padding: '8px 14px', borderRadius: 'var(--aicl-radius-lg)', background: 'var(--aicl-bubble-user)', whiteSpace: 'pre-wrap' }, txt(str(p, 'text')));
        break;
      case 'assistantMessage': {
        usesMarkdown = true;
        line('<div>');
        line(`<Markdown text={${lit(str(p, 'text'))}} />`, 1);
        if (p.actions === true) {
          line(`<div style=${styleLit({ display: 'flex', gap: 8, marginTop: 6, fontSize: 12, color: 'var(--aicl-text-muted)' })}>`, 1);
          for (const a of ['Copy', 'Retry']) line(`<button type="button" style=${styleLit({ border: 0, background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer' })}>${a}</button>`, 2);
          line('</div>', 1);
        }
        line('</div>');
        break;
      }
      case 'reasoning': {
        const sec = num(p, 'durationSec');
        const part = [`type: 'reasoning'`, `text: ${lit(str(p, 'text'))}`, ...(sec !== undefined ? [`durationMs: ${Math.round(sec * 1000)}`] : [])];
        line(`<${prim('ReasoningDisclosure')} part={{ ${part.join(', ')} }} streaming={${p.streaming === true}} />`);
        break;
      }
      case 'toolStep': {
        const status = oneOf(p.status, TOOL_STATUSES, 'success');
        line(`<${prim('ToolCallDisclosure')} part={{ type: 'tool-call', toolCallId: ${lit(node.id)}, name: ${lit(str(p, 'label'))}, args: {}, status: ${lit(status)} }} ${PART_CTX} />`);
        break;
      }
      case 'plan': {
        const items = objs(p, 'steps').map((s, i) => `{ id: ${lit(String(i + 1))}, label: ${lit(str(s, 'label'))}, status: ${lit(oneOf(s.status, PLAN_STATUSES, 'pending'))} }`);
        line(`<${prim('PlanChecklist')}${str(p, 'title') ? ` ${attr('title', str(p, 'title'))}` : ''}`);
        line('items={[', 1);
        for (const it of items) line(`${it},`, 2);
        line(']}', 1);
        line('/>');
        break;
      }
      case 'artifact': {
        const v = num(p, 'version');
        line(`<${prim('ArtifactCard')} part={{ type: 'artifact', artifactId: ${lit(node.id)}, kind: ${lit(oneOf(p.kind, ARTIFACT_KINDS, 'document'))}, title: ${lit(str(p, 'title'))}${v !== undefined ? `, version: ${v}` : ''} }} ${PART_CTX} onOpen={() => {}} />`);
        break;
      }
      case 'code':
        line(`<${prim('CodeBlock')} content={${lit(str(p, 'content'))}}${str(p, 'language') ? ` ${attr('language', str(p, 'language'))}` : ''} />`);
        break;
      case 'terminal':
        line(`<${prim('TerminalOutput')} lines={${lit(strs(p, 'lines'))}} />`);
        break;
      case 'statusLine':
        el('div', { fontSize: 13, color: 'var(--aicl-text-faint)' }, txt(str(p, 'text')));
        break;
      case 'composer': {
        const hero = p.variant === 'hero';
        line(`<div style=${styleLit({ boxSizing: 'border-box', width: '100%', maxWidth: 760, marginInline: 'auto', padding: '0 16px 16px' })}>`);
        const attrs = [
          'onSubmit={() => {}}',
          ...(str(p, 'placeholder') ? [attr('placeholder', str(p, 'placeholder'))] : []),
          ...(p.state === 'streaming' ? ['status="streaming"', 'onStop={() => {}}'] : []),
          ...(hero ? ['placement="hero"'] : []),
          ...(p.attach === true ? ['onAttach={() => {}}'] : []),
          ...(strs(p, 'chips').length ? [`suggestions={${lit(strs(p, 'chips'))}}`] : []),
        ];
        line(`<${prim('Composer')} ${attrs.join(' ')} />`, 1);
        line('</div>');
        break;
      }
      case 'suggestions': {
        const items = strs(p, 'items');
        if (p.layout === 'rows') {
          line(`<div style=${styleLit({ display: 'flex', flexDirection: 'column' })}>`);
          for (const it of items)
            line(`<button type="button" style=${styleLit({ padding: '10px 4px', border: 0, borderBottom: '1px solid var(--aicl-border)', background: 'transparent', color: 'var(--aicl-text)', font: 'inherit', textAlign: 'left', cursor: 'pointer' })}>${txt(it)}</button>`, 1);
          line('</div>');
        } else {
          line(`<${prim('SuggestionChips')} suggestions={[${items.map((it, i) => `{ id: ${lit(String(i + 1))}, label: ${lit(it)} }`).join(', ')}]} onSelect={() => {}} />`);
        }
        break;
      }
      case 'attachments': {
        line(`<div style=${styleLit({ display: 'flex', flexWrap: 'wrap', gap: 8 })}>`);
        objs(p, 'files').forEach((f, i) =>
          line(`<${prim('AttachmentChip')} attachment={{ id: ${lit(String(i + 1))}, name: ${lit(str(f, 'name'))}, mediaType: 'application/octet-stream', status: ${lit(oneOf(f.status, ['uploading', 'ready', 'error'], 'ready'))} }} />`, 1),
        );
        line('</div>');
        break;
      }
      case 'heading': {
        const level = [1, 2, 3].includes(num(p, 'level') ?? 0) ? num(p, 'level')! : 2;
        el(`h${level}`, { margin: 0, fontSize: level === 1 ? 28 : level === 2 ? 22 : 17, fontWeight: 600, textAlign: p.align === 'center' ? 'center' : 'start' }, txt(str(p, 'text')));
        break;
      }
      case 'text': {
        const tone = str(p, 'tone', 'default');
        const size = { xs: 12, sm: 13, md: 15, lg: 18 }[str(p, 'size') as 'xs'] ?? 15;
        el('p', { margin: 0, fontSize: size, color: tone === 'muted' ? 'var(--aicl-text-muted)' : tone === 'faint' ? 'var(--aicl-text-faint)' : 'var(--aicl-text)', textAlign: p.align === 'center' ? 'center' : 'start' }, txt(str(p, 'text')));
        break;
      }
      case 'button': {
        const v = str(p, 'variant', 'primary');
        const style: Record<string, string | number> = { alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 'var(--aicl-radius-md)', font: 'inherit', cursor: 'pointer' };
        if (v === 'primary') Object.assign(style, { border: 0, background: 'var(--aicl-accent)', color: 'var(--aicl-accent-fg)' });
        else if (v === 'secondary') Object.assign(style, { border: '1px solid var(--aicl-border)', background: 'var(--aicl-surface)', color: 'var(--aicl-text)' });
        else Object.assign(style, { border: 0, background: 'transparent', color: 'var(--aicl-text)' });
        el('button', style, txt(str(p, 'label')), 'type="button"');
        break;
      }
      case 'table': {
        const cell = { padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--aicl-border)' };
        line(`<table style=${styleLit({ borderCollapse: 'collapse', fontSize: 14, width: '100%' })}>`);
        line('<thead>', 1);
        line('<tr>', 2);
        for (const c of strs(p, 'columns')) line(`<th style=${styleLit(cell)}>${txt(c)}</th>`, 3);
        line('</tr>', 2);
        line('</thead>', 1);
        line('<tbody>', 1);
        for (const r of list(p, 'rows')) {
          line('<tr>', 2);
          for (const c of Array.isArray(r) ? r : []) line(`<td style=${styleLit(cell)}>${txt(String(c ?? ''))}</td>`, 3);
          line('</tr>', 2);
        }
        line('</tbody>', 1);
        line('</table>');
        break;
      }
      case 'metric': {
        const trend = str(p, 'trend');
        line(`<div style=${styleLit({ display: 'flex', flexDirection: 'column', gap: 2 })}>`);
        line(`<span style=${styleLit({ fontSize: 12, color: 'var(--aicl-text-muted)' })}>${txt(str(p, 'label'))}</span>`, 1);
        line(`<span style=${styleLit({ fontSize: 28, fontWeight: 600 })}>${txt(str(p, 'value'))}</span>`, 1);
        if (str(p, 'delta'))
          line(`<span style=${styleLit({ fontSize: 12, color: trend === 'up' ? 'var(--aicl-success)' : trend === 'down' ? 'var(--aicl-danger)' : 'var(--aicl-text-muted)' })}>${txt(str(p, 'delta'))}</span>`, 1);
        line('</div>');
        break;
      }
      case 'toast': {
        const variant = oneOf(p.variant, ['info', 'success', 'error'], 'info');
        line(`<div role="status" style=${styleLit({ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid var(--aicl-border)', borderLeft: `3px solid ${TOAST_COLOR[variant]!}`, borderRadius: 'var(--aicl-radius-md)', background: 'var(--aicl-surface-elevated)' })}>`);
        line(`<div style=${styleLit({ flex: 1 })}>`, 1);
        line(`<div style=${styleLit({ fontWeight: 600 })}>${txt(str(p, 'title'))}</div>`, 2);
        if (str(p, 'description')) line(`<div style=${styleLit({ fontSize: 13, color: 'var(--aicl-text-muted)' })}>${txt(str(p, 'description'))}</div>`, 2);
        line('</div>', 1);
        if (str(p, 'action')) line(`<button type="button" style=${styleLit({ border: 0, background: 'transparent', color: 'var(--aicl-text-link)', font: 'inherit', cursor: 'pointer' })}>${txt(str(p, 'action'))}</button>`, 1);
        line('</div>');
        break;
      }
      case 'emptyState': {
        line(`<div style=${styleLit({ flex: '1 1 0%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center' })}>`);
        line(`<div style=${styleLit({ fontSize: 20, fontWeight: 600 })}>${txt(str(p, 'title'))}</div>`, 1);
        if (str(p, 'hint')) line(`<div style=${styleLit({ color: 'var(--aicl-text-muted)' })}>${txt(str(p, 'hint'))}</div>`, 1);
        line('</div>');
        break;
      }
      case 'image': {
        line(`<div style=${styleLit({ display: 'grid', placeItems: 'center', height: num(p, 'height') ?? 160, border: '1px dashed var(--aicl-border)', borderRadius: 'var(--aicl-radius-md)', background: 'var(--aicl-surface-inset)', color: 'var(--aicl-text-faint)', fontSize: 13 })}>${txt(str(p, 'label', 'Image'))}</div>`);
        break;
      }
      case 'divider':
        line(`<hr style=${styleLit({ width: '100%', margin: 0, border: 0, borderTop: '1px solid var(--aicl-border)' })} />`);
        break;
      case 'spacer': {
        const size = num(p, 'size');
        line(`<div style=${styleLit({ flex: size !== undefined ? `0 0 ${size}px` : '1 1 0%' })} />`);
        break;
      }
    }
    return out;
  };

  const body = render(spec.root, 3);
  const size = FRAME_SIZES[spec.frame];
  const themeLines = Object.entries(themeEntries(spec)).map(([k, v]) => `  ${/^[A-Za-z_$][\w$]*$/.test(k) ? k : lit(k)}: ${lit(v)},`);
  const fontKey = resolveTheme(spec.theme).density;

  const imports: string[] = [];
  imports.push(`import type { CSSProperties } from 'react';`);
  if (used.size) imports.push(`import { ${[...used].sort().join(', ')} } from '@aicl/react';`);
  if (usesMessage) imports.push(`import type { Message } from '@aicl/core';`);
  if (usesMarkdown) imports.push(`import { Markdown } from '@aicl/react/markdown';`);

  return [
    `// Generated from the "${spec.name.replace(/[\r\n*]/g, ' ')}" design. Import '@aicl/styles' once in your app.`,
    ...imports,
    '',
    'const theme: CSSProperties & Record<string, string> = {',
    ...themeLines,
    '};',
    ...(usesMessage ? ['', `const message: Message = { id: 'static', role: 'assistant', parts: [] };`] : []),
    '',
    `export default function ${pascal(spec.name)}Screen() {`,
    '  return (',
    `    <div data-density="${fontKey}" style={{ ...theme, display: 'flex', width: '100%', height: '100vh', background: 'var(--aicl-bg)', color: 'var(--aicl-text)', fontFamily: 'var(--aicl-font-sans)' }}>`,
    `      {/* designed at ${size.w}×${size.h} */}`,
    ...body.map((l) => l),
    '    </div>',
    '  );',
    '}',
    '',
  ].join('\n');
}
