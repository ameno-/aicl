/**
 * Exported projects, one per target. Every framework target is a runnable
 * Vite app plus the same `server/` (a ChatBackend interface with Anthropic,
 * OpenAI-compatible and echo backends). `html` needs no build; `json` is the
 * design as data for any other renderer.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NODE_TYPES, resolveTheme, type ScreenSpec } from '../../shared/ui-spec.ts';
import { normalizeSpec } from '../../shared/ui-ops.ts';
import { EXPORT_TARGETS, TARGET_LABELS, type ExportTarget } from '../../shared/export-targets.ts';
import { buildApp, type AppModel } from './build.ts';
import { printJsx, printTemplate, type ComposerSlotProps, type SlotPrinter } from './vnode.ts';

export { EXPORT_TARGETS, TARGET_LABELS, type ExportTarget };

export interface ExportFile {
  path: string;
  content: string;
}

export interface ExportedProject {
  name: string;
  slug: string;
  target: ExportTarget;
  files: ExportFile[];
}

const TEMPLATES = path.resolve(import.meta.dirname, '..', '..', 'templates');
const template = (rel: string) => readFileSync(path.join(TEMPLATES, rel), 'utf8');

const VERSIONS = {
  vite: '^8.3.4',
  typescript: '^5.9.3',
  react: '^19.3.0',
  reactTypes: '^19.3.0',
  pluginReact: '^6.1.2',
  vue: '^3.5.43',
  pluginVue: '^6.0.9',
  svelte: '^5.57.2',
  pluginSvelte: '^7.3.1',
  vueTsc: '^3.3.12',
  svelteCheck: '^4.7.6',
  tailwind: '^4.3.3',
  anthropic: '^0.132.1',
  openai: '^7.31.0',
};

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'chat-ui';

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/* ── Shared pieces ────────────────────────────────────────────────── */

function themeCss(app: AppModel): string {
  const vars = Object.entries(app.themeVars).map(([k, v]) => `  ${k}: ${v};`);
  return `/* Theme for "${app.name.replace(/\*\//g, '')}", exported from its AICL design (designed at ${app.designedAt.w}×${app.designedAt.h}).
   Restyle by editing the variables; every element reads them. */
.aicl-app {
${vars.join('\n')}
  color-scheme: ${app.mode};
  display: flex;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  background: var(--aicl-bg);
  color: var(--aicl-text);
  font-family: var(--aicl-font-sans);
  font-size: 15px;
}

html,
body {
  margin: 0;
  height: 100%;
}

.aicl-app *,
.aicl-app *::before,
.aicl-app *::after {
  box-sizing: border-box;
}
`;
}

function serverFiles(): ExportFile[] {
  return ['server/index.js', 'server/backend.js', 'server/backends/anthropic.js', 'server/backends/openai.js', 'server/backends/echo.js'].flatMap((p) => [p, p.replace(/\.js$/, '.d.ts')]).map((p) => ({ path: p, content: template(p) }));
}

const SERVER_DEPS = { '@anthropic-ai/sdk': VERSIONS.anthropic, openai: VERSIONS.openai };

const ENV_EXAMPLE = `# Which backend serves /api/chat: anthropic | openai | echo.
# Default: anthropic when ANTHROPIC_API_KEY is set, else openai when OPENAI_MODEL is set, else echo.
AICL_BACKEND=

# Anthropic (or a compatible gateway)
ANTHROPIC_API_KEY=
# ANTHROPIC_BASE_URL=https://your-gateway.example.com
ANTHROPIC_MODEL=claude-opus-5-5
# ANTHROPIC_THINKING=off      # gateways that reject thinking
# ANTHROPIC_FALLBACKS=off     # gateways that reject the server-side refusal fallback beta

# OpenAI-compatible (OpenAI, OpenRouter, LiteLLM, Ollama: http://localhost:11434/v1, vLLM...)
OPENAI_API_KEY=
# OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=

AICL_SYSTEM_PROMPT=
PORT=8787
`;

const GITIGNORE = 'node_modules\ndist\n.env\n';

