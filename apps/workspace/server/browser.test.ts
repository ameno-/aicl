import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { formatOutline } from './surfaces/browser/outline.ts';
import { hostKey, isFreeUrl, normalizeUrl, scalePoint, summarizeUrl, toFraction, VIEWPORTS } from './surfaces/browser/policy.ts';
import { createBrowserSurface } from './surfaces/browser.ts';
import { createSurfaceRegistry } from './surfaces/registry.ts';

const WS = '/work/space';

describe('host policy', () => {
  it('lets localhost, loopback, *.localhost and workspace files through', () => {
    for (const url of ['http://localhost:5173/', 'http://127.0.0.1:3000/x', 'http://[::1]:80/', 'https://app.localhost/', `file://${WS}/.aicl/a.html`]) {
      assert.equal(isFreeUrl(url, WS), true, url);
    }
  });
  it('gates other hosts, lookalikes and files outside the workspace', () => {
    for (const url of ['https://example.com/', 'http://localhost.evil.com/', 'http://127.0.0.1.evil.com/', 'file:///etc/passwd', `file://${WS}/../x`, 'javascript:alert(1)', 'not a url']) {
      assert.equal(isFreeUrl(url, WS), false, url);
    }
  });
  it('names the host to ask about and normalizes typed input', () => {
    assert.equal(hostKey('https://Example.com/a?b'), 'example.com');
    assert.equal(hostKey('file:///etc/passwd'), 'local files');
    assert.equal(normalizeUrl('example.com/x'), 'https://example.com/x');
    assert.equal(normalizeUrl('localhost:5173'), 'http://localhost:5173');
    assert.equal(normalizeUrl('http://a.test'), 'http://a.test');
    assert.equal(summarizeUrl('http://localhost:5173/gallery.html'), 'localhost:5173/gallery.html');
    assert.equal(summarizeUrl('http://localhost:5173/'), 'localhost:5173');
  });
});

describe('coordinate scaling', () => {
  it('maps viewer fractions to page pixels and clamps', () => {
    const vp = VIEWPORTS.desktop;
    assert.deepEqual(scalePoint(0, 0, vp), { x: 0, y: 0 });
    assert.deepEqual(scalePoint(1, 1, vp), { x: 1279, y: 799 });
    assert.deepEqual(scalePoint(0.5, 0.5, { width: 400, height: 200 }), { x: 200, y: 100 });
    assert.deepEqual(scalePoint(-3, 9, vp), { x: 0, y: 799 });
    assert.deepEqual(scalePoint(Number.NaN, 0.5, vp), { x: 0, y: 400 });
  });
  it('round-trips to fractions', () => {
    assert.deepEqual(toFraction(640, 400, VIEWPORTS.desktop), { nx: 0.5, ny: 0.5 });
  });
});

describe('outline format', () => {
  it('prints roles, names, state and refs compactly', () => {
    const text = formatOutline(
      [
        { role: 'heading', name: 'Counter', level: 1 },
        { role: 'button', name: 'Count', ref: 'e1' },
        { role: 'textbox', name: 'Name', value: 'Ada', ref: 'e2' },
        { role: 'checkbox', name: 'Agree', checked: true, ref: 'e3' },
        { role: 'link', name: 'Docs', href: '/docs', ref: 'e4', disabled: true },
      ],
      { title: 'T', url: 'file:///t.html' },
    );
    assert.equal(
      text,
      ['page: "T" <file:///t.html>', '- heading(1) "Counter"', '- button "Count" [e1]', '- textbox "Name" value="Ada" [e2]', '- checkbox "Agree" [checked] [e3]', '- link "Docs" [disabled] -> /docs [e4]'].join('\n'),
    );
  });
  it('says when it is capped or empty', () => {
    assert.match(formatOutline([{ role: 'button', name: 'a', ref: 'e1' }, { role: 'button', name: 'b', ref: 'e2' }], { title: '', url: 'x' }, 2), /capped at 2/);
    assert.match(formatOutline([], { title: '', url: 'x' }), /no interactive/);
  });
});

describe('real chromium on a file page', () => {
  const workspace = mkdtempSync(path.join(tmpdir(), 'aicl-browser-'));
  mkdirSync(path.join(workspace, '.aicl'), { recursive: true });
  const file = path.join(workspace, '.aicl', 'page.html');
  writeFileSync(
    file,
    `<!doctype html><title>Counter page</title><main><h1>Counter</h1>
<p id="n">Count: 0</p><button onclick="document.getElementById('n').textContent='Count: '+(++window.c||(window.c=1))">Count</button>
<label>Name <input id="name"></label><a href="#x">Docs</a><button style="display:none">Hidden</button></main>`,
  );
  const events: unknown[] = [];
  const surfaces = createSurfaceRegistry({ broadcast: (e) => events.push(e) });
  const feature = createBrowserSurface({ workspace, relay: { broadcast: () => {} } as never, hub: () => ({}) as never, surfaces });
  const tool = (name: string) => feature.tools.find((t) => t.name === name)!;
  const run = async (name: string, params: Record<string, unknown>) => {
    const result = await (tool(name).execute as (...a: unknown[]) => Promise<{ content: Array<{ type: string; text?: string; data?: string }> }>)('t', params, undefined, undefined, {});
    return result.content.map((c) => c.text ?? `[${c.type}]`).join('\n');
  };
  let id = '';

  after(async () => {
    if (!id) return;
    const handler = surfaces.routes['DELETE /api/surfaces/:kind/:id']!;
    await handler({} as never, { writeHead() {}, end() {} } as never, { url: new URL('http://x'), params: { kind: 'browser', id } });
  });

  it('opens a workspace file without asking and registers the surface', async () => {
    const out = await run('browser_open', { url: pathToFileURL(file).href, viewport: 'mobile' });
    id = /surface (br-\w+)/.exec(out)![1]!;
    assert.match(out, /Counter page/);
    const info = surfaces.get('browser', id)!;
    assert.equal(info.openedBy, 'agent');
    assert.equal(info.meta?.['width'], 390);
    assert.equal(info.summary, 'page.html');
  });

  it('snapshots with refs and skips hidden elements', async () => {
    const out = await run('browser_snapshot', { id });
    assert.match(out, /heading\(1\) "Counter"/);
    assert.match(out, /button "Count" \[e1\]/);
    assert.match(out, /textbox "Name" \[e2\]/);
    assert.match(out, /link "Docs".*\[e3\]/);
    assert.doesNotMatch(out, /Hidden/);
  });

  it('clicks by ref, by text and types into an input', async () => {
    await run('browser_click', { id, ref: 'e1' });
    await run('browser_click', { id, text: 'Count' });
    assert.match(await run('browser_read', { id }), /Count: 2/);
    await run('browser_type', { id, ref: 'e2', text: 'Ada' });
    assert.match(await run('browser_snapshot', { id }), /textbox "Name" value="Ada"/);
    await assert.rejects(run('browser_click', { id, ref: 'e99' }), /Refs expire/);
  });

  it('screenshots as an image', async () => {
    assert.match(await run('browser_screenshot', { id }), /\[image\]/);
  });
});
