import assert from 'node:assert/strict';
import { test } from 'node:test';
import { create, type ReactTestRenderer } from 'react-test-renderer';

import { Tabs } from './tabs.js';

function render(node: Parameters<typeof create>[0]): ReactTestRenderer {
  return create(node);
}

function key(tree: ReactTestRenderer, name: string) {
  const list = tree.root.findByProps({ 'data-aicl': 'tabs-list' });
  list.props.onKeyDown({ key: name, preventDefault() {}, currentTarget: {} });
}

test('tabs select a panel and park the pill on it', () => {
  let value = 'plan';
  const tree = render(
    <Tabs value={value} onValueChange={(next) => (value = next)}>
      <Tabs.List aria-label="Work">
        <Tabs.Tab value="plan">Plan</Tabs.Tab>
        <Tabs.Tab value="files">Files</Tabs.Tab>
        <Tabs.Tab value="terminal" disabled>Terminal</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="plan">The plan</Tabs.Panel>
      <Tabs.Panel value="files">The files</Tabs.Panel>
      <Tabs.Panel value="terminal">The terminal</Tabs.Panel>
    </Tabs>,
  );

  const panels = () => tree.root.findAllByProps({ 'data-aicl': 'tabs-panel' });
  assert.deepEqual(
    panels().map((panel) => panel.props.hidden),
    [false, true, true],
  );
  assert.equal(tree.root.findByProps({ 'data-aicl': 'tabs-indicator' }).props['data-index'], 0);
  assert.deepEqual(
    tree.root.findAllByProps({ role: 'tab' }).map((tab) => tab.props.tabIndex),
    [0, -1, -1],
  );

  key(tree, 'ArrowRight');
  assert.equal(value, 'files');
});

test('tabs are uncontrolled from defaultValue, and a disabled tab is skipped', () => {
  const tree = render(
    <Tabs defaultValue="plan">
      <Tabs.List aria-label="Work">
        <Tabs.Tab value="plan">Plan</Tabs.Tab>
        <Tabs.Tab value="files" disabled>Files</Tabs.Tab>
        <Tabs.Tab value="terminal">Terminal</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="plan">The plan</Tabs.Panel>
      <Tabs.Panel value="terminal">The terminal</Tabs.Panel>
    </Tabs>,
  );

  key(tree, 'ArrowRight');
  const selected = tree.root.findAllByProps({ role: 'tab' }).find((tab) => tab.props['aria-selected']);
  assert.equal(selected?.props['data-value'], 'terminal');
  assert.equal(tree.root.findByProps({ 'data-aicl': 'tabs-indicator' }).props['data-index'], 1);
});

test('Home and End move to the ends of the tablist', () => {
  const picked: string[] = [];
  const tree = render(
    <Tabs defaultValue="b" onValueChange={(value) => picked.push(value)}>
      <Tabs.List aria-label="Work">
        <Tabs.Tab value="a">A</Tabs.Tab>
        <Tabs.Tab value="b">B</Tabs.Tab>
        <Tabs.Tab value="c">C</Tabs.Tab>
      </Tabs.List>
    </Tabs>,
  );

  key(tree, 'End');
  key(tree, 'Home');
  assert.deepEqual(picked, ['c', 'a']);
});