const DEV_SCRIPT = `// Runs the chat server and the Vite dev server together; Ctrl-C stops both.
import { spawn } from 'node:child_process';

const procs = [
  spawn(process.execPath, ['--env-file-if-exists=.env', 'server/index.js'], { stdio: 'inherit' }),
  spawn('npx', ['vite'], { stdio: 'inherit', shell: process.platform === 'win32' }),
];
const stop = () => procs.forEach((p) => p.kill('SIGTERM'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => (stop(), (process.exitCode = code ?? 0)));
`;

const viteConfig = (plugins: { imports: string[]; calls: string[] }) => `import { defineConfig } from 'vite';
${plugins.imports.join('\n')}

export default defineConfig({
  plugins: [${plugins.calls.join(', ')}],
  // The chat server (server/index.js) answers /api; \`npm run dev\` starts both.
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
});
`;

const indexHtml = (title: string, script: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="${script}"></script>
  </body>
</html>
`;

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const seedTs = (app: AppModel) => `// The conversation from the design, shown first and never sent to the backend.
import type { Message } from './aicl-chat.js';

export const seedMessages: Message[] = ${JSON.stringify(app.seedMessages, null, 2)};
`;

function packageJson(slug: string, extra: { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }) {
  return json({
    name: slug,
    private: true,
    version: '0.1.0',
    type: 'module',
    scripts: extra.scripts ?? {},
    dependencies: { ...extra.dependencies, ...SERVER_DEPS },
    ...(extra.devDependencies ? { devDependencies: extra.devDependencies } : {}),
  });
}

const VITE_SCRIPTS = {
  dev: 'node dev.mjs',
  build: 'vite build',
  start: 'vite build && node --env-file-if-exists=.env server/index.js',
  server: 'node --env-file-if-exists=.env server/index.js',
};

function readme(app: AppModel, target: ExportTarget, files: string[]): string {
  const run =
    target === 'html'
      ? '```bash\nnode server/index.js        # echo backend, no install needed\nopen http://localhost:8787\n\nnpm install                 # once, for the Anthropic or OpenAI backend\ncp .env.example .env        # set your keys\nnpm start\n```'
      : '```bash\nnpm install\nnpm run dev                 # chat server on :8787 + Vite on :5173, echo backend\nopen http://localhost:5173\n\ncp .env.example .env        # set ANTHROPIC_API_KEY or OPENAI_* to talk to a model\nnpm start                   # build, then serve the app and /api/chat on :8787\n```';
  return `# ${app.name}

A working chat interface exported from an [AICL](https://github.com/ameno-/aicl) canvas design as **${TARGET_LABELS[target]}**. The layout is the design; the conversation is live. It opens with the designed sample conversation, then streams real replies from whichever backend you plug in.

## Run

Needs Node 22.9 or later.

${run}

Without keys the server uses the **echo** backend, so you can try the UI first. If a key is set but its SDK is not installed yet, the server says so and uses echo until you run \`npm install\`.

## Plug in your backend

\`server/index.js\` serves \`POST /api/chat\` as Server-Sent Events and picks a backend from the environment (see \`.env.example\`):

| \`AICL_BACKEND\` | Talks to | Configure |
|---|---|---|
| \`anthropic\` | Anthropic Messages API or a compatible gateway | \`ANTHROPIC_API_KEY\`, optional \`ANTHROPIC_BASE_URL\`, \`ANTHROPIC_MODEL\` (default \`claude-opus-5-5\`) |
| \`openai\` | Any OpenAI-compatible Chat Completions endpoint (OpenAI, OpenRouter, LiteLLM, Ollama, vLLM) | \`OPENAI_MODEL\`, \`OPENAI_API_KEY\`, optional \`OPENAI_BASE_URL\` |
| \`echo\` | Nothing: a scripted reply with reasoning and a tool step | — |

The Anthropic backend streams reasoning summaries and, on a safety refusal, lets the API re-run the request on a fallback model (\`ANTHROPIC_FALLBACKS=off\` disables that for gateways that reject it).

Your own agent: implement one method and return it from \`pickBackend\` in \`server/index.js\`.

\`\`\`js
/** @type {import('./server/backend.js').ChatBackend} */
const myBackend = {
  async *stream({ messages, body, signal }) {
    yield { type: 'message-start', id: crypto.randomUUID(), role: 'assistant' };
    yield { type: 'part-start', index: 0, part: { type: 'text', text: '' } };
    for await (const token of myAgent(messages, { signal })) yield { type: 'part-delta', index: 0, delta: token };
    yield { type: 'message-end', finishReason: 'stop' };
  },
};
\`\`\`

Events are AICL's wire format (\`server/backend.js\` documents every one): parts can be \`text\`, \`reasoning\`, \`tool-call\` (with \`status\`), \`artifact\` and \`error\`, and each renders as its own element. Any server that speaks this stream works, so you can also point the client at an existing endpoint (\`createChat({ endpoint })\`).

## Customise

- **Look:** \`theme.css\` holds the design's colours, radii and font as \`--aicl-*\` variables.${target === 'react-tailwind' ? ' Elements use Tailwind utilities over those variables (\`src/classes.ts\` for the chat elements).' : target === 'json' ? '' : ' \`chat.css\` styles the live chat elements.'}
- **Behaviour:** the chat client (\`aicl-chat.js\`) is a small framework-free store: \`send\`, \`stop\`, \`retry\`, \`clear\`, \`subscribe\`. Set \`sendSeedMessages: true\` to send the designed conversation as history, or call \`clear()\` to start empty.
- **Markdown:** \`renderMarkdown\` in \`aicl-chat.js\` escapes everything first and supports paragraphs, headings, lists, code and links. Swap in a full renderer if you need more.

## Files

${files.map((f) => `- \`${f}\``).join('\n')}
`;
}

/* ── Targets ──────────────────────────────────────────────────────── */

const jsxSlots: SlotPrinter = {
  thread: (i) => [`${i}<Thread chat={chat} />`],
  composer: (p: ComposerSlotProps, i) => [
    `${i}<Composer chat={chat}${p.placeholder ? ` placeholder={${JSON.stringify(p.placeholder)}}` : ''}${p.suggestions?.length ? ` suggestions={${JSON.stringify(p.suggestions)}}` : ''}${p.variant ? ` variant="${p.variant}"` : ''} />`,
  ],
};

const tsconfigFor = (extra: Record<string, unknown>, include: string[]) =>
  json({
    compilerOptions: {
      target: 'ES2022',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      isolatedModules: true,
      ...extra,
    },
    include,
  });

function reactProject(app: AppModel, slug: string, tailwind: boolean): ExportFile[] {
  const body = printJsx(app.tree, jsxSlots, '      ', { tailwind });
  const appTsx = `// "${app.name.replace(/\n/g, ' ')}", exported from its AICL design. The layout is static markup;
