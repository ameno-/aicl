/** Staging file content as context for the active session's next message ("Add context" chips). */
import { addPendingContext } from '../sessionsApi.ts';
import { formatRange, type LineRange } from './api.ts';

const MAX_ATTACH_CHARS = 30_000;

/** `text` is the whole file; with a range only those (1-based, inclusive) lines are attached, numbered. */
export function attachFileContext(path: string, text: string, range?: LineRange): void {
  const lines = text.split('\n');
  const start = range ? Math.max(1, range.startLine) : 1;
  const end = range ? Math.min(lines.length, range.endLine) : lines.length;
  let body = lines
    .slice(start - 1, end)
    .map((l, i) => (range ? `${String(start + i).padStart(4)}  ${l}` : l))
    .join('\n');
  if (body.length > MAX_ATTACH_CHARS) body = `${body.slice(0, MAX_ATTACH_CHARS)}\n… (truncated)`;
  const label = formatRange(path, range);
  addPendingContext({ label, text: `${range ? `Lines ${start}-${end} of ${path}` : `File ${path}`}:\n${body}` });
}
