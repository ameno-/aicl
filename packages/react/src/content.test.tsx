import assert from 'node:assert/strict';
import { test } from 'node:test';
import { create, type ReactTestRenderer } from 'react-test-renderer';

import { Alert, Badge, Card, Empty, Kbd, Progress, Separator, Skeleton, Spinner, Tooltip } from './content.js';

function render(node: Parameters<typeof create>[0]): ReactTestRenderer {
  return create(node);
}

test('a badge publishes its variant', () => {
  const tree = render(<Badge variant="success">Live</Badge>);
  const badge = tree.root.findByProps({ 'data-aicl': 'badge' });
  assert.equal(badge.props['data-variant'], 'success');
  assert.equal(badge.children.join(''), 'Live');
});

test('a decorative separator is not announced, and a semantic one is', () => {
  const decorative = render(<Separator />);
  assert.equal(decorative.root.findByProps({ 'data-aicl': 'separator' }).props.role, 'none');

  const semantic = render(<Separator decorative={false} orientation="vertical" />);
  const rule = semantic.root.findByProps({ 'data-aicl': 'separator' });
  assert.equal(rule.props.role, 'separator');
  assert.equal(rule.props['aria-orientation'], 'vertical');
  assert.equal(rule.props['data-orientation'], 'vertical');
});

test('a kbd renders a keycap', () => {
  const tree = render(<Kbd>⌘K</Kbd>);
  assert.equal(tree.root.findByType('kbd').children.join(''), '⌘K');
});

test('progress is determinate with a value and indeterminate without one', () => {
  const done = render(<Progress value={25} label="Uploading" />);
  const bar = done.root.findByProps({ 'data-aicl': 'progress' });
  assert.equal(bar.props['data-state'], 'determinate');
  assert.equal(bar.props['aria-valuenow'], 25);
  assert.equal(done.root.findByProps({ 'data-aicl': 'progress-bar' }).props.style.width, '25%');

  const waiting = render(<Progress label="Working" />);
  const indeterminate = waiting.root.findByProps({ 'data-aicl': 'progress' });
  assert.equal(indeterminate.props['data-state'], 'indeterminate');
  assert.equal(indeterminate.props['aria-valuenow'], undefined);
});

test('progress clamps a value past the maximum', () => {
  const tree = render(<Progress value={400} max={200} label="Tokens" />);
  assert.equal(tree.root.findByProps({ 'data-aicl': 'progress-bar' }).props.style.width, '100%');
});

test('a skeleton is hidden from assistive tech', () => {
  const tree = render(<Skeleton width={120} height={12} />);
  const skeleton = tree.root.findByProps({ 'data-aicl': 'skeleton' });
  assert.equal(String(skeleton.props['aria-hidden']), 'true');
  assert.equal(skeleton.props.style.width, '120px');
});

test('a spinner names itself and spins the icon slot', () => {
  const tree = render(<Spinner label="Thinking" />);
  const status = tree.root.findByProps({ 'data-aicl': 'spinner' });
  assert.equal(status.props.role, 'status');
  assert.equal(tree.root.findByProps({ 'data-aicl': 'visually-hidden' }).children.join(''), 'Thinking');
  assert.equal(tree.root.findByProps({ 'data-aicl': 'icon' }).props['data-spin'], true);
});

test('an alert publishes its variant and its subparts', () => {
  const tree = render(
    <Alert variant="warning">
      <Alert.Title>Needs you</Alert.Title>
      <Alert.Description>Approve the command to continue.</Alert.Description>
    </Alert>,
  );
  assert.equal(tree.root.findByProps({ 'data-aicl': 'alert' }).props['data-variant'], 'warning');
  assert.equal(tree.root.findByProps({ 'data-aicl': 'alert-title' }).children.join(''), 'Needs you');
  assert.ok(tree.root.findByProps({ 'data-aicl': 'alert-icon' }));
});

test('a card and an empty state render their subparts', () => {
  const card = render(
    <Card>
      <Card.Header>
        <Card.Title>Plan</Card.Title>
        <Card.Description>Three steps.</Card.Description>
      </Card.Header>
      <Card.Body>Write the failing test.</Card.Body>
      <Card.Footer>1 / 3</Card.Footer>
    </Card>,
  );
  assert.equal(card.root.findByProps({ 'data-aicl': 'card-title' }).children.join(''), 'Plan');
  assert.equal(card.root.findByProps({ 'data-aicl': 'card-footer' }).children.join(''), '1 / 3');

  const empty = render(
    <Empty>
      <Empty.Title>No sessions yet</Empty.Title>
      <Empty.Description>Start one from the composer.</Empty.Description>
      <Empty.Actions>New</Empty.Actions>
    </Empty>,
  );
  assert.equal(empty.root.findByProps({ 'data-aicl': 'empty-title' }).children.join(''), 'No sessions yet');
});

test('a tooltip is hidden until it opens, and stays in the DOM', () => {
  const tree = render(
    <Tooltip content="Copy">
      <button type="button">Copy</button>
    </Tooltip>,
  );
  const anchor = tree.root.findByProps({ 'data-aicl': 'tooltip-anchor' });
  const tip = tree.root.findByProps({ 'data-aicl': 'tooltip' });
  assert.equal(anchor.props['data-state'], 'closed');
  assert.equal(tip.props['aria-hidden'], true);
  assert.equal(tip.children.join(''), 'Copy');

  anchor.props.onFocus();
  assert.equal(tree.root.findByProps({ 'data-aicl': 'tooltip' }).props['aria-hidden'], undefined);
  anchor.props.onBlur();
  assert.equal(tree.root.findByProps({ 'data-aicl': 'tooltip' }).props['aria-hidden'], true);
});
