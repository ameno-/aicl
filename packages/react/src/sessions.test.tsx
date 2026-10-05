import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TestRenderer, { act } from 'react-test-renderer';
import type { SessionMeta } from '@aicl/core';
import { resolveSecondary, SessionList, SessionSearch, SidebarNav } from './sessions.js';

const byId: Record<string, SessionMeta> = {
  a: { id: 'a', title: 'Fix login', status: 'running', statusLine: 'PR is ready · ⎇1', preview: 'Working…' },
  b: { id: 'b', title: 'Write docs', preview: 'Drafted the intro' },
  c: { id: 'c', title: 'Old thing', updatedAt: Date.now() - 3 * 3_600_000 },
};
const groups = [
  { id: 'today', label: 'Today', ids: ['a', 'b'] },
  { id: 'older', label: 'Older', ids: ['c'] },
];
const fmt = () => '3h';

test('secondary line resolves status → preview → time → none', () => {
  assert.deepEqual(resolveSecondary(byId['a']!, fmt), { kind: 'status', text: 'PR is ready · ⎇1' });
  assert.deepEqual(resolveSecondary({ ...byId['a']!, status: 'idle' }, fmt), { kind: 'preview', text: 'Working…' });
  assert.deepEqual(resolveSecondary(byId['c']!, fmt), { kind: 'time', text: '3h' });
  assert.deepEqual(resolveSecondary({ id: 'x', title: 'x' }, fmt), { kind: 'none' });
});

test('session list is a grouped listbox with exactly one active row', () => {
  const html = renderToStaticMarkup(createElement(SessionList, { groups, byId, activeId: 'b', header: 'New' }));
  assert.match(html, /role="listbox"/);
  assert.equal(html.match(/role="group"/g)?.length, 2);
  assert.equal(html.match(/data-active="true"/g)?.length, 1);
  assert.match(html, /data-pinned=""/);
  assert.match(html, /data-secondary="status"/);
  assert.match(html, /aria-activedescendant="[^"]+-b"/);
});

test('session list keyboard: arrows move active, End jumps, Enter selects', () => {
  const selected: string[] = [];
  const r = TestRenderer.create(createElement(SessionList, { groups, byId, onSelect: (id) => selected.push(id) }));
  const key = (k: string) =>
    act(() => r.root.findByProps({ role: 'listbox' }).props.onKeyDown({ key: k, preventDefault() {} }));
  key('ArrowDown');
  key('ArrowDown');
  const active = () => r.root.findAll((n) => n.props['data-active'] === true).map((n) => n.props['data-session-id']);
  assert.deepEqual(active(), ['b']);
  key('End');
  assert.deepEqual(active(), ['c']);
  key('Enter');
  assert.deepEqual(selected, ['c']);
});

test('session list empty and loading states', () => {
  const empty = renderToStaticMarkup(createElement(SessionList, { groups: [], byId: {}, empty: 'Nothing here' }));
  assert.match(empty, /data-empty="true"/);
  assert.match(empty, /Nothing here/);
  const loading = renderToStaticMarkup(createElement(SessionList, { groups, byId, loading: true }));
  assert.match(loading, /data-loading="true"/);
  assert.equal(loading.match(/data-aicl="session-skeleton"/g)?.length, 4);
  assert.doesNotMatch(loading, /role="listbox"/);
});

test('session search: combobox input, announced count, Enter selects active', () => {
  const html = renderToStaticMarkup(
    createElement(SessionSearch, { value: '', onChange: () => {}, groups, byId, variant: 'modal' }),
  );
  assert.match(html, /role="combobox"/);
  assert.match(html, /data-variant="modal"/);
  assert.match(html, /3 results/);

  const chosen: string[] = [];
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(
      createElement(SessionSearch, { value: 'f', onChange: () => {}, groups, byId, onSelect: (id) => chosen.push(id) }),
    );
  });
  const input = () => r.root.findByProps({ role: 'combobox' });
  const key = (k: string) =>
    act(() => input().props.onKeyDown({ key: k, preventDefault() {}, nativeEvent: { isComposing: false } }));
  key('ArrowDown');
  key('Enter');
  assert.deepEqual(chosen, ['b']);
});

test('sidebar nav keeps every label in the DOM when collapsed', () => {
  const html = renderToStaticMarkup(
    createElement(SidebarNav, {
      collapsed: true,
      items: [
        { id: 'chat', label: 'Chat', active: true },
        { id: 'tasks', label: 'Tasks', href: '/tasks' },
      ],
    }),
  );
  assert.match(html, /data-state="collapsed"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, />Chat</);
  assert.match(html, />Tasks</);
  assert.match(html, /aria-current="page"/);
});
