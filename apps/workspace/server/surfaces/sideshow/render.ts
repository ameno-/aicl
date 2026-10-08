/** HTML snapshots for Sideshow cards: a diff summary and a canvas shapes summary. Pure. */
import type { DiffData } from '../../../shared/git.ts';
import type { ShapeSummary } from '../../../shared/scratch.ts';

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const MAX_FILES = 40;
const MAX_HUNK_LINES = 30;

export function diffToHtml(data: DiffData, title?: string): string {
  const { stats } = data;
  const parts: string[] = [
    `<h3>${esc(title ?? data.spec.label)}</h3>`,
    `<p>${stats.files} file${stats.files === 1 ? '' : 's'} · <b style="color:#2da44e">+${stats.additions}</b> <b style="color:#cf222e">-${stats.deletions}</b></p>`,
  ];
  for (const file of data.files.slice(0, MAX_FILES)) {
    parts.push(
      `<details><summary><code>${esc(file.path)}</code> · ${esc(file.status)}${file.binary ? ' · binary' : ''} · <span style="color:#2da44e">+${file.additions}</span> <span style="color:#cf222e">-${file.deletions}</span> · ${file.hunks.length} hunk${file.hunks.length === 1 ? '' : 's'}</summary>`,
    );
    for (const hunk of file.hunks) {
      const shown = hunk.lines.slice(0, MAX_HUNK_LINES);
      const body = shown
        .map((l) => {
          const color = l.type === 'add' ? '#2da44e' : l.type === 'del' ? '#cf222e' : 'inherit';
          const mark = l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' ';
          return `<span style="color:${color}">${mark}${esc(l.content)}</span>`;
        })
        .join('\n');
      const more = hunk.lines.length > shown.length ? `\n… ${hunk.lines.length - shown.length} more lines` : '';
      parts.push(`<pre style="overflow:auto;font-size:12px"><b>${esc(hunk.header)}</b>\n${body}${more}</pre>`);
    }
    parts.push('</details>');
  }
  if (data.files.length > MAX_FILES) parts.push(`<p>… ${data.files.length - MAX_FILES} more files</p>`);
  if (!data.files.length) parts.push('<p>No changes.</p>');
  return parts.join('\n');
}

export function shapesToHtml(shapes: ShapeSummary[], png?: string | null, title = 'Canvas snapshot'): string {
  const parts = [`<h3>${esc(title)}</h3>`];
  if (png) parts.push(`<img alt="${esc(title)}" style="max-width:100%;border:1px solid #8884;border-radius:6px" src="data:image/png;base64,${png}">`);
  if (!shapes.length) parts.push('<p>No shapes.</p>');
  else {
    const rows = shapes
      .slice(0, 60)
      .map((s) => `<tr><td><code>${esc(s.id)}</code></td><td>${esc(s.component ?? s.kind)}</td><td>${esc(s.title ?? s.text ?? '')}</td><td>${Math.round(s.x)},${Math.round(s.y)}${s.w ? ` · ${Math.round(s.w)}×${Math.round(s.h ?? 0)}` : ''}</td></tr>`)
      .join('');
    parts.push(`<table style="border-collapse:collapse;font-size:13px"><thead><tr><th>id</th><th>kind</th><th>text</th><th>position</th></tr></thead><tbody>${rows}</tbody></table>`);
    if (shapes.length > 60) parts.push(`<p>… ${shapes.length - 60} more shapes</p>`);
  }
  return parts.join('\n');
}

export function genericSurfaceHtml(info: { kind: string; title: string; summary?: string; meta?: Record<string, unknown> }): string {
  const meta = info.meta ? `<pre style="font-size:12px">${esc(JSON.stringify(info.meta, null, 2))}</pre>` : '';
  return `<h3>${esc(info.title)}</h3><p>${esc(info.kind)} surface${info.summary ? ` · ${esc(info.summary)}` : ''}</p>${meta}`;
}
