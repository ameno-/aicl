import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { SAMPLE_SCREEN, type ScreenSpec } from '../shared/ui-spec.ts';
import { buildApp } from './export/build.ts';
import { EXPORT_TARGETS, exportProject, slugify } from './export/targets.ts';
import { styleToTailwind, type VNode } from './export/vnode.ts';
import { crc32, zip } from './export/zip.ts';
import { createChat, renderMarkdown } from '../templates/shared/chat.js';
import { createAnthropicBackend } from '../templates/server/backends/anthropic.js';
import { createOpenAIBackend } from '../templates/server/backends/openai.js';
import { startServer } from '../templates/server/index.js';

const slots = (node: VNode, out: string[] = []): string[] => {
  if (node.kind === 'slot') out.push(node.slot);
  if (node.kind === 'el') node.children?.forEach((c) => slots(c, out));
  return out;
};

const screen = (root: ScreenSpec['root']): ScreenSpec => ({ name: 'Test screen', frame: 'desktop', theme: { preset: 'default' }, root });

const sse = (events: unknown[]) =>
  new Response(
    new ReadableStream({
      start(c) {
        for (const e of events) c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(e)}\n\n`));
        c.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        c.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );

const collect = async (iterable: AsyncIterable<Record<string, unknown>>) => {
  const out: Record<string, unknown>[] = [];
  for await (const e of iterable) out.push(e);
  return out;
};

/* ── App model ───────────────────────────────────────────────────── */

test('the designed thread becomes seed messages and one live thread + composer', () => {
  const app = buildApp(SAMPLE_SCREEN);
  assert.deepEqual(slots(app.tree), ['thread', 'composer']);
  assert.deepEqual(
    app.seedMessages.map((m) => [m.role, m.parts.map((p) => p.type)]),
    [
      ['user', ['text']],
      ['assistant', ['reasoning', 'tool-call', 'tool-call', 'text', 'artifact']],
    ],
  );
  assert.ok(app.seedMessages.every((m) => m.seed));
  assert.equal(app.themeVars['--aicl-accent'], '#18181b');
  assert.equal(app.themeVars['--aicl-danger'], '#dc2626');
});

test('a screen without a thread gets the transcript just above its composer', () => {
  const app = buildApp(screen({ id: 'root', type: 'column', children: [{ id: 'h', type: 'heading', props: { text: 'Hi' } }, { id: 'c', type: 'composer', props: { variant: 'hero', chips: ['One'] } }] }));
  assert.deepEqual(slots(app.tree), ['thread', 'composer']);
  assert.deepEqual(app.seedMessages, []);
  const composer = JSON.stringify(app.tree);
  assert.match(composer, /"variant":"hero"/);
  assert.match(composer, /"suggestions":\["One"\]/);
});

test('a screen with neither a thread nor a composer still gets both', () => {
  const app = buildApp(screen({ id: 'root', type: 'column', children: [{ id: 't', type: 'text', props: { text: 'Static' } }] }));
  assert.deepEqual(slots(app.tree), ['thread', 'composer']);
});

test('non-message elements inside the thread are seeded as escaped html parts', () => {
  const app = buildApp(
    screen({
      id: 'root',
      type: 'column',
      children: [
        { id: 'u', type: 'userMessage', props: { text: 'show a table' } },
        { id: 't', type: 'table', props: { columns: ['<b>'], rows: [['x']] } },
      ],
    }),
  );
  const part = app.seedMessages[1]!.parts[0]!;
  assert.equal(part.type, 'html');
  assert.match((part as { html: string }).html, /&lt;b&gt;/);
});

/* ── Targets ─────────────────────────────────────────────────────── */

test('every target produces its project files', () => {
  const expected: Record<string, string[]> = {
    react: ['package.json', 'src/App.tsx', 'src/Chat.tsx', 'src/aicl-chat.js', 'src/seed.ts', 'src/theme.css', 'src/chat.css', 'server/index.js', '.env.example', 'README.md'],
    'react-tailwind': ['src/App.tsx', 'src/index.css', 'src/classes.ts', 'server/backends/anthropic.js'],
    vue: ['src/App.vue', 'src/Thread.vue', 'src/Composer.vue', 'tsconfig.json', 'server/backends/openai.js'],
    svelte: ['src/App.svelte', 'src/Thread.svelte', 'svelte.config.js', 'server/backends/echo.js'],
    html: ['index.html', 'app.js', 'aicl-chat.js', 'seed.js', 'server/index.js'],
    json: ['screen.json', 'theme.json', 'messages.json', 'catalog.json', 'README.md'],
  };
  for (const target of EXPORT_TARGETS) {
    const project = exportProject(SAMPLE_SCREEN, target);
    const paths = project.files.map((f) => f.path);
    for (const p of expected[target]!) assert.ok(paths.includes(p), `${target} is missing ${p}`);
    assert.equal(new Set(paths).size, paths.length, `${target} has duplicate paths`);
    for (const f of project.files.filter((f) => f.path.endsWith('.json'))) JSON.parse(f.content);
  }
  assert.equal(exportProject(SAMPLE_SCREEN, 'react').slug, 'agent-thread');
  assert.throws(() => exportProject(SAMPLE_SCREEN, 'angular' as never), /Unknown export target/);
});

test('slots render as each framework’s live components', () => {
  const file = (target: (typeof EXPORT_TARGETS)[number], p: string) => exportProject(SAMPLE_SCREEN, target).files.find((f) => f.path === p)!.content;
  assert.match(file('react', 'src/App.tsx'), /<Thread chat=\{chat\} \/>/);
  assert.match(file('react', 'src/App.tsx'), /<Composer chat=\{chat\} placeholder=\{"Ask the agent/);
  assert.match(file('vue', 'src/App.vue'), /<Thread :chat="chat" :state="state" \/>/);
  assert.match(file('svelte', 'src/App.svelte'), /<Thread \{chat\} \/>/);
  assert.match(file('html', 'index.html'), /data-aicl-thread/);
  assert.match(file('react-tailwind', 'src/App.tsx'), /className="flex flex-row box-border min-w-0 bg-\[var\(--aicl-bg\)\]/);
});

test('template text cannot inject template syntax', () => {
  const spec = screen({ id: 'root', type: 'column', children: [{ id: 'h', type: 'heading', props: { text: '{danger} {{ x }} <b>' } }] });
  const svelte = exportProject(spec, 'svelte').files.find((f) => f.path === 'src/App.svelte')!.content;
  const vue = exportProject(spec, 'vue').files.find((f) => f.path === 'src/App.vue')!.content;
  const jsx = exportProject(spec, 'react').files.find((f) => f.path === 'src/App.tsx')!.content;
  assert.match(svelte, /&#123;danger&#125; &#123;&#123; x &#125;&#125; &lt;b&gt;/);
  assert.match(vue, /&#123;danger&#125;/);
  assert.match(jsx, /\{"\{danger\} \{\{ x \}\} <b>"\}/);
});

test('inline styles map to Tailwind utilities, arbitrary values otherwise', () => {
  assert.equal(styleToTailwind({ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 0%', minHeight: 0 }), 'flex flex-col gap-[8px] flex-1 min-h-0');
  assert.equal(styleToTailwind({ borderRight: '1px solid var(--aicl-border)' }), '[border-right:1px_solid_var(--aicl-border)]');
  assert.equal(styleToTailwind({ color: 'var(--aicl-text-muted)', fontSize: 12 }), 'text-[color:var(--aicl-text-muted)] text-[12px]');
});

test('slugify makes package-safe names', () => {
  assert.equal(slugify('My  Agent: v2!'), 'my-agent-v2');
  assert.equal(slugify('***'), 'chat-ui');
});

test('zip archives open with the system unzip', () => {
  assert.equal(crc32(new TextEncoder().encode('hello')), 0x3610a686);
  const dir = mkdtempSync(path.join(tmpdir(), 'aicl-zip-'));
  const file = path.join(dir, 'x.zip');
  writeFileSync(file, zip([{ path: 'a/b.txt', content: 'hello' }, { path: 'c.json', content: '{"ok":true}' }]));
  const out = execFileSync('unzip', ['-p', file, 'a/b.txt']).toString();
  assert.equal(out, 'hello');
});

/* ── Chat client ─────────────────────────────────────────────────── */

test('chat client streams a reply and never sends seed messages', async () => {
  const bodies: unknown[] = [];
  const chat = createChat({
    initialMessages: [{ id: 's1', role: 'user', parts: [{ type: 'text', text: 'designed' }], seed: true }],
    fetch: (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return sse([
        { type: 'message-start', id: 'a1', role: 'assistant' },
        { type: 'part-start', index: 0, part: { type: 'text', text: '' } },
        { type: 'part-delta', index: 0, delta: 'Hel' },
        { type: 'part-delta', index: 0, delta: 'lo' },
        { type: 'message-end', finishReason: 'stop' },
      ]);
    }) as typeof fetch,
  });
  await chat.send('hi');
  const state = chat.getState();
  assert.equal(state.status, 'idle');
  assert.deepEqual(state.messages.map((m) => m.role), ['user', 'user', 'assistant']);
  assert.deepEqual(state.messages[2]!.parts, [{ type: 'text', text: 'Hello' }]);
  assert.deepEqual((bodies[0] as { messages: { parts: unknown[] }[] }).messages.map((m) => m.parts), [[{ type: 'text', text: 'hi' }]]);
});

test('chat client retries a turn that failed before any reply', async () => {
  let calls = 0;
  const chat = createChat({
    fetch: (async () => {
      calls++;
      if (calls === 1) return new Response(JSON.stringify({ message: 'upstream down' }), { status: 503 });
      return sse([{ type: 'message-start', id: 'a1', role: 'assistant' }, { type: 'message-end', finishReason: 'stop' }]);
    }) as typeof fetch,
  });
  await chat.send('hi');
  assert.equal(chat.getState().status, 'error');
  assert.deepEqual(chat.getState().error, { message: 'upstream down', retryable: true });
  await chat.retry();
  assert.equal(calls, 2);
  assert.equal(chat.getState().status, 'idle');
  assert.deepEqual(chat.getState().messages.map((m) => m.role), ['user', 'assistant']);
});

test('chat client stop keeps partial output and cancels running tools', async () => {
  let release: () => void = () => {};
  const chat = createChat({
    fetch: (async (_url: string, init: RequestInit) =>
      new Response(
        new ReadableStream({
          start(c) {
            const send = (e: unknown) => c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(e)}\n\n`));
            send({ type: 'message-start', id: 'a1', role: 'assistant' });
            send({ type: 'part-start', index: 0, part: { type: 'tool-call', toolCallId: 't', name: 'search', args: {}, status: 'running' } });
            release();
            init.signal?.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError')));
          },
        }),
      )) as typeof fetch,
  });
  const started = new Promise<void>((r) => (release = r));
  const done = chat.send('go');
  await started;
  await new Promise((r) => setTimeout(r, 20));
  chat.stop();
  await done;
  const last = chat.getState().messages.at(-1)!;
  assert.equal(chat.getState().status, 'aborted');
  assert.equal(last.aborted, true);
  assert.equal((last.parts[0] as { status: string }).status, 'cancelled');
});

