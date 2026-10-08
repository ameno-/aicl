/** CodeMirror 6 pieces for the file view: theme from AICL tokens, lazy language packs, range highlight. */
import { HighlightStyle, StreamLanguage, syntaxHighlighting, type LanguageSupport } from '@codemirror/language';
import { Compartment, EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

export const theme = EditorView.theme({
  '&': { height: '100%', color: 'var(--aicl-code-fg)', backgroundColor: 'var(--aicl-code-bg)', fontSize: '12.5px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--aicl-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)', lineHeight: '1.55' },
  '.cm-gutters': { backgroundColor: 'var(--aicl-code-bg)', color: 'var(--aicl-text-faint)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--aicl-text) 5%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--aicl-text-muted)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--aicl-info) 28%, transparent) !important',
  },
  '.cm-cursor': { borderLeftColor: 'var(--aicl-text)' },
  '.cm-revealed-line': { backgroundColor: 'color-mix(in srgb, var(--aicl-warning) 22%, transparent)', boxShadow: 'inset 3px 0 0 var(--aicl-warning)' },
});

const highlight = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--aicl-code-comment)', fontStyle: 'italic' },
  { tag: [t.keyword, t.operatorKeyword, t.modifier, t.controlKeyword], color: 'var(--aicl-code-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--aicl-code-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--aicl-code-number)' },
  { tag: [t.tagName, t.typeName, t.className, t.propertyName], color: 'var(--aicl-code-tag)' },
  { tag: [t.heading, t.strong], fontWeight: '600' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.link, color: 'var(--aicl-text-link)', textDecoration: 'underline' },
]);

export const highlighting: Extension = syntaxHighlighting(highlight);

/* ── language packs (loaded on demand, so the editor chunk stays small) ── */

export async function loadLanguage(language: string): Promise<Extension> {
  switch (language) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx': {
      const { javascript } = await import('@codemirror/lang-javascript');
      return javascript({ typescript: language === 'ts' || language === 'tsx', jsx: language === 'tsx' || language === 'jsx' });
    }
    case 'json':
      return (await import('@codemirror/lang-json')).json();
    case 'css':
      return (await import('@codemirror/lang-css')).css();
    case 'html':
      return (await import('@codemirror/lang-html')).html();
    case 'md':
      return (await import('@codemirror/lang-markdown')).markdown();
    case 'py':
      return (await import('@codemirror/lang-python')).python();
    case 'sh': {
      const { shell } = await import('@codemirror/legacy-modes/mode/shell');
      return StreamLanguage.define(shell);
    }
    case 'yaml': {
      const { yaml } = await import('@codemirror/legacy-modes/mode/yaml');
      return StreamLanguage.define(yaml);
    }
    case 'toml': {
      const { toml } = await import('@codemirror/legacy-modes/mode/toml');
      return StreamLanguage.define(toml);
    }
    default:
      return [];
  }
}
export type { LanguageSupport };

/* ── revealed range ── */

export const setReveal = StateEffect.define<{ from: number; to: number } | null>();

const line = Decoration.line({ class: 'cm-revealed-line' });

export const revealField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    value = value.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setReveal)) continue;
      if (!e.value) return Decoration.none;
      const ranges = [];
      for (let n = tr.state.doc.lineAt(e.value.from).number; n <= tr.state.doc.lineAt(e.value.to).number; n++) {
        ranges.push(line.range(tr.state.doc.line(n).from));
      }
      return Decoration.set(ranges);
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const languageSlot = new Compartment();
export const editableSlot = new Compartment();
export const editable = (on: boolean): Extension => [EditorState.readOnly.of(!on), EditorView.editable.of(on)];

/** Replace the document with the smallest single change, so the cursor and scroll survive a reload. */
export function replaceDoc(view: EditorView, next: string): void {
  const cur = view.state.doc.toString();
  if (cur === next) return;
  let start = 0;
  const max = Math.min(cur.length, next.length);
  while (start < max && cur[start] === next[start]) start++;
  let endCur = cur.length;
  let endNext = next.length;
  while (endCur > start && endNext > start && cur[endCur - 1] === next[endNext - 1]) {
    endCur--;
    endNext--;
  }
  view.dispatch({ changes: { from: start, to: endCur, insert: next.slice(start, endNext) } });
}
