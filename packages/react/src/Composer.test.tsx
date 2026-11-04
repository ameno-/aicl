import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TestRenderer, { act } from 'react-test-renderer';

type Tree = ReturnType<typeof TestRenderer.create>;

import { Composer } from './Composer.js';

test('the default arrangement is unchanged', () => {
  const html = renderToStaticMarkup(createElement(Composer, { onSubmit: () => {} }));

  assert.match(html, /data-aicl="composer"/);
  assert.match(html, /data-aicl="composer-input"/);
  assert.match(html, /data-aicl="composer-submit"/);
  assert.match(html, /data-role="send"/);
});

test('the compound form arranges the subparts', () => {
  const html = renderToStaticMarkup(
    createElement(
      Composer,
      { onSubmit: () => {} },
      createElement(Composer.Body, null, createElement(Composer.Input, null)),
      createElement(Composer.Submit, null),
    ),
  );

  assert.match(html, /data-aicl="composer"/);
  assert.match(html, /data-aicl="composer-body"/);
  assert.match(html, /data-aicl="composer-input"/);
  assert.match(html, /data-aicl="composer-submit"/);
});

test('a node child replaces the default arrangement', () => {
  const html = renderToStaticMarkup(
    createElement(
      Composer,
      { onSubmit: () => {} },
      createElement(Composer.Input, null),
    ),
  );

  assert.match(html, /data-aicl="composer-input"/);
  // The default submit action is not rendered when the consumer arranges.
  assert.doesNotMatch(html, /data-aicl="composer-submit"/);
});

test('a text child replaces the default arrangement too', () => {
  // Children replace the arrangement, whatever they are. This is the React
  // model, and it is why the compound form is the only way to rearrange.
  const html = renderToStaticMarkup(
    createElement(Composer, { onSubmit: () => {} }, 'Ask'),
  );

  assert.match(html, /Ask/);
  assert.doesNotMatch(html, /data-aicl="composer-input"/);
});

test('a function child still owns everything, including the wrapper', () => {
  const html = renderToStaticMarkup(
    createElement(
      Composer,
      { onSubmit: () => {} },
      ((api: { value: string }) => createElement('span', { 'data-testid': 'own' }, api.value)) as never,
    ),
  );

  assert.match(html, /data-testid="own"/);
  assert.doesNotMatch(html, /data-aicl="composer"/);
});

test('Enter submits, Shift+Enter does not', () => {
  const sent: string[] = [];
  let tree!: Tree;

  tree = TestRenderer.create(
    createElement(Composer, { onSubmit: (text: string) => sent.push(text), value: 'hello' }),
  );

  const input = tree.root.findByProps({ 'data-aicl': 'composer-input' });

  act(() => {
    input.props.onKeyDown({ key: 'Enter', shiftKey: false, nativeEvent: { isComposing: false }, preventDefault: () => {} });
  });
  assert.deepEqual(sent, ['hello']);

  act(() => {
    input.props.onKeyDown({ key: 'Enter', shiftKey: true, nativeEvent: { isComposing: false }, preventDefault: () => {} });
  });
  assert.deepEqual(sent, ['hello'], 'Shift+Enter inserts a newline');
});

test('an IME composition is not a submit', () => {
  const sent: string[] = [];
  let tree!: Tree;

  tree = TestRenderer.create(
    createElement(Composer, { onSubmit: (text: string) => sent.push(text), value: 'にほん' }),
  );

  const input = tree.root.findByProps({ 'data-aicl': 'composer-input' });

  act(() => {
    input.props.onCompositionStart();
    input.props.onKeyDown({ key: 'Enter', shiftKey: false, nativeEvent: { isComposing: false }, preventDefault: () => {} });
  });
  assert.deepEqual(sent, [], 'Enter confirms the candidate, it does not send');

  act(() => {
    input.props.onCompositionEnd();
    input.props.onKeyDown({ key: 'Enter', shiftKey: false, nativeEvent: { isComposing: false }, preventDefault: () => {} });
  });
  assert.deepEqual(sent, ['にほん']);
});

test('the submit action becomes a stop control while streaming', () => {
  const html = renderToStaticMarkup(
    createElement(Composer, { onSubmit: () => {}, status: 'streaming' }),
  );

  assert.match(html, /data-role="stop"/);
  assert.match(html, /aria-label="Stop generating"/);
});

test('the submit action is disabled when there is nothing to send', () => {
  const html = renderToStaticMarkup(createElement(Composer, { onSubmit: () => {} }));

  assert.match(html, /data-aicl="composer-submit"[^>]*disabled/);
});

test('a supplied inputRef receives the field element', () => {
  const inputRef: { current: HTMLTextAreaElement | null } = { current: null };
  let tree!: Tree;

  tree = TestRenderer.create(
    createElement(Composer, { onSubmit: () => {}, inputRef }, createElement(Composer.Input, null)),
    {
      createNodeMock: (element) =>
        element.type === 'textarea' ? ({ focus: () => {}, style: {}, scrollHeight: 20 } as unknown as object) : null,
    },
  );

  assert.ok(inputRef.current, 'the consumer sees the field');
});