// <Thread> and <Composer> are live (src/Chat.tsx), backed by src/aicl-chat.js.
import { Composer, Thread, useChatStore } from './Chat';
import { seedMessages } from './seed';

export default function App() {
  const chat = useChatStore({ endpoint: '/api/chat', initialMessages: seedMessages });
  return (
    <div className="aicl-app">
${body.join('\n')}
    </div>
  );
}
`;
  const mainTsx = `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './theme.css';
${tailwind ? "import './index.css';" : "import './chat.css';"}

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;
  const tsconfig = tsconfigFor({ jsx: 'react-jsx', types: ['vite/client'] }, ['src']);
  return [
    { path: 'package.json', content: packageJson(slug, { scripts: { ...VITE_SCRIPTS, typecheck: 'tsc --noEmit' }, dependencies: { react: VERSIONS.react, 'react-dom': VERSIONS.react }, devDependencies: { vite: VERSIONS.vite, '@vitejs/plugin-react': VERSIONS.pluginReact, typescript: VERSIONS.typescript, '@types/react': VERSIONS.reactTypes, '@types/react-dom': VERSIONS.reactTypes, ...(tailwind ? { tailwindcss: VERSIONS.tailwind, '@tailwindcss/vite': VERSIONS.tailwind } : {}) } }) },
    { path: 'vite.config.ts', content: viteConfig(tailwind ? { imports: ["import react from '@vitejs/plugin-react';", "import tailwindcss from '@tailwindcss/vite';"], calls: ['react()', 'tailwindcss()'] } : { imports: ["import react from '@vitejs/plugin-react';"], calls: ['react()'] }) },
    { path: 'tsconfig.json', content: tsconfig },
    { path: 'index.html', content: indexHtml(app.name, '/src/main.tsx') },
    { path: 'dev.mjs', content: DEV_SCRIPT },
    { path: 'src/main.tsx', content: mainTsx },
    { path: 'src/App.tsx', content: appTsx },
    { path: 'src/Chat.tsx', content: template('react/src/Chat.tsx') },
    { path: 'src/classes.ts', content: template(tailwind ? 'react-tailwind/src/classes.ts' : 'react/src/classes.ts') },
    { path: 'src/aicl-chat.js', content: template('shared/chat.js') },
    { path: 'src/aicl-chat.d.ts', content: template('shared/chat.d.ts') },
    { path: 'src/seed.ts', content: seedTs(app) },
    { path: 'src/theme.css', content: themeCss(app) },
    tailwind ? { path: 'src/index.css', content: "@import 'tailwindcss';\n" } : { path: 'src/chat.css', content: template('shared/chat.css') },
  ];
}

