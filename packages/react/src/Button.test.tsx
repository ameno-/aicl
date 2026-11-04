import assert from 'node:assert/strict';
import { test } from 'node:test';
import { create, type ReactTestRenderer } from 'react-test-renderer';

import { Button } from './Button.js';
import { IconProvider } from './icons.js';

function render(node: Parameters<typeof create>[0]): ReactTestRenderer {
  return create(node);
}

test('a button publishes its variant, size and loading state', () => {
  const tree = render(<Button variant="secondary" size="lg" loading>Save</Button>);
  const button = tree.root.findByProps({ 'data-aicl': 'button' });

  assert.equal(button.props['data-variant'], 'secondary');
  assert.equal(button.props['data-size'], 'lg');
  assert.equal(button.props['data-loading'], true);
  assert.equal(button.props['aria-busy'], true);
});

test('a button defaults to type=button, so it cannot submit a form by accident', () => {
  const tree = render(<Button>Send</Button>);
  const button = tree.root.findByProps({ 'data-aicl': 'button' });

  assert.equal(button.props.type, 'button');
});

test('a button inside a form can still submit it', () => {
  const tree = render(<Button type="submit">Send</Button>);
  const button = tree.root.findByProps({ 'data-aicl': 'button' });

  assert.equal(button.props.type, 'submit');
});

test('a loading button is busy but not disabled', () => {
  // A disabled button cannot be found by a screen reader in a busy state,
  // so loading and disabled are different things.
  const tree = render(<Button loading>Working</Button>);
  const button = tree.root.findByProps({ 'data-aicl': 'button' });

  assert.equal(button.props.disabled, undefined);
  assert.equal(button.props['aria-busy'], true);
});

test('a button renders a label slot and icon slots', () => {
  const tree = render(
    <Button icon="plus" trailingIcon="check">
      Add
    </Button>,
  );

  assert.ok(tree.root.findByProps({ 'data-aicl': 'button-label' }));
  const icons = tree.root.findAllByProps({ 'data-aicl': 'button-icon' });
  assert.equal(icons.length, 2);
  assert.equal(icons[0]!.props['data-icon'], 'plus');
  assert.equal(icons[1]!.props['data-icon'], 'check');
});

test('a button with no children renders no label slot', () => {
  const tree = render(<Button icon="plus" aria-label="Add" />);

  assert.equal(tree.root.findAllByProps({ 'data-aicl': 'button-label' }).length, 0);
});

test('an icon slot resolves through the provider', () => {
  const tree = render(
    <IconProvider icons={{ plus: () => <span data-testid="custom-plus" /> }}>
      <Button icon="plus">Add</Button>
    </IconProvider>,
  );

  assert.ok(tree.root.findByProps({ 'data-testid': 'custom-plus' }));
});
