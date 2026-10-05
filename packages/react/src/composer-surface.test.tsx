import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TestRenderer, { act } from 'react-test-renderer';
import { Composer } from './Composer.js';
import { AttachmentChip, findTrigger, matchesAccept, SuggestionChips } from './composer-surface.js';

test('trigger fires only at a word boundary and closes on whitespace', () => {
  assert.deepEqual(findTrigger('/sum', 4, '/'), { start: 0, query: 'sum' });
  assert.deepEqual(findTrigger('ask @ann', 8, '@'), { start: 4, query: 'ann' });
  assert.equal(findTrigger('mail a@b.com', 12, '@'), null, 'mid-word @ is not a trigger');
  assert.equal(findTrigger('@ann then', 9, '@'), null, 'whitespace ends the token');
  assert.equal(findTrigger('no trigger', 10, '/'), null);
  assert.deepEqual(findTrigger('/', 1, '/'), { start: 0, query: '' });
});

test('accept grammar matches input[accept]', () => {
  const png = { name: 'Shot.PNG', type: 'image/png' };
  assert.ok(matchesAccept(png, 'image/*'));
  assert.ok(matchesAccept(png, '.png,.jpg'));
  assert.ok(matchesAccept(png, 'application/pdf, image/png'));
  assert.ok(!matchesAccept(png, 'application/pdf,.md'));
  assert.ok(matchesAccept(png, undefined));
});

test('attachment chip exposes status, progress, and labelled controls', () => {
  const uploading = renderToStaticMarkup(
    createElement(AttachmentChip, {
      attachment: { id: 'a', name: 'notes.md', mediaType: 'text/markdown', status: 'uploading', progress: 0.42 },
      onRemove: () => {},
    }),
  );
  assert.match(uploading, /data-status="uploading"/);
  assert.match(uploading, /data-progress="42"/);
  assert.match(uploading, /role="progressbar"[^>]*aria-valuenow="42"/);
  assert.match(uploading, /aria-label="Remove notes.md"/);

  const failed = renderToStaticMarkup(
    createElement(AttachmentChip, {
      attachment: { id: 'a', name: 'notes.md', mediaType: 'text/markdown', status: 'error' },
      onRetry: () => {},
    }),
  );
  assert.match(failed, /data-status="error"/);
  assert.match(failed, /aria-label="Retry notes.md"/);
});

test('suggestion chips are one tab stop; arrows move, click selects with the behaviour', () => {
  const picked: string[] = [];
  const r = TestRenderer.create(
    createElement(SuggestionChips, {
      suggestions: [
        { id: 'a', label: 'Explain' },
        { id: 'b', label: 'Shorter' },
      ],
      behavior: 'send',
      onSelect: (s, b) => picked.push(`${s.id}:${b}`),
    }),
  );
  const tabStops = () => r.root.findAllByType('button').map((b) => b.props.tabIndex);
  assert.deepEqual(tabStops(), [0, -1]);
  const group = r.root.findByProps({ role: 'group' });
  act(() => group.props.onKeyDown({ key: 'ArrowRight', preventDefault() {} }));
  assert.deepEqual(tabStops(), [-1, 0]);
  act(() => r.root.findAllByType('button')[1]!.props.onClick());
  assert.deepEqual(picked, ['b:send']);
  assert.equal(
    renderToStaticMarkup(createElement(SuggestionChips, { suggestions: [], onSelect: () => {} })),
    '',
    'empty renders nothing',
  );
});

test('composer counts attachments-only drafts as sendable and renders chips', () => {
  const html = renderToStaticMarkup(
    createElement(Composer, {
      status: 'idle',
      onSubmit: () => {},
      attachments: [{ id: 'f', name: 'plan.pdf', mediaType: 'application/pdf', status: 'ready' }],
    }),
  );
  assert.match(html, /data-aicl="attachment-chip"/);
  assert.match(html, /data-has-attachments/);
  assert.doesNotMatch(html, /data-aicl="composer-submit"[^>]*disabled/);
});

test('composer honours a controlled value', () => {
  const html = renderToStaticMarkup(createElement(Composer, { status: 'idle', value: 'draft', onSubmit: () => {} }));
  assert.match(html, />draft<\/textarea>/);
  assert.match(html, /data-has-text/);
});
