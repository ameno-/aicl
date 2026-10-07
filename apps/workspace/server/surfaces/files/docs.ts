/** Reading and saving one workspace text file, with content hashes for conflict detection. */
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BrowseError, resolveInside } from '../../browse.ts';

/** Larger files are listed but not opened for viewing or editing. */
export const MAX_DOC_BYTES = 1_000_000;

export interface FileDoc {
  path: string;
  text: string;
  hash: string;
  language: string;
  lines: number;
  truncated: boolean;
}

export class SaveConflict extends Error {
  readonly current: FileDoc;
  constructor(current: FileDoc) {
    super('The file changed on disk since you opened it.');
    this.current = current;
  }
}

export const hashText = (text: string): string => createHash('sha1').update(text).digest('hex').slice(0, 16);

const LANGUAGES: Record<string, string> = {
  '.ts': 'ts', '.mts': 'ts', '.cts': 'ts', '.tsx': 'tsx', '.js': 'js', '.mjs': 'js', '.cjs': 'js', '.jsx': 'jsx',
  '.json': 'json', '.css': 'css', '.html': 'html', '.htm': 'html', '.md': 'md', '.markdown': 'md',
  '.py': 'py', '.sh': 'sh', '.bash': 'sh', '.zsh': 'sh', '.yml': 'yaml', '.yaml': 'yaml', '.toml': 'toml',
};
export const languageOf = (file: string): string => LANGUAGES[path.extname(file).toLowerCase()] ?? 'text';

const countLines = (text: string): number => (text ? text.split('\n').length - (text.endsWith('\n') ? 1 : 0) : 0);

export async function readDoc(root: string, requested: string): Promise<FileDoc> {
  const { real, rel } = await resolveInside(root, requested);
  const s = await stat(real);
  if (!s.isFile()) throw new BrowseError(400, 'not a file');
  if (s.size > MAX_DOC_BYTES) throw new BrowseError(413, 'file too large to open');
  const buffer = await readFile(real);
  if (buffer.includes(0)) throw new BrowseError(415, 'binary file');
  const text = buffer.toString('utf8');
  return { path: rel, text, hash: hashText(text), language: languageOf(rel), lines: countLines(text), truncated: false };
}

/** Writes `text` if the file still has `baseHash`; otherwise throws SaveConflict with the current content. */
export async function saveDoc(root: string, requested: string, text: string, baseHash: string): Promise<FileDoc> {
  const current = await readDoc(root, requested);
  if (current.hash !== baseHash) throw new SaveConflict(current);
  const { real } = await resolveInside(root, requested);
  await writeFile(real, text, 'utf8');
  return readDoc(root, requested);
}
