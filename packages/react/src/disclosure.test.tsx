import assert from 'node:assert/strict';
import { test } from 'node:test';
import { create, type ReactTestRenderer } from 'react-test-renderer';

import { Accordion, Collapsible } from './disclosure.js';

function render(node: Parameters<typeof create>[0]): ReactTestRenderer {
  return create(node);
}

test('a collapsible starts closed and opens from its trigger', () => {
  const tree = render(
    <Collapsible>
      <Collapsible.Trigger>Worked for 11s</Collapsible.Trigger>
      <Collapsible.Panel>Edited two files.</Collapsible.Panel>
    </Collapsible>,
  );

  const root = () => tree.root.findByProps({ 'data-aicl': 'collapsible' });
  const trigger = () => tree.root.findByProps({ 'data-aicl': 'collapsible-trigger' });
  assert.equal(root().props['data-state'], 'closed');
  assert.equal(trigger().props['aria-expanded'], false);
  assert.equal(trigger().props.type, 'button');

  trigger().props.onClick();
  assert.equal(root().props['data-state'], 'open');
  assert.equal(trigger().props['aria-expanded'], true);
  assert.equal(tree.root.findByProps({ 'data-aicl': 'collapsible-body' }).children.join(''), 'Edited two files.');
});

test('a controlled collapsible reports the next state and does not move on its own', () => {
  const seen: boolean[] = [];
  const tree = render(
    <Collapsible open={false} onOpenChange={(open) => seen.push(open)}>
      <Collapsible.Trigger>Details</Collapsible.Trigger>
      <Collapsible.Panel>Hidden.</Collapsible.Panel>
    </Collapsible>,
  );

  tree.root.findByProps({ 'data-aicl': 'collapsible-trigger' }).props.onClick();
  assert.deepEqual(seen, [true]);
  assert.equal(tree.root.findByProps({ 'data-aicl': 'collapsible' }).props['data-state'], 'closed');
});

test('an accordion opens one row and closes it when opened again', () => {
  const tree = render(
    <Accordion defaultValue="a">
      <Accordion.Item value="a">
        <Accordion.Trigger>First</Accordion.Trigger>
        <Accordion.Panel>One</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="b">
        <Accordion.Trigger>Second</Accordion.Trigger>
        <Accordion.Panel>Two</Accordion.Panel>
      </Accordion.Item>
    </Accordion>,
  );

  const states = () =>
    tree.root.findAllByProps({ 'data-aicl': 'accordion-item' }).map((item) => item.props['data-state']);
  assert.deepEqual(states(), ['open', 'closed']);

  const triggers = () => tree.root.findAllByProps({ 'data-aicl': 'accordion-trigger' });
  triggers()[1]!.props.onClick();
  assert.deepEqual(states(), ['closed', 'open']);
  triggers()[1]!.props.onClick();
  assert.deepEqual(states(), ['closed', 'closed']);
});

test('a multiple accordion keeps the rows that are already open', () => {
  const tree = render(
    <Accordion type="multiple" defaultValue={['a']}>
      <Accordion.Item value="a">
        <Accordion.Trigger>First</Accordion.Trigger>
        <Accordion.Panel>One</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="b">
        <Accordion.Trigger>Second</Accordion.Trigger>
        <Accordion.Panel>Two</Accordion.Panel>
      </Accordion.Item>
    </Accordion>,
  );

  tree.root.findAllByProps({ 'data-aicl': 'accordion-trigger' })[1]!.props.onClick();
  assert.deepEqual(
    tree.root.findAllByProps({ 'data-aicl': 'accordion-item' }).map((item) => item.props['data-state']),
    ['open', 'open'],
  );
  assert.equal(tree.root.findByProps({ 'data-aicl': 'accordion' }).props['data-type'], 'multiple');
});