function vueProject(app: AppModel, slug: string): ExportFile[] {
  const slots: SlotPrinter = {
    thread: (i) => [`${i}<Thread :chat="chat" :state="state" />`],
    composer: (p, i) => [
      `${i}<Composer :chat="chat" :state="state"${p.placeholder ? ` placeholder="${escapeHtml(p.placeholder)}"` : ''}${p.suggestions?.length ? ` :suggestions="${escapeHtml(JSON.stringify(p.suggestions))}"` : ''}${p.variant ? ` variant="${p.variant}"` : ''} />`,
    ],
  };
  const appVue = `<!-- "${app.name.replace(/--/g, '-')}", exported from its AICL design. The layout is static markup; Thread and Composer are live. -->
<script setup lang="ts">
import Composer from './Composer.vue';
import Thread from './Thread.vue';
import { useChat } from './useChat';
import { seedMessages } from './seed';

const { chat, state } = useChat({ endpoint: '/api/chat', initialMessages: seedMessages });
</script>

<template>
  <div class="aicl-app">
${printTemplate(app.tree, 'vue', slots, '    ').join('\n')}
  </div>
</template>
`;
  return [
    { path: 'package.json', content: packageJson(slug, { scripts: { ...VITE_SCRIPTS, typecheck: 'vue-tsc --noEmit' }, dependencies: { vue: VERSIONS.vue }, devDependencies: { vite: VERSIONS.vite, '@vitejs/plugin-vue': VERSIONS.pluginVue, typescript: VERSIONS.typescript, 'vue-tsc': VERSIONS.vueTsc } }) },
    { path: 'tsconfig.json', content: tsconfigFor({ types: ['vite/client'] }, ['src/**/*.ts', 'src/**/*.vue']) },
    { path: 'vite.config.ts', content: viteConfig({ imports: ["import vue from '@vitejs/plugin-vue';"], calls: ['vue()'] }) },
    { path: 'index.html', content: indexHtml(app.name, '/src/main.ts') },
    { path: 'dev.mjs', content: DEV_SCRIPT },
    { path: 'src/main.ts', content: "import { createApp } from 'vue';\nimport App from './App.vue';\nimport './theme.css';\nimport './chat.css';\n\ncreateApp(App).mount('#app');\n" },
    { path: 'src/env.d.ts', content: "/// <reference types=\"vite/client\" />\ndeclare module '*.vue' {\n  import type { DefineComponent } from 'vue';\n  const component: DefineComponent;\n  export default component;\n}\n" },
    { path: 'src/App.vue', content: appVue },
    { path: 'src/Thread.vue', content: template('vue/src/Thread.vue') },
    { path: 'src/Composer.vue', content: template('vue/src/Composer.vue') },
    { path: 'src/useChat.ts', content: template('vue/src/useChat.ts') },
    { path: 'src/aicl-chat.js', content: template('shared/chat.js') },
    { path: 'src/aicl-chat.d.ts', content: template('shared/chat.d.ts') },
    { path: 'src/seed.ts', content: seedTs(app) },
    { path: 'src/theme.css', content: themeCss(app) },
    { path: 'src/chat.css', content: template('shared/chat.css') },
  ];
}