test('renderMarkdown escapes HTML and only links http(s)/mailto', () => {
  const html = renderMarkdown('**bold** <script>x</script> [ok](https://a.b) [bad](javascript:alert(1))\n\n```js\nif (a < b) {}\n```');
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<a href="https:\/\/a.b"/);
  assert.doesNotMatch(html, /href="javascript/);
  assert.match(html, /<pre data-language="js"><code>if \(a &lt; b\) \{\}<\/code><\/pre>/);
});

/* ── Backends ────────────────────────────────────────────────────── */

test('anthropic backend maps thinking, text and tool_use blocks to sequential parts', async () => {
  let params: Record<string, unknown> = {};
  const events = [
    { type: 'message_start', message: { id: 'msg_1', usage: { input_tokens: 12 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Plan.' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'fallback' } },
    { type: 'content_block_stop', index: 1 },
    { type: 'content_block_start', index: 2, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 2, delta: { type: 'text_delta', text: 'Hi' } },
    { type: 'content_block_stop', index: 2 },
    { type: 'content_block_start', index: 3, content_block: { type: 'tool_use', id: 'tu_1', name: 'lookup', input: {} } },
    { type: 'content_block_delta', index: 3, delta: { type: 'input_json_delta', partial_json: '{"q":' } },
    { type: 'content_block_delta', index: 3, delta: { type: 'input_json_delta', partial_json: '"x"}' } },
    { type: 'content_block_stop', index: 3 },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 30 } },
    { type: 'message_stop' },
  ];
  const client = {
    beta: {
      messages: {
        stream: (p: Record<string, unknown>) => {
          params = p;
          return (async function* () {
            yield* events;
          })();
        },
      },
    },
  };
  const backend = createAnthropicBackend({ AICL_SYSTEM_PROMPT: 'Be brief.' }, { client });
  const out = await collect(
    backend.stream({
      messages: [
        { id: 'a0', role: 'assistant', parts: [{ type: 'text', text: 'leading assistant turn is dropped' }] },
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] },
      ],
      body: {},
      signal: new AbortController().signal,
    }),
  );
  assert.equal(params.model, 'claude-opus-5-5');
  assert.deepEqual(params.thinking, { type: 'adaptive', display: 'summarized' });
  assert.equal(params.fallbacks, 'default');
  assert.deepEqual(params.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(params.system, 'Be brief.');
  assert.deepEqual(params.messages, [{ role: 'user', content: 'hello' }]);
  assert.deepEqual(out, [
    { type: 'message-start', id: 'msg_1', role: 'assistant' },
    { type: 'part-start', index: 0, part: { type: 'reasoning', text: '' } },
    { type: 'part-delta', index: 0, delta: 'Plan.' },
    { type: 'part-end', index: 0 },
    { type: 'part-start', index: 1, part: { type: 'text', text: '' } },
    { type: 'part-delta', index: 1, delta: 'Hi' },
    { type: 'part-start', index: 2, part: { type: 'tool-call', toolCallId: 'tu_1', name: 'lookup', args: {}, status: 'running' } },
    { type: 'part-delta', index: 2, delta: '{"q":' },
    { type: 'part-delta', index: 2, delta: '"x"}' },
    { type: 'part-end', index: 2, part: { type: 'tool-call', toolCallId: 'tu_1', name: 'lookup', args: { q: 'x' }, status: 'success' } },
    { type: 'message-end', finishReason: 'tool-calls', usage: { inputTokens: 12, outputTokens: 30 } },
  ]);
});

