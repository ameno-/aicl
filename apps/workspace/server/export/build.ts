/**
 * Screen spec → exportable app model: a static element tree with two live
 * slots (thread, composer), the designed conversation as seed messages, and
 * the resolved theme as CSS variables.
 *
 * The thread is the container holding the most conversation elements; its
 * designed messages become the live transcript's first messages, so the
 * exported app opens looking exactly like the design and keeps working.
 */
import { renderMarkdown } from '../../templates/shared/chat.js';
import type { Message, Part } from '../../templates/shared/chat.js';
import {
  ACTION_GLYPH,
  ARTIFACT_KINDS,
  layoutStyle,
  list,
  normalizeSpec,
  num,
  objs,
  oneOf,
  PLAN_STATUSES,
  STATUS_COLOR,
  str,
  strs,
  themeEntries,
  TOAST_COLOR,
  TOOL_STATUSES,
} from '../../shared/ui-ops.ts';
import { FRAME_SIZES, resolveTheme, type ScreenSpec, type UiNode } from '../../shared/ui-spec.ts';
import { el, toHtml, type ComposerSlotProps, type Style, type VNode } from './vnode.ts';

export interface AppModel {
  name: string;
  /** The screen root, with the thread and composer as slots. */
  tree: VNode;
  seedMessages: Message[];
  /** --aicl-* variables and color-scheme for the app root. */
  themeVars: Record<string, string>;
  mode: 'light' | 'dark';
  designedAt: { w: number; h: number };
}

const MESSAGE_TYPES = new Set(['userMessage', 'assistantMessage', 'reasoning', 'toolStep', 'artifact', 'statusLine']);
const CONVERSATIONAL = new Set(['userMessage', 'assistantMessage']);

/** Variables the static elements read that a screen theme does not set. */
const SEMANTIC_VARS: Record<string, string> = {
  '--aicl-success': '#16a34a',
  '--aicl-warning': '#d97706',
  '--aicl-danger': '#dc2626',
  '--aicl-info': '#2563eb',
  '--aicl-tool-running': 'var(--aicl-accent)',
  '--aicl-text-link': 'var(--aicl-accent)',
};

function findThread(root: UiNode): UiNode | null {
  let best: UiNode | null = null;
  let bestScore = 0;
  const walk = (node: UiNode) => {
    const kids = node.children ?? [];
    const talk = kids.filter((k) => CONVERSATIONAL.has(k.type)).length;
    const score = talk ? talk * 10 + kids.filter((k) => MESSAGE_TYPES.has(k.type)).length : 0;
    if (score > bestScore) [best, bestScore] = [node, score];
    kids.forEach(walk);
  };
  walk(root);
  return best;
}

function findFirst(node: UiNode, type: string): UiNode | null {
  if (node.type === type) return node;
  for (const k of node.children ?? []) {
    const hit = findFirst(k, type);
    if (hit) return hit;
  }
  return null;
}

function composerProps(node: UiNode | null): ComposerSlotProps {
  const p = node?.props ?? {};
  const placeholder = str(p, 'placeholder');
  const suggestions = strs(p, 'chips').filter(Boolean);
  return {
    ...(placeholder ? { placeholder } : {}),
    ...(suggestions.length ? { suggestions } : {}),
    ...(p.variant === 'hero' ? { variant: 'hero' as const } : {}),
  };
}

/** Designed thread children → seed messages. Non-message elements become pre-rendered `html` parts. */
function seedsFrom(children: UiNode[]): Message[] {
  const out: Message[] = [];
  const assistant = (): Message => {
    const last = out[out.length - 1];
    if (last?.role === 'assistant') return last;
    const m: Message = { id: `seed-${out.length + 1}`, role: 'assistant', parts: [], seed: true };
    out.push(m);
    return m;
  };
  for (const node of children) {
    const p = node.props ?? {};
    let part: Part | null = null;
    switch (node.type) {
      case 'composer':
        continue;
      case 'userMessage':
        out.push({ id: `seed-${out.length + 1}`, role: 'user', parts: [{ type: 'text', text: str(p, 'text') }], seed: true });
        continue;
      case 'assistantMessage':
        part = { type: 'text', text: str(p, 'text') };
        break;
      case 'reasoning': {
        const sec = num(p, 'durationSec');
        part = { type: 'reasoning', text: str(p, 'text'), ...(sec !== undefined ? { durationMs: Math.round(sec * 1000) } : {}) };
        break;
      }
      case 'toolStep':
        part = { type: 'tool-call', toolCallId: node.id, name: str(p, 'label'), args: {}, status: oneOf(p.status, TOOL_STATUSES, 'success') as 'success' };
        break;
      case 'artifact': {
        const v = num(p, 'version');
        part = { type: 'artifact', artifactId: node.id, kind: oneOf(p.kind, ARTIFACT_KINDS, 'document'), title: str(p, 'title'), ...(v !== undefined ? { version: v } : {}) };
        break;
      }
      default:
        part = { type: 'html', html: toHtml(staticNode(node)) };
    }
    assistant().parts.push(part);
  }
  return out;
}

