/**
 * Accessibility-ish page outline for the agent. collectOutline runs inside the
 * page (it is serialized, so it must stay self-contained); formatOutline turns
 * its rows into compact text.
 */

export interface OutlineItem {
  role: string;
  name: string;
  ref?: string;
  value?: string;
  level?: number;
  checked?: boolean;
  disabled?: boolean;
  href?: string;
}

export const OUTLINE_CAP = 120;

/** Runs in the page: tags interactive elements with data-aicl-ref and lists them with headings, in document order. */
export function collectOutline(cap: number): OutlineItem[] {
  document.querySelectorAll('[data-aicl-ref]').forEach((el) => el.removeAttribute('data-aicl-ref'));
  const sel =
    'h1,h2,h3,h4,a[href],button,input,select,textarea,summary,[role],[contenteditable=""],[contenteditable="true"],[onclick],[tabindex]';
  const visible = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  };
  const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const labelFor = (el: Element): string => {
    const input = el as HTMLInputElement;
    const labelled = el.getAttribute('aria-labelledby');
    if (labelled) {
      const t = labelled
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ');
      if (clean(t)) return clean(t);
    }
    if (input.labels && input.labels.length) return clean(input.labels[0]!.textContent);
    return '';
  };
  const out: OutlineItem[] = [];
  let n = 0;
  for (const el of Array.from(document.querySelectorAll(sel))) {
    if (out.length >= cap) break;
    if (!visible(el)) continue;
    const tag = el.tagName.toLowerCase();
    const form = el as HTMLInputElement;
    const type = form.type;
    const aria = el.getAttribute('role');
    const heading = /^h[1-4]$/.test(tag);
    let role = aria ?? '';
    if (!role) {
      if (heading) role = 'heading';
      else if (tag === 'a') role = 'link';
      else if (tag === 'button' || tag === 'summary') role = 'button';
      else if (tag === 'select') role = 'combobox';
      else if (tag === 'textarea') role = 'textbox';
      else if (tag === 'input')
        role =
          type === 'checkbox'
            ? 'checkbox'
            : type === 'radio'
              ? 'radio'
              : type === 'submit' || type === 'button' || type === 'reset'
                ? 'button'
                : type === 'range'
                  ? 'slider'
                  : 'textbox';
      else if (el.hasAttribute('contenteditable')) role = 'textbox';
      else role = 'clickable';
    }
    if (role === 'clickable' && el.getAttribute('tabindex') === '-1') continue;
    const name =
      clean(el.getAttribute('aria-label')) ||
      labelFor(el) ||
      (tag === 'input' && (type === 'submit' || type === 'button') ? clean(form.value) : '') ||
      clean(el.textContent) ||
      clean(form.placeholder) ||
      clean(el.getAttribute('title')) ||
      clean(el.getAttribute('alt')) ||
      clean(form.name);
    const item: OutlineItem = { role, name };
    if (heading) item.level = Number(tag[1]);
    else {
      item.ref = `e${++n}`;
      el.setAttribute('data-aicl-ref', item.ref);
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        if (type === 'checkbox' || type === 'radio') item.checked = form.checked;
        else if (type !== 'submit' && type !== 'button' && form.value) item.value = clean(form.value);
      }
      if (tag === 'a') {
        const href = el.getAttribute('href');
        if (href) item.href = href;
      }
      if (form.disabled) item.disabled = true;
    }
    out.push(item);
  }
  return out;
}

const quote = (s: string) => JSON.stringify(s);

/** `- button "Count" [e3]` per line; headings carry their level and no ref. */
export function formatOutline(items: OutlineItem[], meta: { title: string; url: string }, cap = OUTLINE_CAP): string {
  const lines = [`page: ${quote(meta.title)} <${meta.url}>`];
  for (const it of items.slice(0, cap)) {
    let line = it.level ? `- heading(${it.level}) ${quote(it.name)}` : `- ${it.role}${it.name ? ` ${quote(it.name)}` : ''}`;
    if (it.value !== undefined) line += ` value=${quote(it.value)}`;
    if (it.checked !== undefined) line += it.checked ? ' [checked]' : ' [unchecked]';
    if (it.disabled) line += ' [disabled]';
    if (it.href && it.role === 'link') line += ` -> ${it.href.slice(0, 80)}`;
    if (it.ref) line += ` [${it.ref}]`;
    lines.push(line);
  }
  if (items.length >= cap) lines.push(`(outline capped at ${cap} items; use browser_read for text)`);
  if (items.length === 0) lines.push('(no interactive elements or headings found)');
  return lines.join('\n');
}