test('anthropic backend: fallbacks and thinking can be turned off for gateways; refusals surface', async () => {
  let used = '';
  let params: Record<string, unknown> = {};
  const client = {
    beta: { messages: { stream: () => ((used = 'beta'), (async function* () {})()) } },
    messages: {
      stream: (p: Record<string, unknown>) => {
        used = 'messages';
        params = p;
        return (async function* () {
          yield { type: 'message_start', message: { id: 'm' } };
          yield { type: 'message_delta', delta: { stop_reason: 'refusal' } };
        })();
      },
    },
  };
  const out = await collect(
    createAnthropicBackend({ ANTHROPIC_FALLBACKS: 'off', ANTHROPIC_THINKING: 'off', ANTHROPIC_MODEL: 'claude-sonnet-5-5' }, { client }).stream({
      messages: [{ id: 'u', role: 'user', parts: [{ type: 'text', text: 'x' }] }],
      body: {},
      signal: new AbortController().signal,
    }),
  );
  assert.equal(used, 'messages');
  assert.equal(params.model, 'claude-sonnet-5-5');
  assert.equal(params.thinking, undefined);
  assert.equal(params.fallbacks, undefined);
  assert.deepEqual(out.slice(1), [
    { type: 'part-start', index: 0, part: { type: 'error', message: 'The model declined this request.', retryable: false } },
    { type: 'message-end', finishReason: 'content-filter', usage: {} },
  ]);
});

