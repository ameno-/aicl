/**
 * Export (AICL-58): a designed screen → a downloadable, working chat app in
 * one of six targets (server/export/targets.ts). Reaches agents as the
 * ui_export_project tool (in-app, `aicl` CLI, MCP) and people as the screen
 * card's Export menu (POST /api/export).
 *
 *   GET  /api/export/targets          → { targets: { id, label }[] }
 *   POST /api/export { spec, target } → application/zip
 *   GET  /api/exports/:file           → a zip written earlier by ui_export_project
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { normalizeSpec } from '../shared/ui-ops.ts';
import type { ScreenSpec } from '../shared/ui-spec.ts';
import { EXPORT_TARGETS, exportProject, TARGET_LABELS, type ExportTarget } from './export/targets.ts';
import { zip } from './export/zip.ts';
import type { FeatureContext, FeatureModule } from './feature.ts';
import { requestApproval } from './hitl.ts';
import { json, readJson } from './http.ts';
import { sessionIdFromToolContext } from './session-context.ts';

const PROMPT = `Exporting designs:
- When the user wants to use, download, ship or "get the code for" a screen, export it with ui_export_project (target react, react-tailwind, vue, svelte, html or json). The result is a runnable chat app: the design's layout, the designed conversation as its first messages, a live composer, and a server/ folder with Anthropic, OpenAI-compatible and echo backends.
- Reply with the download link from the result and how to run it (npm install && npm run dev; html runs with node server/index.js). Mention that they plug in their model with AICL_BACKEND and keys in .env.
- Pass dir only when the user asks to write the project into the workspace; it waits for their approval.`;

const literals = <T extends readonly string[]>(values: T) => Type.Union(values.map((v) => Type.Literal(v)));
const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }], details: {} });
const SAFE_FILE = /^[a-z0-9][a-z0-9.-]*\.zip$/;

export interface ExportsOptions {
  /** Loads a canvas screen's spec by shape id (the relay's ui_get). */
  loadScreen?(id: string, signal?: AbortSignal): Promise<ScreenSpec>;
}

export function createExports(context: FeatureContext, options: ExportsOptions = {}): FeatureModule {
  const outDir = path.join(context.workspace, '.aicl', 'exports');
  const loadScreen =
    options.loadScreen ??
    (async (id: string, signal?: AbortSignal) => {
      const result = await context.relay.request({ op: 'ui_get', id }, signal);
      if (result.op !== 'ui_get') throw new Error('Unexpected relay answer for ui_get.');
      return normalizeSpec(result.spec);
    });

  const exportTool = defineTool({
    name: 'ui_export_project',
    label: 'Export screen',
    description:
      'Export a designed chat screen as a downloadable, working app. Targets: ' +
      EXPORT_TARGETS.map((t) => `${t} (${TARGET_LABELS[t]})`).join(', ') +
      '. Every runnable target opens with the design and the designed conversation, has a live composer, and ships server/ with Anthropic, OpenAI-compatible and echo backends. Give `id` (a screen on the canvas) or `spec` (a screen spec JSON). Writes a zip and returns its download URL and file list; with `dir`, also writes the files into that folder of the workspace after the user approves.',
    parameters: Type.Object({
      id: Type.Optional(Type.String({ description: 'Screen shape id on the canvas (ui_list_screens).' })),
      spec: Type.Optional(Type.Unknown({ description: 'A screen spec { name, frame, theme, root } instead of a canvas screen.' })),
      target: literals(EXPORT_TARGETS),
      dir: Type.Optional(Type.String({ description: 'Workspace-relative folder to write the project into (asks the user first).' })),
    }),
    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      if (!params.id && params.spec === undefined) throw new Error('Pass the screen id (ui_list_screens) or a spec.');
      const spec = params.spec !== undefined ? normalizeSpec(params.spec) : await loadScreen(params.id!, signal);
      const project = exportProject(spec, params.target as ExportTarget);
      mkdirSync(outDir, { recursive: true });
      const file = `${project.slug}-${project.target}.zip`;
      writeFileSync(path.join(outDir, file), zip(project.files));

      let written: string | undefined;
      if (params.dir) {
        const target = path.resolve(context.workspace, params.dir);
        const rel = path.relative(context.workspace, target);
        if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('dir must be a folder inside the workspace.');
        const answer = await requestApproval(
          { sessionId: sessionIdFromToolContext(ctx), toolCallId, tool: 'ui_export_project', summary: `Write the ${project.target} export of "${project.name}" into ${rel}/ (${project.files.length} files)`, input: { dir: rel, target: project.target } },
          signal,
        );
        if (!answer.approved) throw new Error(`The user declined: ${answer.note?.trim() || 'no reason given'}`);
        for (const f of project.files) {
          const out = path.join(target, f.path);
          mkdirSync(path.dirname(out), { recursive: true });
          writeFileSync(out, f.content);
        }
        written = rel;
      }

      return text({
        name: project.name,
        target: project.target,
        download: `/api/exports/${file}`,
        zip: path.join(outDir, file),
        ...(written ? { writtenTo: written } : {}),
        files: project.files.map((f) => f.path),
        run:
          project.target === 'json'
            ? 'Design data only: screen.json, theme.json, messages.json, catalog.json.'
            : project.target === 'html'
              ? 'node server/index.js, then open http://localhost:8787 (echo backend without keys).'
              : 'npm install && npm run dev, then open http://localhost:5173 (echo backend without keys).',
      });
    },
  });

  return {
    prompt: PROMPT,
    tools: [exportTool],
    routes: {
      'GET /api/export/targets': (_req, res) => json(res, 200, { targets: EXPORT_TARGETS.map((id) => ({ id, label: TARGET_LABELS[id] })) }),
      'POST /api/export': async (req, res) => {
        const body = await readJson<{ spec?: unknown; target?: string }>(req);
        if (!EXPORT_TARGETS.includes(body.target as ExportTarget)) return json(res, 400, { message: `target must be one of ${EXPORT_TARGETS.join(', ')}` });
        let project;
        try {
          project = exportProject(normalizeSpec(body.spec), body.target as ExportTarget);
        } catch (cause) {
          return json(res, 400, { message: cause instanceof Error ? cause.message : 'invalid spec' });
        }
        const data = zip(project.files);
        res.writeHead(200, {
          'content-type': 'application/zip',
          'content-length': String(data.length),
          'content-disposition': `attachment; filename="${project.slug}-${project.target}.zip"`,
        });
        res.end(data);
      },
      'GET /api/exports/:file': (_req, res, { params }) => {
        const file = params['file'] ?? '';
        const full = path.join(outDir, file);
        if (!SAFE_FILE.test(file) || !existsSync(full)) return json(res, 404, { message: 'no such export' });
        const data = readFileSync(full);
        res.writeHead(200, { 'content-type': 'application/zip', 'content-length': String(data.length), 'content-disposition': `attachment; filename="${file}"` });
        res.end(data);
      },
    },
  };
}
