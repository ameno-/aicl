/**
 * Surface service: files (wave 4, see shared/surfaces.ts).
 *
 * Kind 'file' is one open file: id = workspace-relative path, summary = path,
 * meta { language, lines, hash, line?, reveal? }. The tree/search/read/save
 * endpoints back the web views; a recursive fs watch patches `meta.hash` of
 * open files, which every view sees through the surface event and answers by
 * reloading. Agents open and highlight with file_open / file_reveal (the
 * highlight is `meta.reveal`, so it reaches every view the same way).
 *
 *   GET  /api/surfaces/files/tree?dir=&dotfiles=1   lazy directory listing
 *   GET  /api/surfaces/files/search?q=              fuzzy quick-open
 *   GET  /api/surfaces/file/read?path=              { doc }
 *   POST /api/surfaces/file/open {path, line?}      opens/focuses the surface
 *   POST /api/surfaces/file/save {path, text, baseHash}   409 {doc} on conflict
 */
import { watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { SurfaceInfo } from '../../shared/surfaces.ts';
import { BrowseError, isTreeIgnored, listDir } from '../browse.ts';
import type { FeatureModule } from '../feature.ts';
import { json, readJson } from '../http.ts';
import { sessionIdFromToolContext } from '../session-context.ts';
import type { SurfaceContext } from './context.ts';
import { readDoc, saveDoc, SaveConflict, type FileDoc } from './files/docs.ts';
import { createPathIndex, searchPaths } from './files/search.ts';

const PROMPT = `# Files
- Open files you discuss with file_open {path, line?} so the user sees them next to the chat. When you explain or point at specific code, call file_reveal {path, startLine, endLine} to highlight that range (1-based, inclusive).
- The user may attach files or line ranges to a message; they arrive in the hidden canvas context labelled with the path and range. Answer about exactly that code.`;

const docMeta = (doc: FileDoc) => ({ language: doc.language, lines: doc.lines, hash: doc.hash });
const textResult = (text: string) => ({ content: [{ type: 'text' as const, text }], details: {} });

export function createFilesSurface(context: SurfaceContext): FeatureModule {
  const { workspace, surfaces } = context;
  const index = createPathIndex(workspace);
  let nonce = 0;

  async function open(
    requested: string,
    by: { openedBy: 'user' | 'agent'; sessionId?: string },
    extra: Record<string, unknown> = {},
  ): Promise<SurfaceInfo> {
    const doc = await readDoc(workspace, requested);
    const prev = surfaces.get('file', doc.path);
    return surfaces.upsert({
      kind: 'file',
      id: doc.path,
      title: path.posix.basename(doc.path),
      summary: doc.path,
      status: 'idle',
      openedBy: prev?.openedBy ?? by.openedBy,
      ...(by.sessionId ? { sessionId: by.sessionId } : {}),
      meta: { ...prev?.meta, ...docMeta(doc), ...extra },
    });
  }

  surfaces.onClose('file', () => {});

  /* ── fs watch: open files follow the disk ── */
  const pending = new Map<string, NodeJS.Timeout>();
  const refresh = async (rel: string) => {
    const info = surfaces.get('file', rel);
    if (!info) return;
    try {
      const doc = await readDoc(workspace, rel);
      if (info.meta?.['hash'] !== doc.hash) surfaces.patch('file', rel, { status: 'idle', meta: { ...info.meta, ...docMeta(doc) } });
    } catch {
      surfaces.patch('file', rel, { status: 'error', summary: `${rel} (missing)` });
    }
  };
  let watcher: FSWatcher | undefined;
  try {
    watcher = watch(workspace, { recursive: true }, (_event, name) => {
      if (!name) return;
      const rel = name.split(path.sep).join('/');
      if (isTreeIgnored(rel, true)) return;
      if (!isTreeIgnored(rel)) index.invalidate();
      clearTimeout(pending.get(rel));
      pending.set(
        rel,
        setTimeout(() => {
          pending.delete(rel);
          void refresh(rel);
        }, 60),
      );
    });
    watcher.on('error', () => {});
    watcher.unref();
  } catch {
    // No recursive watch on this platform: views still reload on focus.
  }

  const dirOf = (url: URL) => url.searchParams.get('dir') ?? '';
  const pathOf = (url: URL) => url.searchParams.get('path') ?? '';

  const file_open = defineTool({
    name: 'file_open',
    label: 'Open file',
    description: 'Open a workspace file for the user (a live file surface next to the chat). Optionally focus a 1-based line.',
    parameters: Type.Object({ path: Type.String(), line: Type.Optional(Type.Number()) }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const line = params.line && params.line > 0 ? Math.floor(params.line) : undefined;
      const info = await open(
        params.path,
        { openedBy: 'agent', sessionId: sessionIdFromToolContext(ctx) },
        line ? { focus: { line, nonce: ++nonce } } : {},
      );
      return textResult(`Opened ${info.id} (${info.meta?.['lines']} lines) for the user.`);
    },
  });

  const file_reveal = defineTool({
    name: 'file_reveal',
    label: 'Highlight lines',
    description: 'Highlight a line range (1-based, inclusive) of a file for the user, opening it if needed. Use while explaining code.',
    parameters: Type.Object({ path: Type.String(), startLine: Type.Number(), endLine: Type.Number() }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const start = Math.max(1, Math.floor(params.startLine));
      const end = Math.max(start, Math.floor(params.endLine));
      const info = await open(
        params.path,
        { openedBy: 'agent', sessionId: sessionIdFromToolContext(ctx) },
        { reveal: { startLine: start, endLine: end, nonce: ++nonce } },
      );
      return textResult(`Highlighted ${info.id} lines ${start}-${end} for the user.`);
    },
  });

  return {
    prompt: PROMPT,
    tools: [file_open, file_reveal],
    routes: {
      'GET /api/surfaces/files/tree': async (_req, res, { url }) =>
        json(res, 200, await listDir(workspace, dirOf(url), { tree: { dotfiles: url.searchParams.get('dotfiles') === '1' } })),
      'GET /api/surfaces/files/search': async (_req, res, { url }) =>
        json(res, 200, { paths: searchPaths(await index.get(), url.searchParams.get('q') ?? '', 50) }),
      'GET /api/surfaces/file/read': async (_req, res, { url }) => json(res, 200, { doc: await readDoc(workspace, pathOf(url)) }),
      'POST /api/surfaces/file/open': async (req, res) => {
        const body = await readJson<{ path?: string; line?: number; sessionId?: string }>(req);
        const extra = body.line && body.line > 0 ? { focus: { line: Math.floor(body.line), nonce: ++nonce } } : {};
        json(res, 200, { surface: await open(String(body.path ?? ''), { openedBy: 'user', ...(body.sessionId ? { sessionId: body.sessionId } : {}) }, extra) });
      },
      'POST /api/surfaces/file/save': async (req, res) => {
        const body = await readJson<{ path?: string; text?: unknown; baseHash?: string }>(req);
        if (typeof body.text !== 'string' || typeof body.baseHash !== 'string') throw new BrowseError(400, 'text and baseHash are required');
        try {
          const doc = await saveDoc(workspace, String(body.path ?? ''), body.text, body.baseHash);
          const info = surfaces.get('file', doc.path);
          if (info) surfaces.patch('file', doc.path, { meta: { ...info.meta, ...docMeta(doc) } });
          json(res, 200, { doc: { ...doc, text: undefined } });
        } catch (cause) {
          if (cause instanceof SaveConflict) return json(res, 409, { message: cause.message, doc: cause.current });
          throw cause;
        }
      },
    },
  };
}