/** One designed element as static markup with inline styles (no live behaviour). */
export function staticNode(node: UiNode): VNode {
  const p = node.props ?? {};
  const muted: Style = { fontSize: 12, color: 'var(--aicl-text-muted)' };
  switch (node.type) {
    case 'row':
    case 'column':
      return el('div', layoutStyle(node), (node.children ?? []).map(staticNode));
    case 'brand': {
      const name = str(p, 'name', 'App');
      const mark = str(p, 'mark') || name.slice(0, 1).toUpperCase();
      return el('div', { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', fontWeight: 600 }, [
        el('span', { display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 'var(--aicl-radius-sm)', background: 'var(--aicl-accent)', color: 'var(--aicl-accent-fg)', fontSize: 12 }, mark),
        el('span', undefined, name),
      ]);
    }
    case 'sidebarNav':
      return el(
        'nav',
        { display: 'flex', flexDirection: 'column', gap: 2 },
        objs(p, 'items').map((item) =>
          el(
            'button',
            { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: 0, borderRadius: 'var(--aicl-radius-md)', background: item.active === true ? 'var(--aicl-surface-inset)' : 'transparent', color: 'var(--aicl-text)', font: 'inherit', textAlign: 'left', cursor: 'pointer' },
            [el('span', { flex: 1 }, str(item, 'label')), ...(str(item, 'badge') ? [el('span', muted, str(item, 'badge'))] : [])],
            { type: 'button' },
          ),
        ),
        { 'aria-label': 'Primary' },
      );
    case 'sessionList':
      return el(
        'div',
        { display: 'flex', flexDirection: 'column', gap: 12 },
        objs(p, 'groups').map((g) =>
          el('div', undefined, [
            ...(str(g, 'label') ? [el('div', { padding: '4px 8px', ...muted }, str(g, 'label'))] : []),
            ...objs(g, 'sessions').map((s) => {
              const secondary = str(s, 'statusLine') || str(s, 'preview');
              return el('div', { display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 8px', borderRadius: 'var(--aicl-radius-md)', background: s.active === true ? 'var(--aicl-surface-inset)' : 'transparent' }, [
                el('div', { display: 'flex', alignItems: 'center', gap: 6, fontWeight: s.unread === true ? 600 : 400 }, [
                  el('span', { width: 6, height: 6, flexShrink: 0, borderRadius: 999, background: STATUS_COLOR[str(s, 'status', 'idle')] ?? STATUS_COLOR.idle! }, undefined, { 'aria-hidden': 'true' }),
                  el('span', { flex: 1 }, str(s, 'title')),
                  ...(str(s, 'time') ? [el('span', { fontSize: 12, color: 'var(--aicl-text-faint)' }, str(s, 'time'))] : []),
                ]),
                ...(secondary ? [el('div', muted, secondary)] : []),
              ]);
            }),
          ]),
        ),
      );
    case 'header':
      return el('header', { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--aicl-border)' }, [
        el('div', { flex: 1, minWidth: 0 }, [el('div', { fontWeight: 600 }, str(p, 'title')), ...(str(p, 'subtitle') ? [el('div', muted, str(p, 'subtitle'))] : [])]),
        ...(str(p, 'model') ? [el('span', { padding: '2px 10px', fontSize: 12, border: '1px solid var(--aicl-border)', borderRadius: 999, color: 'var(--aicl-text-muted)' }, str(p, 'model'))] : []),
        ...strs(p, 'actions').map((a) =>
          el('button', { width: 28, height: 28, border: 0, borderRadius: 'var(--aicl-radius-md)', background: 'transparent', color: 'var(--aicl-text-muted)', cursor: 'pointer' }, ACTION_GLYPH[a] ?? (a.slice(0, 1).toUpperCase() || '·'), { type: 'button', 'aria-label': a }),
        ),
      ]);
    case 'userMessage':
      return el('div', { alignSelf: 'flex-end', maxWidth: '80%', padding: '8px 14px', borderRadius: 'var(--aicl-radius-lg)', background: 'var(--aicl-bubble-user)', whiteSpace: 'pre-wrap' }, str(p, 'text'));
    case 'assistantMessage':
      return { kind: 'el', tag: 'div', style: { lineHeight: 1.55 }, html: renderMarkdown(str(p, 'text')) };
    case 'reasoning': {
      const sec = num(p, 'durationSec');
      return el('div', { fontSize: 13, color: 'var(--aicl-text-muted)' }, sec ? `Thought for ${Math.max(1, Math.round(sec))}s` : 'Thought');
    }
    case 'toolStep': {
      const status = oneOf(p.status, TOOL_STATUSES, 'success');
      const color = status === 'error' ? 'var(--aicl-danger)' : status === 'success' ? 'var(--aicl-success)' : 'var(--aicl-accent)';
      return el('div', { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--aicl-text-muted)' }, [
        el('span', { width: 7, height: 7, flexShrink: 0, borderRadius: 999, background: color }, undefined, { 'aria-hidden': 'true' }),
        el('span', undefined, str(p, 'label')),
      ]);
    }
    case 'plan': {
      const steps = objs(p, 'steps');
      const done = steps.filter((s) => s.status === 'done').length;
      const mark: Record<string, string> = { done: '✓', running: '◐', error: '✕', pending: '○' };
      return el('div', { display: 'flex', flexDirection: 'column', gap: 6, padding: 12, border: '1px solid var(--aicl-border)', borderRadius: 'var(--aicl-radius-md)', background: 'var(--aicl-surface)' }, [
        el('div', { display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }, [el('span', undefined, str(p, 'title', 'Plan')), el('span', { color: 'var(--aicl-text-muted)' }, `${done}/${steps.length}`)]),
        el(
          'ol',
          { display: 'flex', flexDirection: 'column', gap: 4, margin: 0, padding: 0, listStyle: 'none', fontSize: 13 },
          steps.map((s) => {
            const status = oneOf(s.status, PLAN_STATUSES, 'pending');
            return el('li', { display: 'flex', gap: 8, color: status === 'done' ? 'var(--aicl-text-muted)' : 'var(--aicl-text)' }, [el('span', { width: 14, color: status === 'error' ? 'var(--aicl-danger)' : 'var(--aicl-text-muted)' }, mark[status]!), el('span', undefined, str(s, 'label'))]);
          }),
        ),
      ]);
    }
    case 'artifact': {
      const v = num(p, 'version');
      return el('div', { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--aicl-border)', borderRadius: 'var(--aicl-radius-md)', background: 'var(--aicl-surface)' }, [
        el('span', { padding: '1px 8px', borderRadius: 999, fontSize: 11, background: 'var(--aicl-surface-inset)', color: 'var(--aicl-text-muted)', textTransform: 'uppercase' }, oneOf(p.kind, ARTIFACT_KINDS, 'document')),
        el('span', { flex: 1, fontWeight: 600 }, str(p, 'title')),
        ...(v !== undefined ? [el('span', muted, `v${v}`)] : []),
      ]);
    }
    case 'code':
      return el('figure', { margin: 0, border: '1px solid var(--aicl-border)', borderRadius: 'var(--aicl-radius-md)', background: 'var(--aicl-surface-inset)', overflow: 'hidden' }, [
        ...(str(p, 'language') ? [el('figcaption', { padding: '4px 10px', borderBottom: '1px solid var(--aicl-border)', ...muted }, str(p, 'language'))] : []),
        el('pre', { margin: 0, padding: '10px 12px', overflowX: 'auto', fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: 13 }, [el('code', undefined, str(p, 'content'))]),
      ]);
    case 'terminal':
      return el(
        'pre',
        { margin: 0, padding: '10px 12px', borderRadius: 'var(--aicl-radius-md)', background: '#0f1115', color: '#e5e7eb', fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: 12.5, overflowX: 'auto' },
        strs(p, 'lines').join('\n'),
      );
    case 'statusLine':
      return el('div', { fontSize: 13, color: 'var(--aicl-text-faint)' }, str(p, 'text'));
    case 'composer':
      return el('div', { padding: 12, border: '1px solid var(--aicl-border)', borderRadius: 'var(--aicl-radius-xl)', color: 'var(--aicl-text-faint)' }, str(p, 'placeholder', 'Message'));
    case 'suggestions': {
      const items = strs(p, 'items');
      if (p.layout === 'rows')
        return el('div', { display: 'flex', flexDirection: 'column' }, items.map((it) => el('button', { padding: '10px 4px', border: 0, borderBottom: '1px solid var(--aicl-border)', background: 'transparent', color: 'var(--aicl-text)', font: 'inherit', textAlign: 'left', cursor: 'pointer' }, it, { type: 'button' })));
      return el('div', { display: 'flex', flexWrap: 'wrap', gap: 6 }, items.map((it) => el('button', { padding: '4px 10px', border: '1px solid var(--aicl-border)', borderRadius: 999, background: 'var(--aicl-surface)', color: 'var(--aicl-text)', font: 'inherit', fontSize: 13, cursor: 'pointer' }, it, { type: 'button' })));
    }
    case 'attachments':
      return el('div', { display: 'flex', flexWrap: 'wrap', gap: 8 }, objs(p, 'files').map((f) => el('span', { padding: '4px 10px', border: '1px solid var(--aicl-border)', borderRadius: 'var(--aicl-radius-md)', fontSize: 13 }, str(f, 'name'))));
    case 'heading': {
      const level = [1, 2, 3].includes(num(p, 'level') ?? 0) ? num(p, 'level')! : 2;
      return el(`h${level}`, { margin: 0, fontSize: level === 1 ? 28 : level === 2 ? 22 : 17, fontWeight: 600, textAlign: p.align === 'center' ? 'center' : 'start' }, str(p, 'text'));
    }
    case 'text': {
      const tone = str(p, 'tone', 'default');
      const size = ({ xs: 12, sm: 13, md: 15, lg: 18 } as Record<string, number>)[str(p, 'size')] ?? 15;
      return el('p', { margin: 0, fontSize: size, color: tone === 'muted' ? 'var(--aicl-text-muted)' : tone === 'faint' ? 'var(--aicl-text-faint)' : 'var(--aicl-text)', textAlign: p.align === 'center' ? 'center' : 'start' }, str(p, 'text'));
    }
    case 'button': {
      const v = str(p, 'variant', 'primary');
      const style: Style = { alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 'var(--aicl-radius-md)', font: 'inherit', cursor: 'pointer' };
      if (v === 'primary') Object.assign(style, { border: 0, background: 'var(--aicl-accent)', color: 'var(--aicl-accent-fg)' });
      else if (v === 'secondary') Object.assign(style, { border: '1px solid var(--aicl-border)', background: 'var(--aicl-surface)', color: 'var(--aicl-text)' });
      else Object.assign(style, { border: 0, background: 'transparent', color: 'var(--aicl-text)' });
      return el('button', style, str(p, 'label'), { type: 'button' });
    }
    case 'table': {
      const cell: Style = { padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--aicl-border)' };
      return el('table', { borderCollapse: 'collapse', fontSize: 14, width: '100%' }, [
        el('thead', undefined, [el('tr', undefined, strs(p, 'columns').map((c) => el('th', cell, c)))]),
        el('tbody', undefined, list(p, 'rows').map((r) => el('tr', undefined, (Array.isArray(r) ? r : []).map((c) => el('td', cell, String(c ?? '')))))),
      ]);
    }
    case 'metric': {
      const trend = str(p, 'trend');
      return el('div', { display: 'flex', flexDirection: 'column', gap: 2 }, [
        el('span', muted, str(p, 'label')),
        el('span', { fontSize: 28, fontWeight: 600 }, str(p, 'value')),
        ...(str(p, 'delta') ? [el('span', { fontSize: 12, color: trend === 'up' ? 'var(--aicl-success)' : trend === 'down' ? 'var(--aicl-danger)' : 'var(--aicl-text-muted)' }, str(p, 'delta'))] : []),
      ]);
    }
    case 'toast': {
      const variant = oneOf(p.variant, ['info', 'success', 'error'], 'info');
      return el('div', { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid var(--aicl-border)', borderLeft: `3px solid ${TOAST_COLOR[variant]!}`, borderRadius: 'var(--aicl-radius-md)', background: 'var(--aicl-surface-elevated)' }, [
        el('div', { flex: 1 }, [el('div', { fontWeight: 600 }, str(p, 'title')), ...(str(p, 'description') ? [el('div', { fontSize: 13, color: 'var(--aicl-text-muted)' }, str(p, 'description'))] : [])]),
        ...(str(p, 'action') ? [el('button', { border: 0, background: 'transparent', color: 'var(--aicl-text-link)', font: 'inherit', cursor: 'pointer' }, str(p, 'action'), { type: 'button' })] : []),
      ], { role: 'status' });
    }
    case 'emptyState':
      return el('div', { flex: '1 1 0%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center' }, [
        el('div', { fontSize: 20, fontWeight: 600 }, str(p, 'title')),
        ...(str(p, 'hint') ? [el('div', { color: 'var(--aicl-text-muted)' }, str(p, 'hint'))] : []),
      ]);
    case 'image':
      return el('div', { display: 'grid', placeItems: 'center', height: num(p, 'height') ?? 160, border: '1px dashed var(--aicl-border)', borderRadius: 'var(--aicl-radius-md)', background: 'var(--aicl-surface-inset)', color: 'var(--aicl-text-faint)', fontSize: 13 }, str(p, 'label', 'Image'));
    case 'divider':
      return el('hr', { width: '100%', margin: 0, border: 0, borderTop: '1px solid var(--aicl-border)' });
    case 'spacer': {
      const size = num(p, 'size');
      return el('div', { flex: size !== undefined ? `0 0 ${size}px` : '1 1 0%' });
    }
    default:
      return el('div');
  }
}

