/**
 * Applets: agent-written React widgets/views + server functions (work package B).
 * CONTRACT: shared/runtime.ts. main.ts mounts `routes` and `tools`.
 *
 *   <workspace>/.aicl/applets/<id>.tsx         → bundled by esbuild into .aicl/.build/<id>.js
 *   <workspace>/.aicl/applets/<id>.server.ts   → run per call in a child process (applet-runner.ts)
 */
import { spawn } from 'node:child_process';
import { watch, type FSWatcher } from 'node:fs';
import { mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild, type BuildFailure, type Message, type Plugin } from 'esbuild';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { HOST_GLOBAL, type AppletConfig, type AppletInfo, type AppletKind, type WorkspaceConfig } from '../shared/runtime.ts';
import { json, readJson, type RouteTable } from './http.ts';
import type { Relay } from './relay.ts';

/** Appended to the agent's system prompt: how to write and ship applets. */
export const APPLETS_PROMPT = `# Applets (live tools you build for the user)

When the user wants a tool, dashboard, tracker, viewer, or small app, write an applet: a React module that runs live in their workspace. Do not answer with code in chat when an applet would serve them.

Files, in <workspace>/.aicl/applets/ (create them with your write tool; read README.md there first if unsure):
- <id>.tsx — the UI. id is lowercase letters, digits, dashes. Must have a default export (the component) and should have \`export const config = { title: 'Notes stats', kind: 'widget' | 'view', icon: 'file-text', colSpan: 1, rowSpan: 1 }\`. A widget is a card (canvas / Overview grid); a view is a full tab.
- <id>.server.ts — optional. Exported async functions run on the server (full Node: read/write files relative to the workspace, fetch APIs, run commands; process env is available). Call them from the UI by importing: \`import { getStats } from './<id>.server'\`. Args and results must be JSON.
- _name.tsx / _name.ts — shared modules (never applets); import them with a relative path.

In the UI:
- Tailwind is NOT available. Style with inline styles and the --aicl-* CSS variables (e.g. var(--aicl-color-bg), var(--aicl-color-text), var(--aicl-color-border), var(--aicl-color-accent)) so it follows the theme, plus components from '@aicl/react' (and Markdown from '@aicl/react/markdown'). Icons: 'lucide-react'. React comes from 'react'.
- The component fills its container (a widget card is about 320x230 usable per colSpan/rowSpan unit): keep it compact, use padding ~12px, and handle loading and error states. Make sure every button is visible without scrolling.
- Wire buttons back to the agent with intents: \`import { sendMessage, addContext, navigate } from 'aicl'\` — sendMessage('Summarize notes.md') sends the user's message to you; addContext({label, text}) stages context for their next message; navigate('aicl:/overview').

Workflow: write the files, then ALWAYS call applet_build {id} and fix every error it returns until it succeeds. Then show it: applet_place {id, where: 'canvas' | 'overview'} for widgets, applet_open {id} for views. If the user says an applet is broken or blank, call applet_logs {id}, fix the code, and applet_build again. applet_list shows existing applets — edit them instead of making duplicates.`;

const README = `# Applets

Each applet is a React module the agent (or you) can write and run live.

- \`<id>.tsx\` — default export is the component. \`export const config = { title, kind: 'widget' | 'view', icon, colSpan, rowSpan }\`.
- \`<id>.server.ts\` — optional. Exported async functions run on the server; import them from the UI: \`import { fn } from './<id>.server'\`.
- Files starting with \`_\` are shared modules, not applets.
- No Tailwind. Use inline styles with \`--aicl-*\` CSS variables, \`@aicl/react\`, and \`lucide-react\`.
- \`import { sendMessage, addContext, navigate } from 'aicl'\` to talk back to the agent.

See \`_example.tsx\`.
`;