test('openai backend maps reasoning_content, content and tool_calls deltas', async () => {
  let params: Record<string, unknown> = {};
  const chunks = [
    { id: 'c1', choices: [{ delta: { role: 'assistant', reasoning_content: 'Think' } }] },
    { id: 'c1', choices: [{ delta: { content: 'Hel' } }] },
    { id: 'c1', choices: [{ delta: { content: 'lo' } }] },
    { id: 'c1', choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'search', arguments: '{"q"' } }] } }] },
    { id: 'c1', choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ':1}' } }] }, finish_reason: 'tool_calls' }] },
    { id: 'c1', choices: [], usage: { prompt_tokens: 5, completion_tokens: 7 } },
  ];
  const client = {
    chat: {
      completions: {
        create: async (p: Record<string, unknown>) => {
          params = p;
          return (async function* () {
            yield* chunks;
          })();
        },
      },
    },
  };
  const out = await collect(
    createOpenAIBackend({ OPENAI_MODEL: 'gpt-x' }, { client }).stream({
      messages: [
        { id: 's', role: 'system', parts: [{ type: 'text', text: 'Sys' }] },
        { id: 'u', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
      ],
      body: {},
      signal: new AbortController().signal,
    }),
  );
  assert.equal(params.model, 'gpt-x');
  assert.equal(params.stream, true);
  assert.deepEqual(params.messages, [
    { role: 'system', content: 'Sys' },
    { role: 'user', content: 'hi' },
  ]);
  assert.deepEqual(out, [
    { type: 'message-start', id: 'c1', role: 'assistant' },
    { type: 'part-start', index: 0, part: { type: 'reasoning', text: '' } },
    { type: 'part-delta', index: 0, delta: 'Think' },
    { type: 'part-start', index: 1, part: { type: 'text', text: '' } },
    { type: 'part-delta', index: 1, delta: 'Hel' },
    { type: 'part-delta', index: 1, delta: 'lo' },
    { type: 'part-start', index: 2, part: { type: 'tool-call', toolCallId: 'call_1', name: 'search', args: {}, status: 'running' } },
    { type: 'part-delta', index: 2, delta: '{"q"' },
    { type: 'part-delta', index: 2, delta: ':1}' },
    { type: 'part-end', index: 2, part: { type: 'tool-call', toolCallId: 'call_1', name: 'search', args: { q: 1 }, status: 'success' } },
    { type: 'message-end', finishReason: 'tool-calls', usage: { inputTokens: 5, outputTokens: 7 } },
  ]);
});

