import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Message } from '@aicl/core';
import { MarkdownTextPart } from './markdown.js';

const render = (role: Message['role'], text: string) => {
  const part = { type: 'text' as const, text };
  const message: Message = { id: 'm', role, parts: [part] };
  return renderToStaticMarkup(createElement(MarkdownTextPart, { part, message, index: 0, streaming: false }));
};

test('assistant markdown renders GFM: headings, lists, tables, inline code, links', () => {
  const html = render(
    'assistant',
    ['## Plan', '', '- **Read** the store', '- run `npm test`', '', '| a | b |', '|---|---|', '| 1 | 2 |', '', 'See [docs](https://example.com).'].join('\n'),
  );
  assert.match(html, /data-format="markdown"/);
  assert.match(html, /<h2>Plan<\/h2>/);
  assert.match(html, /<li><strong>Read<\/strong> the store<\/li>/);
  assert.match(html, /<code data-aicl="inline-code">npm test<\/code>/);
  assert.match(html, /<table>/);
  assert.match(html, /<a href="https:\/\/example.com" target="_blank" rel="noreferrer noopener">docs<\/a>/);
});

test('fenced code renders through CodeBlock with its language', () => {
  const html = render('assistant', '```ts\nconst x = 1;\n```');
  assert.match(html, /data-aicl="code-block"[^>]*data-language="ts"/);
  assert.match(html, /const x = 1;/);
  assert.doesNotMatch(html, /<pre><pre>/);
});

test('raw HTML from the model is not rendered', () => {
  const html = render('assistant', 'hi <img src=x onerror="alert(1)"> <script>alert(1)</script>');
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /<script/);
});

test('user messages stay verbatim', () => {
  const html = render('user', '**not bold**');
  assert.match(html, /\*\*not bold\*\*/);
  assert.doesNotMatch(html, /<strong>/);
});
