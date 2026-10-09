/**
 * A framework-neutral element tree for exported screens, and its printers:
 * HTML (also the base for Vue and Svelte templates), JSX, and JSX with
 * Tailwind classes instead of inline styles. Live regions are slots that each
 * target fills with its own Thread and Composer components.
 */

export type Style = Record<string, string | number>;

export interface ComposerSlotProps {
  placeholder?: string;
  suggestions?: string[];
  variant?: 'docked' | 'hero';
}

export type VNode =
  | {
      kind: 'el';
      tag: string;
      style?: Style;
      attrs?: Record<string, string | true>;
      children?: VNode[];
      /** Trusted, already-escaped HTML for the element's content (rendered Markdown). */
      html?: string;
    }
  | { kind: 'text'; text: string }
  | { kind: 'slot'; slot: 'thread' }
  | { kind: 'slot'; slot: 'composer'; props: ComposerSlotProps };

export const el = (tag: string, style?: Style, children?: VNode[] | string, attrs?: Record<string, string | true>): VNode => ({
  kind: 'el',
  tag,
  ...(style && Object.keys(style).length ? { style } : {}),
  ...(attrs ? { attrs } : {}),
  ...(typeof children === 'string' ? { children: [{ kind: 'text', text: children }] } : children?.length ? { children } : {}),
});

const VOID = new Set(['hr', 'br', 'img', 'input']);
const UNITLESS = new Set(['flex', 'flexGrow', 'flexShrink', 'fontWeight', 'lineHeight', 'opacity', 'zIndex', 'order']);

const kebab = (key: string) => (key.startsWith('--') ? key : key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));
const cssValue = (key: string, value: string | number) => (typeof value === 'number' && !UNITLESS.has(key) && value !== 0 ? `${value}px` : String(value));

export function styleToCss(style: Style): string {
  return Object.entries(style)
    .map(([k, v]) => `${kebab(k)}: ${cssValue(k, v)}`)
    .join('; ');
}

/* ── HTML / Vue / Svelte ──────────────────────────────────────────── */

export type TemplateFlavor = 'html' | 'vue' | 'svelte';