function svelteProject(app: AppModel, slug: string): ExportFile[] {
  const slots: SlotPrinter = {
    thread: (i) => [`${i}<Thread {chat} />`],
    composer: (p, i) => [
      `${i}<Composer {chat}${p.placeholder ? ` placeholder={${JSON.stringify(p.placeholder)}}` : ''}${p.suggestions?.length ? ` suggestions={${JSON.stringify(p.suggestions)}}` : ''}${p.variant ? ` variant="${p.variant}"` : ''} />`,
    ],
  };
  const appSvelte = `<!-- "${app.name.replace(/--/g, '-')}", exported from its AICL design. The layout is static markup; Thread and Composer are live. -->
<script lang="ts">
  import Composer from './Composer.svelte';
  import Thread from './Thread.svelte';
  import { createChat } from './aicl-chat.js';
  import { seedMessages } from './seed';

  const chat = createChat({ endpoint: '/api/chat', initialMessages: seedMessages });
</script>

<div class="aicl-app">
${printTemplate(app.tree, 'svelte', slots, '  ').join('\n')}
</div>
`;
  return [
    { path: 'package.json', content: packageJson(slug, { scripts: { ...VITE_SCRIPTS, typecheck: 'svelte-check' }, dependencies: {}, devDependencies: { vite: VERSIONS.vite, svelte: VERSIONS.svelte, '@sveltejs/vite-plugin-svelte': VERSIONS.pluginSvelte, typescript: VERSIONS.typescript, 'svelte-check': VERSIONS.svelteCheck } }) },
    { path: 'tsconfig.json', content: tsconfigFor({ verbatimModuleSyntax: true, types: ['vite/client', 'svelte'] }, ['src/**/*.ts', 'src/**/*.svelte']) },
    { path: 'vite.config.ts', content: viteConfig({ imports: ["import { svelte } from '@sveltejs/vite-plugin-svelte';"], calls: ['svelte()'] }) },
    { path: 'svelte.config.js', content: "import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';\n\nexport default { preprocess: vitePreprocess() };\n" },
    { path: 'index.html', content: indexHtml(app.name, '/src/main.ts') },
    { path: 'dev.mjs', content: DEV_SCRIPT },
    { path: 'src/main.ts', content: "import { mount } from 'svelte';\nimport App from './App.svelte';\nimport './theme.css';\nimport './chat.css';\n\nmount(App, { target: document.getElementById('app')! });\n" },
    { path: 'src/App.svelte', content: appSvelte },
    { path: 'src/Thread.svelte', content: template('svelte/src/Thread.svelte') },
    { path: 'src/Composer.svelte', content: template('svelte/src/Composer.svelte') },
    { path: 'src/aicl-chat.js', content: template('shared/chat.js') },
    { path: 'src/aicl-chat.d.ts', content: template('shared/chat.d.ts') },
    { path: 'src/seed.ts', content: seedTs(app) },
    { path: 'src/theme.css', content: themeCss(app) },
    { path: 'src/chat.css', content: template('shared/chat.css') },
  ];
}