/** The screen as an app: static layout around a live thread and composer. */
export function buildApp(input: ScreenSpec): AppModel {
  const spec = normalizeSpec(input);
  const thread = findThread(spec.root);
  const composer = findFirst(spec.root, 'composer');
  const composerSlot: VNode = { kind: 'slot', slot: 'composer', props: composerProps(composer) };
  let placedThread = false;
  let placedComposer = false;

  const convert = (node: UiNode): VNode => {
    if (node === thread) {
      placedThread = true;
      const kids: VNode[] = [{ kind: 'slot', slot: 'thread' }];
      if (composer && (node.children ?? []).includes(composer)) {
        kids.push(composerSlot);
        placedComposer = true;
      }
      return el('div', layoutStyle(node), kids);
    }
    if (node === composer) {
      placedComposer = true;
      return thread || placedThread ? composerSlot : el('div', { display: 'contents' }, [{ kind: 'slot', slot: 'thread' }, composerSlot]);
    }
    if (node.type === 'row' || node.type === 'column') return el('div', layoutStyle(node), (node.children ?? []).map(convert));
    return staticNode(node);
  };

  let tree = convert(spec.root);
  if (!thread && composer) placedThread = true; // placed with the composer above
  if (!placedThread || !placedComposer) {
    const extra: VNode[] = [];
    if (!placedThread) extra.push(el('div', { display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0, overflowY: 'auto', padding: 16, gap: 12 }, [{ kind: 'slot', slot: 'thread' }]));
    if (!placedComposer) extra.push(composerSlot);
    tree = el('div', { display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0 }, [tree, ...extra]);
  }
  if (tree.kind === 'el') tree.style = { ...tree.style, flex: '1 1 0%', minHeight: 0 };

  const theme = resolveTheme(spec.theme);
  const { colorScheme, ...vars } = themeEntries(spec);
  return {
    name: spec.name,
    tree,
    seedMessages: thread ? seedsFrom(thread.children ?? []) : [],
    themeVars: { ...SEMANTIC_VARS, ...vars },
    mode: (colorScheme as 'light' | 'dark') ?? theme.mode,
    designedAt: { w: FRAME_SIZES[spec.frame].w, h: FRAME_SIZES[spec.frame].h },
  };
}
