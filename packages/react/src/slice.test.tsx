import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TestRenderer from 'react-test-renderer';
import type { Message } from '@aicl/core';
import { Composer } from './Composer.js';
import { Transcript } from './Transcript.js';

test('composer is one button and does not offer stop before streaming', () => {
  const submitted = renderToStaticMarkup(
    createElement(Composer, { status: 'submitted', onSubmit: () => {}, onStop: () => {} }),
  );
  assert.equal(submitted.match(/data-aicl="composer-submit"/g)?.length, 1);
  assert.match(submitted, /data-role="send"/);
  assert.match(submitted, /data-state="submitted"/);
  assert.doesNotMatch(submitted, /data-role="stop"/);
  assert.match(submitted, /<textarea[^>]*aria-label="Message"/);
  assert.doesNotMatch(submitted, /<textarea[^>]*disabled/);

  const streaming = renderToStaticMarkup(
    createElement(Composer, { status: 'streaming', onSubmit: () => {}, onStop: () => {} }),
  );
  assert.equal(streaming.match(/data-aicl="composer-submit"/g)?.length, 1);
  assert.match(streaming, /data-role="stop"/);
  assert.match(streaming, /data-state="streaming"/);
});

test('unknown part falls back and does not drop the rest of the message', () => {
  const message: Message = {
    id: 'm1',
    role: 'assistant',
    parts: [
      { type: 'text', text: 'still here' },
      { type: 'data-mystery', data: {} },
    ],
  };
  const html = renderToStaticMarkup(
    createElement(Transcript, { messages: [message], status: 'idle' }),
  );
  assert.match(html, /still here/);
  assert.match(html, /data-part="unknown"/);
  assert.match(html, /data-raw-type="data-mystery"/);
  assert.match(html, /role="log"/);
});

test('live region node identity survives a token append', () => {
  const message = (text: string): Message => ({
    id: 'a1',
    role: 'assistant',
    parts: [{ type: 'text', text }],
  });
  const renderer = TestRenderer.create(
    createElement(Transcript, { messages: [message('Hel')], status: 'streaming', streamingId: 'a1' }),
  );
  const before = renderer.root.findByProps({ role: 'log' });
  renderer.update(
    createElement(Transcript, { messages: [message('Hello')], status: 'streaming', streamingId: 'a1' }),
  );
  assert.equal(renderer.root.findByProps({ role: 'log' }), before);
});
