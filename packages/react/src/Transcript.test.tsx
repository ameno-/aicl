import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TestRenderer from 'react-test-renderer';
import type { Message } from '@aicl/core';

import { Transcript, TranscriptProvider, useTranscript } from './Transcript.js';

const message = (id: string, role: Message['role'], text: string, createdAt?: number): Message => ({
  id,
  role,
  createdAt,
  parts: [{ type: 'text', text }],
});

const thread = [
  message('u1', 'user', 'Show the work', Date.parse('2020-01-01T12:00:00Z')),
  message('a1', 'assistant', 'Partial reply', Date.parse('2020-01-03T12:00:00Z')),
];

test('a transcript with no children renders one live region and the rows', () => {
  const html = renderToStaticMarkup(createElement(Transcript, { messages: thread, status: 'idle' }));

  assert.equal(html.match(/role="log"/g)?.length, 1);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /data-aicl="transcript-root"/);
  assert.match(html, /data-aicl="transcript"/);
  assert.match(html, /data-status="idle"/);
  assert.match(html, /data-count="2"/);
  assert.equal(html.match(/data-aicl="message-row"/g)?.length, 2);
  assert.match(html, /Show the work/);
  assert.match(html, /Partial reply/);
  assert.equal(html.match(/data-aicl="day-separator"/g)?.length, 1);
  assert.match(html, /data-last-assistant="true"/);
  assert.doesNotMatch(html, /data-aicl="scroll-to-bottom"/);
});

test('the compound arrangement renders the same tree as the default', () => {
  const props = { messages: thread, status: 'streaming' as const, streamingId: 'a1' };
  const plain = renderToStaticMarkup(createElement(Transcript, props));
  const compound = renderToStaticMarkup(
    <Transcript {...props}>
      <Transcript.Scroller>
        <Transcript.Content />
      </Transcript.Scroller>
      <Transcript.JumpToLatest />
    </Transcript>,
  );

  assert.equal(compound, plain);
  assert.match(plain, /data-state="streaming"/);
});

test('custom children replace the default rows and keep the root', () => {
  const html = renderToStaticMarkup(
    <Transcript messages={thread} status="idle">
      <Transcript.Scroller>
        <p>Own rows</p>
      </Transcript.Scroller>
    </Transcript>,
  );

  assert.match(html, /data-aicl="transcript-root"/);
  assert.match(html, /role="log"/);
  assert.match(html, /Own rows/);
  assert.doesNotMatch(html, /Partial reply/);
  assert.doesNotMatch(html, /data-aicl="message-row"/);
});

test('a row outside the scroller still renders under the provider', () => {
  const html = renderToStaticMarkup(
    <TranscriptProvider messages={thread} status="idle" streamingId="a1">
      <Transcript.Item message={thread[1]!} />
    </TranscriptProvider>,
  );

  assert.match(html, /data-aicl="message-row"/);
  assert.match(html, /Partial reply/);
  assert.match(html, /data-state="streaming"/);
  assert.match(html, /data-last-assistant="true"/);
  assert.doesNotMatch(html, /role="log"/);
});

test('an item accepts actions without the default transcript wiring them', () => {
  const calls: string[] = [];
  const html = renderToStaticMarkup(
    <TranscriptProvider messages={thread} status="idle">
      <Transcript.Item
        message={thread[1]!}
        onAction={(action) => {
          calls.push(action);
        }}
      />
    </TranscriptProvider>,
  );

  assert.match(html, /data-aicl="message-actions"/);
  assert.equal(calls.length, 0);
});

test('useTranscript throws outside a transcript', () => {
  function Peek() {
    useTranscript();
    return null;
  }
  assert.throws(() => renderToStaticMarkup(createElement(Peek)), /useTranscript must be used within a Transcript/);
});

test('useTranscript reads the provider from inside a custom row', () => {
  function Count() {
    const api = useTranscript();
    return <span data-aicl="part">{api.messages.length}</span>;
  }
  const html = renderToStaticMarkup(
    <Transcript messages={thread} status="submitted">
      <Count />
    </Transcript>,
  );
  assert.match(html, />2</);
});

test('the live region node survives a token append when the parts are compound', () => {
  const streaming = (text: string): Message => message('a1', 'assistant', text);
  const renderer = TestRenderer.create(
    <Transcript messages={[streaming('Hel')]} status="streaming" streamingId="a1" />,
  );
  const before = renderer.root.findByProps({ role: 'log' });
  renderer.update(<Transcript messages={[streaming('Hello')]} status="streaming" streamingId="a1" />);
  assert.equal(renderer.root.findByProps({ role: 'log' }), before);
});