const EXAMPLE = `import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { sendMessage } from 'aicl';

export const config = { title: 'Example', kind: 'widget', icon: 'sparkles', colSpan: 1, rowSpan: 1 };

export default function Example() {
  const [n, setN] = useState(0);
  return (
    <div style={{ padding: 12, color: 'var(--aicl-color-text)', display: 'grid', gap: 8 }}>
      <Sparkles size={16} />
      <button onClick={() => setN(n + 1)}>Clicked {n}</button>
      <button onClick={() => sendMessage('Hello from an applet')}>Message the agent</button>
    </div>
  );
}
`;

const ID_PATTERN = /^[a-z0-9-]+$/;
export const isAppletId = (id: unknown): id is string => typeof id === 'string' && id.length <= 64 && ID_PATTERN.test(id);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.join(HERE, 'applet-runner.ts');
const RPC_TIMEOUT_MS = 30_000;

/** Bare import → key on window.__AICL_HOST__ (see shared/runtime.ts). */
const HOST_MODULES: Record<string, { key: string; specs: string[] }> = {
  react: { key: 'react', specs: ['react'] },
  'react/jsx-runtime': { key: 'jsxRuntime', specs: ['react/jsx-runtime'] },
  'react/jsx-dev-runtime': { key: 'jsxRuntime', specs: ['react/jsx-runtime'] },
  'react-dom': { key: 'reactDom', specs: ['react-dom', 'react-dom/client'] },
  'react-dom/client': { key: 'reactDom', specs: ['react-dom', 'react-dom/client'] },
  '@aicl/react': { key: 'aiclReact', specs: ['@aicl/react'] },
  '@aicl/react/markdown': { key: 'aiclMarkdown', specs: ['@aicl/react/markdown'] },
  '@aicl/core': { key: 'aiclCore', specs: ['@aicl/core'] },
  'lucide-react': { key: 'lucide', specs: ['lucide-react'] },
};
const INTENT_NAMES = ['sendMessage', 'addContext', 'navigate'];

const nameCache = new Map<string, string[]>();
async function exportNames(specs: string[]): Promise<string[]> {
  const cacheKey = specs.join('|');
  const hit = nameCache.get(cacheKey);
  if (hit) return hit;
  const names = new Set<string>();
  for (const spec of specs) {
    const mod = (await import(spec)) as Record<string, unknown>;
    for (const k of Object.keys(mod)) names.add(k);
    const d = mod['default'];
    if (d && typeof d === 'object') for (const k of Object.keys(d)) names.add(k);
  }
  names.delete('default');
  const list = [...names].filter((n) => /^[A-Za-z_$][\w$]*$/.test(n));
  nameCache.set(cacheKey, list);
  return list;
}

/** A module whose exports read from the page's host runtime. Pure, so unused exports tree-shake away. */
function hostModuleSource(key: string, names: string[]): string {
  const lines = [`const h = globalThis[${JSON.stringify(HOST_GLOBAL)}][${JSON.stringify(key)}];`, 'const g = (n) => h[n];'];
  names.forEach((n, i) => {
    lines.push(`const v${i} = /* @__PURE__ */ g(${JSON.stringify(n)});`);
    lines.push(`export { v${i} as ${n} };`);
  });
  lines.push('export default h.default ?? h;');
  return lines.join('\n');
}

function rpcStubSource(id: string, fns: string[]): string {
  const lines = [`const rpc = (fn, args) => globalThis[${JSON.stringify(HOST_GLOBAL)}].rpc(${JSON.stringify(id)}, fn, args);`];
  for (const fn of fns) {
    if (fn === 'default') lines.push(`export default (...args) => rpc("default", args);`);
    else lines.push(`export const ${fn} = (...args) => rpc(${JSON.stringify(fn)}, args);`);
  }
  return lines.join('\n');
}

