/** Unified-diff parser: git/gh output → files, hunks, lines (shared/git.ts). */
import type { DiffFile, DiffHunk, DiffLine, DiffStats } from '../../../shared/git.ts';

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;

/** Git quotes odd paths ("a\tb", octal escapes). Undo that. */
function unquote(p: string): string {
  if (!p.startsWith('"')) return p;
  const inner = p.slice(1, -1);
  const bytes: number[] = [];
  const simple: Record<string, string> = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\' };
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]!;
    if (c !== '\\') {
      bytes.push(...Buffer.from(c));
      continue;
    }
    const n = inner[++i]!;
    if (/[0-7]/.test(n)) {
      let oct = n;
      while (oct.length < 3 && /[0-7]/.test(inner[i + 1] ?? '')) oct += inner[++i];
      bytes.push(parseInt(oct, 8));
    } else bytes.push(...Buffer.from(simple[n] ?? n));
  }
  return Buffer.from(bytes).toString('utf8');
}

const stripPrefix = (p: string) => (/^[ab]\//.test(p) ? p.slice(2) : p);

/** "diff --git a/x b/y" → [x, y]. Later header lines refine this for odd names. */
function headerPaths(line: string): [string, string] {
  const rest = line.slice('diff --git '.length);
  const m = /^("(?:[^"\\]|\\.)*"|\S+) ("(?:[^"\\]|\\.)*"|.+)$/.exec(rest);
  // Identical names containing spaces: "a/x y b/x y" splits exactly in the middle.
  const half = rest.length % 2 === 1 ? Math.floor(rest.length / 2) : -1;
  if (half > 0 && rest[half] === ' ' && rest.startsWith('a/') && rest.slice(half + 1).startsWith('b/') && rest.slice(2, half) === rest.slice(half + 3)) {
    return [stripPrefix(rest.slice(0, half)), stripPrefix(rest.slice(half + 1))];
  }
  if (m) return [stripPrefix(unquote(m[1]!)), stripPrefix(unquote(m[2]!))];
  return ['', ''];
}

export function parseDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  let file: DiffFile | null = null;
  let header: string[] = [];
  let hunk: DiffHunk | null = null;
  let oldNo = 0;
  let newNo = 0;

  const finish = () => {
    if (!file) return;
    file.header = header.join('\n');
    files.push(file);
    file = null;
    hunk = null;
  };

  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) {
      finish();
      const [a, b] = headerPaths(line);
      file = { path: b, status: 'modified', binary: false, additions: 0, deletions: 0, header: '', hunks: [] };
      if (a !== b) file.oldPath = a;
      header = [line];
      continue;
    }
    if (!file) continue;
    const f: DiffFile = file;

    if (line.startsWith('@@')) {
      const h = HUNK.exec(line);
      if (!h) continue;
      const next: DiffHunk = {
        header: line,
        oldStart: Number(h[1]),
        oldLines: h[2] === undefined ? 1 : Number(h[2]),
        newStart: Number(h[3]),
        newLines: h[4] === undefined ? 1 : Number(h[4]),
        section: h[5] ?? '',
        lines: [],
      };
      oldNo = next.oldStart;
      newNo = next.newStart;
      f.hunks.push(next);
      hunk = next;
      continue;
    }

    if (!hunk) {
      header.push(line);
      if (line.startsWith('new file mode')) f.status = 'added';
      else if (line.startsWith('deleted file mode')) f.status = 'deleted';
      else if (line.startsWith('rename from ')) {
        f.status = 'renamed';
        f.oldPath = unquote(line.slice('rename from '.length));
      } else if (line.startsWith('rename to ')) f.path = unquote(line.slice('rename to '.length));
      else if (line.startsWith('copy from ')) {
        f.status = 'copied';
        f.oldPath = unquote(line.slice('copy from '.length));
      } else if (line.startsWith('copy to ')) f.path = unquote(line.slice('copy to '.length));
      else if (line.startsWith('Binary files') || line.startsWith('GIT binary patch')) f.binary = true;
      else if (line.startsWith('--- ') && line !== '--- /dev/null' && f.status !== 'renamed' && f.status !== 'copied') {
        const p = stripPrefix(unquote(line.slice(4)));
        if (f.status === 'deleted') f.path = p;
        else if (f.oldPath !== undefined) f.oldPath = p;
      } else if (line.startsWith('+++ ') && line !== '+++ /dev/null' && f.status !== 'renamed' && f.status !== 'copied') {
        f.path = stripPrefix(unquote(line.slice(4)));
        if (f.oldPath === f.path) delete f.oldPath;
      }
      continue;
    }

    const mark = line[0];
    const body = line.slice(1);
    let dl: DiffLine | null = null;
    if (mark === '+') {
      dl = { type: 'add', content: body, newLine: newNo++ };
      f.additions++;
    } else if (mark === '-') {
      dl = { type: 'del', content: body, oldLine: oldNo++ };
      f.deletions++;
    } else if (mark === ' ') dl = { type: 'context', content: body, oldLine: oldNo++, newLine: newNo++ };
    else if (mark === '\\') {
      const prev = hunk.lines[hunk.lines.length - 1];
      if (prev) prev.noNewline = true;
    }
    if (dl) hunk.lines.push(dl);
  }
  finish();
  return files;
}

export function diffStats(files: DiffFile[]): DiffStats {
  return {
    files: files.length,
    additions: files.reduce((n, f) => n + f.additions, 0),
    deletions: files.reduce((n, f) => n + f.deletions, 0),
  };
}

/** The patch text of one hunk, with the file header, ready for `git apply`. */
export function hunkPatch(file: DiffFile, hunk: DiffHunk): string {
  const body = hunk.lines.map((l) => {
    const mark = l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' ';
    return `${mark}${l.content}${l.noNewline ? '\n\\ No newline at end of file' : ''}`;
  });
  // Plain `---`/`+++` lines are part of file.header (they precede the first hunk).
  return `${file.header}\n${hunk.header}\n${body.join('\n')}\n`;
}
