import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TestRenderer, { act } from 'react-test-renderer';
import { createToastQueue } from '@aicl/core';
import { AlertDialog, Dialog, Drawer, Field, SegmentedControl, Select, Switch, ToastRegion } from './platform.js';

const render = (el: Parameters<typeof TestRenderer.create>[0]) => {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(el);
  });
  return r;
};

test('dialog: labelled modal; escape and scrim dismiss with a reason; dirty veto holds', () => {
  const closed: string[] = [];
  let veto = false;
  const tree = (open: boolean) =>
    h(
      Dialog,
      {
        open,
        portal: false,
        size: 'lg',
        dirty: true,
        onOpenChange: (_o: boolean, reason: string) => closed.push(reason),
        onDismissRequest: () => (veto ? false : undefined),
        children: [
          h(Dialog.Title, { key: 't', children: 'Settings' }),
          h(Dialog.Description, { key: 'd', children: 'Model and theme' }),
          h(Dialog.Close, { key: 'c' }),
        ],
      },
    );
  assert.equal(renderToStaticMarkup(tree(false)), '', 'closed renders nothing');
  const html = renderToStaticMarkup(tree(true));
  assert.match(html, /role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /data-size="lg"/);
  assert.match(html, /data-dirty="true"/);

  const r = render(tree(true));
  const layer = r.root.findByProps({ 'data-aicl': 'dialog-layer' });
  act(() => layer.props.onKeyDown({ key: 'Escape', stopPropagation() {} }));
  act(() => r.root.findByProps({ 'data-aicl': 'scrim' }).props.onClick());
  act(() => r.root.findByProps({ 'data-aicl': 'dialog-close' }).props.onClick());
  assert.deepEqual(closed, ['escape', 'scrim', 'close-button']);
  veto = true;
  act(() => layer.props.onKeyDown({ key: 'Escape', stopPropagation() {} }));
  assert.equal(closed.length, 3, 'vetoed');
});

test('alert dialog: no scrim dismiss, typed confirmation gates confirm, loading disables', () => {
  const events: string[] = [];
  const props = {
    open: true,
    portal: false,
    title: 'Delete session?',
    variant: 'danger' as const,
    consequence: 'This permanently deletes 42 messages.',
    confirmationValue: 'delete',
    onOpenChange: (_o: boolean, reason: string) => events.push(reason),
    onConfirm: () => events.push('confirm'),
  };
  const r = render(h(AlertDialog, props));
  assert.equal(r.root.findByProps({ 'data-aicl': 'alert-dialog' }).props['data-variant'], 'danger');
  act(() => r.root.findByProps({ 'data-aicl': 'scrim' }).props.onClick());
  assert.deepEqual(events, [], 'scrim does nothing');
  const confirm = () => r.root.findByProps({ 'data-aicl': 'alert-dialog-confirm' });
  assert.equal(confirm().props.disabled, true);
  act(() => r.root.findByType('input').props.onChange({ target: { value: 'delete' } }));
  assert.equal(confirm().props.disabled, false);
  act(() => confirm().props.onClick());
  assert.deepEqual(events, ['confirm']);
  act(() => r.update(h(AlertDialog, { ...props, confirmStatus: 'loading' })));
  assert.equal(confirm().props.disabled, true);
  assert.equal(r.root.findByProps({ 'data-aicl': 'alert-dialog-cancel' }).props.disabled, true);
});

test('drawer carries its side', () => {
  const html = renderToStaticMarkup(h(Drawer, { open: true, portal: false, side: 'right', onOpenChange: () => {}, children: 'x' }));
  assert.match(html, /data-aicl="drawer"[^>]*data-side="right"|data-side="right"[^>]*data-aicl="drawer"/);
});

test('toast region: polite status by default, assertive alert for actionable errors', () => {
  const q = createToastQueue();
  q.push({ title: 'Saved' });
  q.push({ title: 'Stream failed', variant: 'error', action: { label: 'Retry', onAction: () => {} } });
  const html = renderToStaticMarkup(h(ToastRegion, { queue: q }));
  assert.match(html, /data-count="2"/);
  assert.match(html, /role="status"[^>]*aria-live="polite"/);
  assert.match(html, /role="alert"[^>]*aria-live="assertive"/);
  assert.match(html, />Retry</);
});

test('field wires label, description, error, and save acknowledgement into the control', () => {
  const html = renderToStaticMarkup(
    h(Field, { label: 'Name', description: 'Shown to others', error: 'Required', saveState: 'saved', saveMode: 'auto', children: h('input') }),
  );
  const id = html.match(/<label for="([^"]+)"/)![1];
  assert.match(html, new RegExp(`<input id="${id}" aria-describedby="[^"]+-desc [^"]+-err" aria-invalid="true"`));
  assert.match(html, /data-invalid=""/);
  assert.match(html, /role="status"[^>]*>Saved</);
});

test('switch is role=switch and commits on toggle', () => {
  const seen: boolean[] = [];
  const r = render(h(Switch, { checked: false, label: 'Dark mode', onCheckedChange: (c: boolean) => seen.push(c) }));
  const btn = r.root.findByProps({ role: 'switch' });
  assert.equal(btn.props['aria-checked'], false);
  act(() => btn.props.onClick());
  assert.deepEqual(seen, [true]);
});

test('select: arrows open at the selected option, typeahead jumps, Enter commits, Escape closes', () => {
  const picked: string[] = [];
  const options = [
    { value: 'fable', label: 'Fable 5' },
    { value: 'opus', label: 'Opus 5.5' },
    { value: 'sonnet', label: 'Sonnet 5.5', disabled: true },
    { value: 'haiku', label: 'Haiku 4.5' },
  ];
  const r = render(h(Select<string>, { value: 'opus', options, onValueChange: (v: string) => picked.push(v), ariaLabel: 'Model' }));
  const trigger = () => r.root.findByProps({ role: 'combobox' });
  const key = (k: string) => act(() => trigger().props.onKeyDown({ key: k, preventDefault() {}, stopPropagation() {} }));
  key('ArrowDown');
  assert.equal(trigger().props['aria-expanded'], true);
  assert.match(trigger().props['aria-activedescendant'], /opt-1$/, 'opens on the selected option');
  key('ArrowDown');
  assert.match(trigger().props['aria-activedescendant'], /opt-3$/, 'skips disabled sonnet');
  key('f');
  assert.match(trigger().props['aria-activedescendant'], /opt-0$/, 'typeahead');
  key('Enter');
  assert.deepEqual(picked, ['fable']);
  assert.equal(trigger().props['aria-expanded'], false);
  key('ArrowDown');
  key('Escape');
  assert.equal(trigger().props['aria-expanded'], false);
});

test('segmented control: radiogroup, one tab stop, arrows move and select', () => {
  let value = 'list';
  const picked: string[] = [];
  const options = [
    { value: 'list', label: 'List' },
    { value: 'grid', label: 'Grid' },
    { value: 'board', label: 'Board' },
  ];
  const r = render(
    h(SegmentedControl<string>, { value, options, ariaLabel: 'Layout', onValueChange: (v: string) => picked.push((value = v)) }),
  );
  const radios = () => r.root.findAllByProps({ role: 'radio' });
  assert.deepEqual(radios().map((b) => b.props.tabIndex), [0, -1, -1]);
  const group = r.root.findByProps({ role: 'radiogroup' });
  act(() => group.props.onKeyDown({ key: 'ArrowLeft', preventDefault() {} }));
  act(() => group.props.onKeyDown({ key: 'End', preventDefault() {} }));
  assert.deepEqual(picked, ['board', 'board']);
});
