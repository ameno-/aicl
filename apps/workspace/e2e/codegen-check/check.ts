// Typechecks generated screen code against the real @aicl/react sources.
// Run from apps/workspace: node --experimental-strip-types --no-warnings e2e/codegen-check/check.ts
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toReactCode } from '../../shared/ui-ops.ts';
import { SAMPLE_SCREEN, type ScreenSpec, type UiNode } from '../../shared/ui-spec.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out');
mkdirSync(out, { recursive: true });

const n = (id: string, type: UiNode['type'], props: Record<string, unknown> = {}, children?: UiNode[]): UiNode => ({ id, type, props, ...(children ? { children } : {}) });

const everything: ScreenSpec = {
  name: 'Every "element" <kit> {all}',
  frame: 'tablet',
  theme: { preset: 'lovable', overrides: { radius: 6, font: 'serif', accent: '#0af' } },
  root: n('root', 'column', { surface: 'bg', gap: 'md', padding: 'lg', align: 'stretch', justify: 'between', radius: 'lg', border: 'all', height: 900 }, [
    n('r1', 'row', { gap: 'sm', surface: 'elevated', maxWidth: 900 }, [n('brand', 'brand', { name: 'Acme', mark: 'A' }), n('sp', 'spacer', { size: 12 }), n('sp2', 'spacer')]),
    n('nav', 'sidebarNav', { items: [{ label: 'New "task"', active: true, badge: '3' }, { label: 'Search' }] }),
    n('sl', 'sessionList', { groups: [{ label: 'Today', sessions: [{ title: 'A', status: 'running', statusLine: 'Running', active: true, time: '2m', unread: true }, { title: 'B', preview: 'p' }] }, { sessions: [] }] }),
    n('hd', 'header', { title: 'Thread', subtitle: 'sub', model: 'Opus', actions: ['share', 'more', 'x'] }),
    n('um', 'userMessage', { text: 'Hello `world` {x}\nline 2' }),
    n('am', 'assistantMessage', { text: '**bold** text', actions: true }),
    n('rs', 'reasoning', { durationSec: 4, text: 'thinking', streaming: false }),
    n('rs2', 'reasoning', { streaming: true }),
    n('ts', 'toolStep', { label: 'Read file', status: 'running' }),
    n('pl', 'plan', { title: 'Plan', steps: [{ label: 'one', status: 'done' }, { label: 'two', status: 'running' }, { label: 'three' }] }),
    n('ar', 'artifact', { title: 'Patch', kind: 'diff', version: 2 }),
    n('cd', 'code', { language: 'ts', content: 'const a = `x`;\n"q"' }),
    n('tm', 'terminal', { lines: ['$ npm test', 'ok'] }),
    n('st', 'statusLine', { text: 'Stopped working' }),
    n('cp', 'composer', { placeholder: 'Ask…', attach: true, chips: ['a', 'b'], state: 'streaming', variant: 'hero', model: 'Opus' }),
    n('sg', 'suggestions', { items: ['one', 'two'], layout: 'chips' }),
    n('sg2', 'suggestions', { items: ['three'], layout: 'rows' }),
    n('at', 'attachments', { files: [{ name: 'a.pdf', status: 'uploading' }, { name: 'b.png' }] }),
    n('h1', 'heading', { text: 'Title', level: 1, align: 'center' }),
    n('tx', 'text', { text: 'Body', tone: 'muted', size: 'sm' }),
    n('bt', 'button', { label: 'Go', variant: 'secondary' }),
    n('tb', 'table', { columns: ['a', 'b'], rows: [[1, 'x'], [2, 'y']] }),
    n('mt', 'metric', { label: 'Users', value: 1200, delta: '+4%', trend: 'up' }),
    n('to', 'toast', { title: 'Saved', description: 'ok', variant: 'success', action: 'Undo' }),
    n('es', 'emptyState', { title: 'Nothing', hint: 'Add one' }),
    n('im', 'image', { label: 'Preview', height: 120 }),
    n('dv', 'divider'),
    n('empty', 'row'),
  ]),
};

writeFileSync(join(out, 'sample.tsx'), toReactCode(SAMPLE_SCREEN));
writeFileSync(join(out, 'everything.tsx'), toReactCode(everything));

const tsc = spawnSync('npx', ['tsc', '--noEmit', '-p', join(here, 'tsconfig.json')], { stdio: 'inherit', cwd: join(here, '../..') });
if (tsc.status !== 0) {
  console.error('codegen-check FAILED');
  process.exit(tsc.status ?? 1);
}
console.log('codegen-check OK');
