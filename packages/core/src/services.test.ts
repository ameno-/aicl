import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createComboboxModel } from './combobox.js';
import { bucketByRecency, createSessionStore } from './session.js';
import { createToastQueue } from './toast.js';

test('combobox wraps and skips disabled items', () => {
  const cb = createComboboxModel<string>({ isDisabled: (i) => i === 'b' });
  cb.setItems(['a', 'b', 'c']);
  cb.open();
  assert.equal(cb.state.get().activeIndex, 0);
  cb.move(1);
  assert.equal(cb.state.get().activeIndex, 2, 'skips disabled b');
  cb.move(1);
  assert.equal(cb.state.get().activeIndex, 0, 'wraps');
  cb.move(-1);
  assert.equal(cb.state.get().activeIndex, 2);
  assert.equal(cb.accept(), 'c');
  assert.equal(cb.state.get().open, false);
});

test('combobox keeps the active item across filtering when it survives', () => {
  const cb = createComboboxModel<string>();
  cb.setItems(['alpha', 'beta', 'gamma']);
  cb.setActive(2);
  cb.setItems(['beta', 'gamma']);
  assert.equal(cb.state.get().activeIndex, 1);
  cb.setItems([]);
  assert.equal(cb.state.get().activeIndex, -1);
  assert.equal(cb.accept(), undefined);
});

test('session store patches one row and keeps group order', () => {
  const store = createSessionStore([
    { id: 'g1', label: 'Today', sessions: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }] },
  ]);
  const before = store.get();
  store.patch('b', { status: 'running' });
  const after = store.get();
  assert.equal(after.byId['a'], before.byId['a'], 'untouched rows keep identity');
  assert.equal(after.byId['b']!.status, 'running');
  assert.deepEqual(after.groups[0]!.ids, ['a', 'b']);
  store.upsert({ id: 'c', title: 'C' });
  assert.deepEqual(store.get().groups[0]!.ids, ['c', 'a', 'b']);
  store.setActive('a');
  store.remove('a');
  assert.equal(store.get().activeId, undefined);
  assert.equal(store.meta('a'), undefined);
});

test('bucketByRecency groups by day without sorting', () => {
  const now = new Date(2026, 9, 4, 15).getTime();
  const day = 86_400_000;
  const groups = bucketByRecency(
    [
      { id: 'old', title: 'old', updatedAt: now - 90 * day },
      { id: 'today', title: 'today', updatedAt: now - 60_000 },
      { id: 'yday', title: 'yday', updatedAt: now - day },
    ],
    now,
  );
  assert.deepEqual(
    groups.map((g) => [g.label, g.sessions.map((s) => s.id)]),
    [
      ['Today', ['today']],
      ['Yesterday', ['yday']],
      ['Older', ['old']],
    ],
  );
});

test('toast queue: auto-dismiss, pause keeps remaining time, FIFO overflow, errors with actions persist', () => {
  let now = 0;
  const pending = new Map<number, { at: number; fn: () => void }>();
  let handles = 0;
  const clock = {
    now: () => now,
    setTimeout: (fn: () => void, ms: number) => {
      pending.set(++handles, { at: now + ms, fn });
      return handles;
    },
    clearTimeout: (h: unknown) => void pending.delete(h as number),
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [h, t] of [...pending]) if (t.at <= now) (pending.delete(h), t.fn());
  };

  const q = createToastQueue({ maxVisible: 2, defaultDuration: 1000, clock });
  const a = q.push({ title: 'Saved' });
  advance(600);
  q.pauseAll();
  advance(5000);
  assert.equal(q.state.get().length, 1, 'paused toasts stay');
  q.resumeAll();
  advance(399);
  assert.equal(q.state.get().length, 1);
  advance(1);
  assert.equal(q.state.get().length, 0, 'dismissed after the remaining 400ms');

  q.push({ title: 'one' });
  q.push({ title: 'two' });
  q.push({ title: 'three' });
  assert.deepEqual(q.state.get().map((t: { title: string }) => t.title), ['two', 'three']);

  const err = q.push({ title: 'Failed', variant: 'error', action: { label: 'Retry', onAction: () => {} } });
  advance(60_000);
  assert.ok(q.state.get().some((t: { id: string }) => t.id === err), 'error with action persists');
  assert.notEqual(a, err);
});