const formatMessage = (m: Message, root: string): string => {
  const where = m.location ? `${path.relative(root, path.resolve(root, m.location.file))}:${m.location.line}:${m.location.column}: ` : '';
  const line = m.location?.lineText ? `\n    ${m.location.lineText.trim()}` : '';
  return `${where}${m.text}${line}`;
};

export interface AppletsModule {
  routes: RouteTable;
  tools: import('@earendil-works/pi-coding-agent').ToolDefinition[];
}

export interface AppletsApi extends AppletsModule {
  list(): Promise<AppletInfo[]>;
  build(id: string): Promise<{ ok: true; applet: AppletInfo } | { ok: false; errors: string[] }>;
  rpc(id: string, fn: string, args: unknown[]): Promise<{ result: unknown } | { error: string }>;
  dispose(): void;
}

interface Built {
  info: AppletInfo;
  errors: string[];
  /** file → "mtime:size" | "missing"; empty after a failed build (always stale). */
  inputs: Map<string, string>;
}

const fileSignature = async (file: string): Promise<string> => {
  try {
    const s = await stat(file);
    return `${s.mtimeMs}:${s.size}`;
  } catch {
    return 'missing';
  }
};

const titleCase = (id: string) => id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
const clampSpan = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(4, Math.max(1, Math.round(v))) : 1);