test('openai backend requires OPENAI_MODEL', async () => {
  await assert.rejects(collect(createOpenAIBackend({}, { client: {} }).stream({ messages: [], body: {}, signal: new AbortController().signal })), /OPENAI_MODEL/);
});

/* ── Exported server ─────────────────────────────────────────────── */

test('exported server streams the echo backend and never serves dotfiles', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'aicl-static-'));
  writeFileSync(path.join(root, 'index.html'), '<h1>app</h1>');
  writeFileSync(path.join(root, '.env'), 'ANTHROPIC_API_KEY=secret');
  const server = await startServer({ PORT: '0', AICL_BACKEND: 'echo', STATIC_DIR: root });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const res = await fetch(`${base}/api/chat`, { method: 'POST', body: JSON.stringify({ messages: [{ id: 'u', role: 'user', parts: [{ type: 'text', text: 'ping' }] }] }) });
    assert.equal(res.headers.get('content-type'), 'text/event-stream');
    const text = await res.text();
    assert.match(text, /"type":"message-start"/);
    assert.match(text, /ping/);
    assert.match(text, /data: \[DONE\]/);
    assert.equal((await fetch(`${base}/api/chat`, { method: 'POST', body: '{}' })).status, 400);
    assert.equal(await (await fetch(`${base}/`)).text(), '<h1>app</h1>');
    const secret = await (await fetch(`${base}/.env`)).text();
    assert.doesNotMatch(secret, /secret/);
  } finally {
    server.close();
  }
});