const escapeText = (s: string, flavor: TemplateFlavor) => {
  const out = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return flavor === 'html' ? out : out.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
};
const escapeAttr = (s: string, flavor: TemplateFlavor) => {
  const out = s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return flavor === 'svelte' ? out.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;') : out;
};
/** Our own escaped HTML: only braces need neutralising for template compilers. */
const trusted = (html: string, flavor: TemplateFlavor) => (flavor === 'html' ? html : html.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;'));

export interface SlotPrinter {
  thread(indent: string): string[];
  composer(props: ComposerSlotProps, indent: string): string[];
}

export function printTemplate(node: VNode, flavor: TemplateFlavor, slots: SlotPrinter, indent = ''): string[] {
  switch (node.kind) {
    case 'text':
      return [`${indent}${escapeText(node.text, flavor)}`];
    case 'slot':
      return node.slot === 'thread' ? slots.thread(indent) : slots.composer(node.props, indent);
    case 'el': {
      const attrs = Object.entries(node.attrs ?? {}).map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${escapeAttr(v, flavor)}"`));
      if (node.style) attrs.push(` style="${escapeAttr(styleToCss(node.style), flavor)}"`);
      const open = `<${node.tag}${attrs.join('')}>`;
      if (VOID.has(node.tag)) return [`${indent}${open.slice(0, -1)} />`];
      if (node.html !== undefined) return [`${indent}${open}${trusted(node.html, flavor)}</${node.tag}>`];
      const kids = node.children ?? [];
      if (!kids.length) return [`${indent}${open}</${node.tag}>`];
      if (kids.length === 1 && kids[0]!.kind === 'text') return [`${indent}${open}${escapeText(kids[0]!.text, flavor)}</${node.tag}>`];
      return [`${indent}${open}`, ...kids.flatMap((k) => printTemplate(k, flavor, slots, `${indent}  `)), `${indent}</${node.tag}>`];
    }
  }
}

/** Static HTML of a subtree (no slots), for seeded `html` parts. */
export function toHtml(node: VNode): string {
  return printTemplate(node, 'html', { thread: () => [], composer: () => [] }).map((l) => l.trim()).join('');
}

/* ── JSX ──────────────────────────────────────────────────────────── */

const JSX_ATTR: Record<string, string> = { class: 'className', for: 'htmlFor', tabindex: 'tabIndex', colspan: 'colSpan', rowspan: 'rowSpan' };
const SIMPLE_TEXT = /^[^{}<>&]*$/;
const jsxText = (s: string) => (SIMPLE_TEXT.test(s) && s.trim() === s && s.length > 0 && !/\s{2}/.test(s) ? s : `{${JSON.stringify(s)}}`);
const jsxAttr = (name: string, value: string | true) =>
  value === true ? name : /^[^"\\{}]*$/.test(value) ? `${name}="${value}"` : `${name}={${JSON.stringify(value)}}`;

function styleObject(style: Style): string {
  const body = Object.entries(style)
    .map(([k, v]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${typeof v === 'number' ? v : JSON.stringify(v)}`)
    .join(', ');
  return `{{ ${body} }}`;
}

export interface JsxOptions {
  /** Emit Tailwind classes instead of inline styles. */
  tailwind?: boolean;
}

export function printJsx(node: VNode, slots: SlotPrinter, indent = '', options: JsxOptions = {}): string[] {
  switch (node.kind) {
    case 'text':
      return [`${indent}${jsxText(node.text)}`];
    case 'slot':
      return node.slot === 'thread' ? slots.thread(indent) : slots.composer(node.props, indent);
    case 'el': {
      const attrs = Object.entries(node.attrs ?? {}).map(([k, v]) => ` ${jsxAttr(JSX_ATTR[k] ?? k, v)}`);
      if (node.style) attrs.push(options.tailwind ? ` className=${JSON.stringify(styleToTailwind(node.style))}` : ` style=${styleObject(node.style)}`);
      if (node.html !== undefined) attrs.push(` dangerouslySetInnerHTML={{ __html: ${JSON.stringify(node.html)} }}`);
      const kids = node.html !== undefined ? [] : (node.children ?? []);
      if (!kids.length) return [`${indent}<${node.tag}${attrs.join('')} />`];
      const open = `<${node.tag}${attrs.join('')}>`;
      if (kids.length === 1 && kids[0]!.kind === 'text') return [`${indent}${open}${jsxText(kids[0]!.text)}</${node.tag}>`];
      return [`${indent}${open}`, ...kids.flatMap((k) => printJsx(k, slots, `${indent}  `, options)), `${indent}</${node.tag}>`];
    }
  }
}

/* ── Tailwind ─────────────────────────────────────────────────────── */

const ARB = (v: string | number) => String(typeof v === 'number' ? `${v}px` : v).replace(/ /g, '_');
const NAMED: Record<string, Record<string, string>> = {
  display: { flex: 'flex', grid: 'grid', block: 'block', 'inline-flex': 'inline-flex', none: 'hidden' },
  flexDirection: { row: 'flex-row', column: 'flex-col' },
  alignItems: { 'flex-start': 'items-start', center: 'items-center', 'flex-end': 'items-end', stretch: 'items-stretch' },
  justifyContent: { 'flex-start': 'justify-start', center: 'justify-center', 'flex-end': 'justify-end', 'space-between': 'justify-between' },
  boxSizing: { 'border-box': 'box-border' },
  overflowY: { auto: 'overflow-y-auto' },
  flexWrap: { wrap: 'flex-wrap' },
  textAlign: { start: 'text-start', center: 'text-center', left: 'text-left' },
  whiteSpace: { 'pre-wrap': 'whitespace-pre-wrap' },
  cursor: { pointer: 'cursor-pointer' },
  alignSelf: { 'flex-end': 'self-end', 'flex-start': 'self-start' },
  placeItems: { center: 'place-items-center' },
};
const PREFIX: Record<string, string> = {
  gap: 'gap',
  padding: 'p',
  width: 'w',
  height: 'h',
  maxWidth: 'max-w',
  minWidth: 'min-w',
  minHeight: 'min-h',
  fontSize: 'text',
  borderRadius: 'rounded',
  marginInline: 'mx',
  margin: 'm',
  marginTop: 'mt',
};

/** Inline style → Tailwind v4 classes: named utilities where exact, arbitrary values otherwise. */
export function styleToTailwind(style: Style): string {
  const out: string[] = [];
  for (const [key, value] of Object.entries(style)) {
    const named = NAMED[key]?.[String(value)];
    if (named) out.push(named);
    else if (key === 'flex' && value === '1 1 0%') out.push('flex-1');
    else if (key === 'flexShrink' && value === 0) out.push('shrink-0');
    else if ((key === 'minWidth' || key === 'minHeight') && value === 0) out.push(`${PREFIX[key]}-0`);
    else if (key === 'width' && value === '100%') out.push('w-full');
    else if (key === 'marginInline' && value === 'auto') out.push('mx-auto');
    else if (key === 'background') out.push(`bg-[${ARB(value)}]`);
    else if (key === 'color') out.push(`text-[color:${ARB(value)}]`);
    else if (key === 'fontWeight') out.push(`font-[${value}]`);
    else if (PREFIX[key] && (typeof value === 'number' || !/\s/.test(String(value)))) out.push(`${PREFIX[key]}-[${ARB(value)}]`);
    else out.push(`[${kebab(key)}:${ARB(cssValue(key, value))}]`);
  }
  return out.join(' ');
}