export function createApplets(options: { workspace: string; relay: Relay }): AppletsApi {
  const { workspace, relay } = options;
  const root = path.join(workspace, '.aicl');
  const dir = path.join(root, 'applets');
  const buildDir = path.join(root, '.build');
  const workspaceFile = path.join(root, 'workspace.json');

  const built = new Map<string, Built>();
  const runtimeErrors = new Map<string, string>();
  const chains = new Map<string, Promise<unknown>>();
  let scaffolded: Promise<void> | undefined;

  const scaffold = (): Promise<void> =>
    (scaffolded ??= (async () => {
      await mkdir(dir, { recursive: true });
      await mkdir(buildDir, { recursive: true });
      for (const [name, body] of [
        ['README.md', README],
        ['_example.tsx', EXAMPLE],
      ] as const) {
        const file = path.join(dir, name);
        if ((await fileSignature(file)) === 'missing') await writeFile(file, body);
      }
    })());

  const sourceFile = (id: string) => path.join(dir, `${id}.tsx`);
  const serverFile = (id: string) => path.join(dir, `${id}.server.ts`);

  /** esbuild plugin: host-provided libraries and RPC stubs. */
  function plugin(deps: Set<string>): Plugin {
    return {
      name: 'aicl-host',
      setup(b) {
        b.onResolve({ filter: /.*/ }, async (args) => {
          if (args.kind === 'entry-point') return undefined;
          const spec = args.path;
          if (spec === 'aicl') return { path: 'aicl', namespace: 'aicl-host', sideEffects: false };
          const host = HOST_MODULES[spec];
          if (host) return { path: spec, namespace: 'aicl-host', sideEffects: false };
          if (/\.server(\.ts)?$/.test(spec) && (spec.startsWith('.') || spec.startsWith('/'))) {
            const file = path.resolve(args.resolveDir, spec.replace(/(\.ts)?$/, '.ts'));
            if ((await realpath(path.dirname(file)).catch(() => path.dirname(file))) !== (await realpath(dir))) return { errors: [{ text: `Server modules must live in ${path.relative(workspace, dir)}` }] };
            deps.add(file);
            return { path: file, namespace: 'aicl-rpc', sideEffects: false };
          }
          return undefined;
        });

        b.onLoad({ filter: /.*/, namespace: 'aicl-host' }, async (args) => {
          if (args.path === 'aicl') return { contents: hostModuleSource('intents', INTENT_NAMES), loader: 'js' };
          const host = HOST_MODULES[args.path]!;
          return { contents: hostModuleSource(host.key, await exportNames(host.specs)), loader: 'js' };
        });

        b.onLoad({ filter: /.*/, namespace: 'aicl-rpc' }, async (args) => {
          const id = path.basename(args.path).replace(/\.server\.ts$/, '');
          let fns: string[] = [];
          try {
            const result = await esbuild({
              entryPoints: [args.path],
              bundle: true,
              write: false,
              metafile: true,
              format: 'esm',
              packages: 'external',
              logLevel: 'silent',
              outdir: '/aicl-out',
            });
            const output = Object.values(result.metafile.outputs)[0];
            fns = (output?.exports ?? []).filter((n) => /^[A-Za-z_$][\w$]*$/.test(n));
          } catch (cause) {
            const failure = cause as BuildFailure;
            return { errors: failure.errors?.map((m) => ({ text: formatMessage(m, workspace) })) ?? [{ text: String(cause) }] };
          }
          return { contents: rpcStubSource(id, fns), loader: 'js' };
        });
      },
    };
  }

  async function readConfig(file: string, source: string): Promise<AppletConfig> {
    if (!/export\s+(const|let|var)\s+config\b|export\s*\{[^}]*\bconfig\b/.test(source)) return {};
    try {
      const result = await esbuild({
        stdin: { contents: `export { config } from ${JSON.stringify(file)};`, resolveDir: dir, loader: 'ts' },
        bundle: true,
        write: false,
        format: 'esm',
        target: 'es2022',
        jsx: 'automatic',
        treeShaking: true,
        logLevel: 'silent',
        plugins: [plugin(new Set())],
        outdir: '/aicl-out',
      });
      const code = result.outputFiles[0]!.text;
      const mod = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)) as { config?: unknown };
      const c = mod.config;
      return c && typeof c === 'object' ? (c as AppletConfig) : {};
    } catch {
      return {};
    }
  }

  async function doBuild(id: string): Promise<Built> {
    await scaffold();
    const file = sourceFile(id);
    const server = serverFile(id);
    const previous = built.get(id);
    if (previous && previous.inputs.size) {
      let fresh = true;
      for (const [f, sig] of previous.inputs) if ((await fileSignature(f)) !== sig) fresh = false;
      if (fresh) return previous;
    }

    const hasServer = (await fileSignature(server)) !== 'missing';
    const fail = (errors: string[]): Built => ({
      info: { ...(previous?.info ?? { id, kind: 'widget', title: titleCase(id), colSpan: 1, rowSpan: 1 }), id, hasServer, error: errors.join('\n') },
      errors,
      inputs: new Map(),
    });

    let source: string;
    try {
      source = await readFile(file, 'utf8');
    } catch {
      return fail([`${path.relative(workspace, file)} does not exist.`]);
    }

    const deps = new Set<string>();
    try {
      const result = await esbuild({
        entryPoints: [file],
        bundle: true,
        write: false,
        metafile: true,
        format: 'esm',
        target: 'es2022',
        jsx: 'automatic',
        sourcemap: 'inline',
        sourcesContent: false,
        logLevel: 'silent',
        plugins: [plugin(deps)],
        outdir: '/aicl-out',
        absWorkingDir: workspace,
      });
      const code = result.outputFiles[0]!.text;
      if (!/export\s*\{[^}]*\bdefault\b[^}]*\}|export\s+default\b/.test(code)) {
        return fail([`${path.relative(workspace, file)}: no default export. Export the component: export default function ${titleCase(id).replace(/\W/g, '')}() { ... }`]);
      }
      await mkdir(buildDir, { recursive: true });
      await writeFile(path.join(buildDir, `${id}.js`), code);

      const inputs = new Map<string, string>();
      for (const input of Object.keys(result.metafile.inputs)) {
        if (input.includes(':')) continue;
        const abs = path.resolve(workspace, input);
        inputs.set(abs, await fileSignature(abs));
      }
      for (const d of [...deps, server, file]) inputs.set(d, await fileSignature(d));

      const config = await readConfig(file, source);
      const kind: AppletKind = config.kind === 'view' ? 'view' : 'widget';
      const info: AppletInfo = {
        id,
        kind,
        title: typeof config.title === 'string' && config.title ? config.title : titleCase(id),
        ...(typeof config.icon === 'string' ? { icon: config.icon } : {}),
        colSpan: clampSpan(config.colSpan),
        rowSpan: clampSpan(config.rowSpan),
        hasServer,
        builtAt: Date.now(),
      };
      runtimeErrors.delete(id);
      return { info, errors: [], inputs };
    } catch (cause) {
      const failure = cause as BuildFailure;
      const errors = failure.errors?.length ? failure.errors.map((m) => formatMessage(m, workspace)) : [cause instanceof Error ? cause.message : String(cause)];
      return fail(errors);
    }
  }

  /** Serialises builds per id and broadcasts when the outcome changed. */
  function build(id: string): Promise<Built> {
    const run = (chains.get(id) ?? Promise.resolve()).then(async () => {
      const before = built.get(id);
      const after = await doBuild(id);
      built.set(id, after);
      if (after !== before) relay.broadcast({ type: 'applet', applet: withRuntime(after.info) });
      return after;
    });
    chains.set(id, run.catch(() => undefined));
    return run;
  }

  const withRuntime = (info: AppletInfo): AppletInfo => {
    if (info.error) return info;
    const err = runtimeErrors.get(info.id);
    return err ? { ...info, error: err } : info;
  };

  async function ids(): Promise<string[]> {
    await scaffold();
    const out = new Set<string>();
    for (const name of await readdir(dir)) {
      const m = /^([a-z0-9-]+)\.tsx$/.exec(name);
      if (m) out.add(m[1]!);
    }
    return [...out].sort();
  }

  async function list(): Promise<AppletInfo[]> {
    const all = await ids();
    for (const known of [...built.keys()]) {
      if (!all.includes(known)) {
        built.delete(known);
        runtimeErrors.delete(known);
        relay.broadcast({ type: 'applet-removed', id: known });
      }
    }
    const results = await Promise.all(all.map((id) => build(id)));
    return results.map((r) => withRuntime(r.info));
  }

  async function rpc(id: string, fn: string, args: unknown[]): Promise<{ result: unknown } | { error: string }> {
    if (!isAppletId(id)) return { error: 'Invalid applet id.' };
    if (!/^[A-Za-z_$][\w$]*$/.test(fn) || fn === '__proto__') return { error: 'Invalid function name.' };
    const file = serverFile(id);
    if ((await fileSignature(file)) === 'missing') return { error: `${path.relative(workspace, file)} does not exist.` };
    const outcome = await new Promise<{ result: unknown } | { error: string }>((resolve) => {
      const child = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', RUNNER], {
        cwd: workspace,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let out = '';
      let err = '';
      let done = false;
      const finish = (value: { result: unknown } | { error: string }) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish({ error: `${id}.server.ts ${fn}() timed out after ${RPC_TIMEOUT_MS / 1000}s.` });
      }, RPC_TIMEOUT_MS);
      child.stdout.on('data', (d: Buffer) => (out += d));
      child.stderr.on('data', (d: Buffer) => (err += d));
      child.on('error', (e) => finish({ error: e.message }));
      child.on('close', () => {
        const last = out.trim().split('\n').filter(Boolean).pop();
        try {
          finish(JSON.parse(last ?? '') as { result: unknown } | { error: string });
        } catch {
          finish({ error: (err.trim() || 'The server function exited without a result.').slice(-2000) });
        }
      });
      child.stdin.on('error', () => undefined);
      child.stdin.end(JSON.stringify({ file, fn, args }));
    });
    if ('error' in outcome) runtimeErrors.set(id, `${fn}(): ${outcome.error}`);
    return outcome;
  }

  /* ── workspace.json ─────────────────────────────────────────────── */

  async function readWorkspace(): Promise<WorkspaceConfig> {
    const fallback: WorkspaceConfig = { name: path.basename(workspace), overview: [] };
    try {
      const raw = JSON.parse(await readFile(workspaceFile, 'utf8')) as Partial<WorkspaceConfig>;
      return {
        name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : fallback.name,
        overview: Array.isArray(raw.overview) ? raw.overview.filter(isAppletId) : [],
      };
    } catch {
      return fallback;
    }
  }
  async function writeWorkspace(config: WorkspaceConfig): Promise<void> {
    await mkdir(root, { recursive: true });
    await writeFile(workspaceFile, JSON.stringify(config, null, 2) + '\n');
  }

  /* ── file watching ──────────────────────────────────────────────── */

  let watcher: FSWatcher | undefined;
  let timer: NodeJS.Timeout | undefined;
  let disposed = false;
  void scaffold().then(() => {
    if (disposed) return;
    try {
      watcher = watch(dir, () => {
        clearTimeout(timer);
        timer = setTimeout(() => void list().catch(() => undefined), 250);
      });
      watcher.on('error', () => undefined);
    } catch {
      /* watching is a convenience; explicit builds still work */
    }
  });

  /* ── routes ─────────────────────────────────────────────────────── */

  const resultOf = (b: Built) => (b.errors.length ? { ok: false as const, errors: b.errors } : { ok: true as const, applet: withRuntime(b.info) });

  async function buildChecked(id: string) {
    if (!isAppletId(id)) return { ok: false as const, errors: [`Invalid applet id "${id}": use lowercase letters, digits and dashes.`] };
    return resultOf(await build(id));
  }

  const routes: RouteTable = {
    'GET /api/applets': async (_req, res) => json(res, 200, { applets: await list() }),

    'POST /api/applets/:id/build': async (_req, res, { params }) => {
      const result = await buildChecked(params['id']!);
      json(res, result.ok ? 200 : 422, result);
    },

    'GET /api/applets/:id/bundle.js': async (_req, res, { params }) => {
      const id = params['id']!;
      if (!isAppletId(id)) return json(res, 400, { error: 'Invalid applet id.' });
      const result = await build(id);
      if (result.errors.length) return json(res, 422, { error: result.errors.join('\n') });
      const code = await readFile(path.join(buildDir, `${id}.js`), 'utf8');
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(code);
    },

    'POST /api/applets/:id/rpc/:fn': async (req, res, { params }) => {
      let args: unknown[] = [];
      try {
        const body = await readJson<{ args?: unknown }>(req);
        if (Array.isArray(body.args)) args = body.args;
      } catch {
        return json(res, 400, { error: 'Body must be JSON { args }.' });
      }
      const outcome = await rpc(params['id']!, params['fn']!, args);
      json(res, 'error' in outcome ? 500 : 200, outcome);
    },

    'POST /api/applets/:id/log': async (req, res, { params }) => {
      const id = params['id']!;
      if (!isAppletId(id)) return json(res, 400, { error: 'Invalid applet id.' });
      const body = await readJson<{ message?: unknown; stack?: unknown }>(req);
      const message = typeof body.message === 'string' ? body.message : 'Unknown error';
      const stack = typeof body.stack === 'string' ? `\n${body.stack.split('\n').slice(0, 6).join('\n')}` : '';
      runtimeErrors.set(id, `${message}${stack}`.slice(0, 4000));
      const known = built.get(id);
      if (known) relay.broadcast({ type: 'applet', applet: withRuntime(known.info) });
      json(res, 200, { ok: true });
    },

    'GET /api/workspace': async (_req, res) => json(res, 200, await readWorkspace()),

    'PUT /api/workspace': async (req, res) => {
      const body = await readJson<Partial<WorkspaceConfig>>(req);
      const current = await readWorkspace();
      await writeWorkspace({
        name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : current.name,
        overview: Array.isArray(body.overview) ? body.overview.filter(isAppletId) : current.overview,
      });
      json(res, 200, { ok: true });
    },
  };

  /* ── tools ──────────────────────────────────────────────────────── */

  const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value) }], details: {} });
  const IdParam = Type.String({ description: 'Applet id: lowercase letters, digits, dashes (the file name without .tsx).' });

  const applet_build = defineTool({
    name: 'applet_build',
    label: 'Build applet',
    description:
      'Bundle .aicl/applets/<id>.tsx and check it. Run after every write or edit. Returns { ok: true, applet } or { ok: false, errors } with file:line messages: fix them and build again.',
    parameters: Type.Object({ id: IdParam }),
    async execute(_id, params) {
      return text(await buildChecked(params.id));
    },
  });

  const applet_list = defineTool({
    name: 'applet_list',
    label: 'List applets',
    description: 'List the existing applets with kind, title, size, whether they have server functions, and any current error.',
    parameters: Type.Object({}),
    async execute() {
      return text({ applets: await list() });
    },
  });

  const applet_logs = defineTool({
    name: 'applet_logs',
    label: 'Applet logs',
    description: 'The last build or runtime error recorded for an applet (browser render errors and server-function failures). Check this when the user reports something broken.',
    parameters: Type.Object({ id: IdParam }),
    async execute(_id, params) {
      if (!isAppletId(params.id)) return text(`Invalid applet id "${params.id}".`);
      const b = await build(params.id);
      return text({ error: b.errors.join('\n') || runtimeErrors.get(params.id) || null });
    },
  });

  const applet_place = defineTool({
    name: 'applet_place',
    label: 'Place applet',
    description: 'Show a widget applet: on the scratch canvas, or on the Overview grid. Build it successfully first.',
    parameters: Type.Object({
      id: IdParam,
      where: Type.Union([Type.Literal('canvas'), Type.Literal('overview')]),
      x: Type.Optional(Type.Number({ description: 'canvas: page x of the top-left corner' })),
      y: Type.Optional(Type.Number()),
    }),
    async execute(_id, params, signal) {
      const result = await buildChecked(params.id);
      if (!result.ok) return text(result);
      if (params.where === 'overview') {
        const config = await readWorkspace();
        if (!config.overview.includes(params.id)) await writeWorkspace({ ...config, overview: [...config.overview, params.id] });
        relay.broadcast({ type: 'applet', applet: result.applet });
        return text({ ok: true, placed: 'overview' });
      }
      const { colSpan, rowSpan } = result.applet;
      const outcome = await relay.request(
        {
          op: 'add',
          shapes: [
            {
              kind: 'component',
              component: 'applet',
              props: { id: params.id },
              title: result.applet.title,
              w: 320 * colSpan,
              h: 260 * rowSpan,
              ...(params.x !== undefined ? { x: params.x } : {}),
              ...(params.y !== undefined ? { y: params.y } : {}),
            },
          ],
        },
        signal,
      );
      return text({ ok: true, placed: 'canvas', result: outcome });
    },
  });

  const applet_open = defineTool({
    name: 'applet_open',
    label: 'Open applet',
    description: 'Take the user to an applet: views open as their own tab, widgets open the Overview.',
    parameters: Type.Object({ id: IdParam }),
    async execute(_id, params) {
      const result = await buildChecked(params.id);
      if (!result.ok) return text(result);
      const address = result.applet.kind === 'view' ? (`aicl:/views/${params.id}` as const) : ('aicl:/overview' as const);
      relay.broadcast({ type: 'navigate', address });
      return text({ ok: true, address });
    },
  });

  return {
    routes,
    tools: [applet_build, applet_list, applet_logs, applet_place, applet_open] as unknown as AppletsModule['tools'],
    list,
    build: async (id) => buildChecked(id),
    rpc,
    dispose() {
      disposed = true;
      watcher?.close();
      clearTimeout(timer);
    },
  };
}