function htmlProject(app: AppModel, slug: string): ExportFile[] {
  const slots: SlotPrinter = {
    thread: (i) => [`${i}<div data-aicl-thread></div>`],
    composer: (p, i) => [
      `${i}<form class="aicl-composer" data-aicl-composer data-variant="${p.variant ?? 'docked'}">`,
      ...(p.suggestions?.length ? [`${i}  <div class="aicl-chips">${p.suggestions.map((s) => `<button type="button" class="aicl-chip">${escapeHtml(s)}</button>`).join('')}</div>`] : []),
      `${i}  <div class="aicl-input">`,
      `${i}    <textarea rows="1" placeholder="${escapeHtml(p.placeholder ?? 'Message')}" aria-label="Message"></textarea>`,
      `${i}    <button type="submit" class="aicl-send" aria-label="Send" disabled>↑</button>`,
      `${i}  </div>`,
      `${i}</form>`,
    ],
  };
  const index = `<!doctype html>
<!-- "${app.name.replace(/--/g, '-')}", exported from its AICL design. Static layout; app.js mounts the live chat. Serve with \`node server/index.js\`. -->
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(app.name)}</title>
    <link rel="stylesheet" href="theme.css" />
    <link rel="stylesheet" href="chat.css" />
  </head>
  <body>
    <div class="aicl-app">
${printTemplate(app.tree, 'html', slots, '      ').join('\n')}
    </div>
    <script type="module" src="app.js"></script>
  </body>
</html>
`;
  return [
    { path: 'package.json', content: packageJson(slug, { scripts: { start: 'node --env-file-if-exists=.env server/index.js' } }) },
    { path: 'index.html', content: index },
    { path: 'app.js', content: template('html/app.js') },
    { path: 'aicl-chat.js', content: template('shared/chat.js') },
    { path: 'seed.js', content: `// The conversation from the design, shown first and never sent to the backend.\nexport const seedMessages = ${JSON.stringify(app.seedMessages, null, 2)};\n` },
    { path: 'theme.css', content: themeCss(app) },
    { path: 'chat.css', content: template('shared/chat.css') },
  ];
}

function jsonProject(spec: ScreenSpec, app: AppModel): ExportFile[] {
  return [
    { path: 'screen.json', content: json(normalizeSpec(spec)) },
    { path: 'theme.json', content: json({ tokens: resolveTheme(spec.theme), cssVariables: app.themeVars, colorScheme: app.mode }) },
    { path: 'messages.json', content: json(app.seedMessages) },
    { path: 'catalog.json', content: json(NODE_TYPES.map(({ type, container, primitive, description, propsHint }) => ({ type, container, primitive, description, props: propsHint }))) },
  ];
}

function jsonReadme(app: AppModel): string {
  return `# ${app.name}: design as data

An [AICL](https://github.com/ameno-/aicl) chat UI design, exported as JSON so any renderer, framework or agent can rebuild it.

- \`screen.json\`: the screen spec. \`{ name, frame, theme, root }\`, where \`root\` is a tree of \`{ id, type, props, children? }\`. \`row\`/\`column\` are layout containers; every other type is a chat element.
- \`catalog.json\`: every element type, whether it is a container, the AICL primitive it maps to, and its props.
- \`theme.json\`: the resolved theme tokens and the \`--aicl-*\` CSS variables they produce.
- \`messages.json\`: the designed conversation as AICL messages (\`{ id, role, parts[] }\`), ready to seed a transcript.

To get runnable code instead, export the same screen as \`react\`, \`react-tailwind\`, \`vue\`, \`svelte\` or \`html\`.
`;
}

/** Builds every file of one target. Pure apart from reading the template files. */
export function exportProject(spec: ScreenSpec, target: ExportTarget): ExportedProject {
  if (!EXPORT_TARGETS.includes(target)) throw new Error(`Unknown export target "${target}". Use one of: ${EXPORT_TARGETS.join(', ')}.`);
  const app = buildApp(spec);
  const slug = slugify(app.name);
  if (target === 'json') {
    const files = jsonProject(spec, app);
    return { name: app.name, slug, target, files: [...files, { path: 'README.md', content: jsonReadme(app) }] };
  }
  const files = [
    ...(target === 'react' || target === 'react-tailwind' ? reactProject(app, slug, target === 'react-tailwind') : target === 'vue' ? vueProject(app, slug) : target === 'svelte' ? svelteProject(app, slug) : htmlProject(app, slug)),
    ...serverFiles(),
    { path: '.env.example', content: ENV_EXAMPLE },
    { path: '.gitignore', content: GITIGNORE },
  ];
  const listed = [...files.map((f) => f.path), 'README.md'].sort();
  return { name: app.name, slug, target, files: [...files, { path: 'README.md', content: readme(app, target, listed) }] };
}
