import assert from 'node:assert/strict';
import { test } from 'node:test';
import { create, type ReactTestRenderer } from 'react-test-renderer';

import { Badge } from './Badge.js';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './Collapsible.js';
import { Kbd } from './Kbd.js';
import { Progress } from './Progress.js';
import { Separator } from './Separator.js';
import { Tabs, TabsList, TabsPanel, TabsTab } from './Tabs.js';
import { Tooltip, TooltipContent, TooltipTrigger } from './Tooltip.js';

function render(node: Parameters<typeof create>[0]): ReactTestRenderer {
  return create(node);
}

test('a badge publishes its variant', () => {
  const tree = render(<Badge variant="success">Done</Badge>);
  const badge = tree.root.findByProps({ 'data-aicl': 'badge' });
  assert.equal(badge.props['data-variant'], 'success');
});

test('a separator is decorative by default and can be announced', () => {
  const decorative = render(<Separator />);
  assert.equal(decorative.root.findByProps({ 'data-aicl': 'separator' }).props.role, 'none');

  const announced = render(<Separator decorative={false} orientation="vertical" />);
  const node = announced.root.findByProps({ 'data-aicl': 'separator' });
  assert.equal(node.props.role, 'separator');
  assert.equal(node.props['aria-orientation'], 'vertical');
  assert.equal(node.props['data-orientation'], 'vertical');
});

test('kbd renders a chord as key slots', () => {
  const tree = render(<Kbd keys={['Meta', 'K']} />);
  const keys = tree.root.findAllByProps({ 'data-aicl': 'kbd-key' });
  assert.equal(keys.length, 2);
  assert.equal(keys[0]!.props.children, 'Meta');
  assert.equal(keys[1]!.props.children, 'K');
});

test('progress is determinate with a scaled fill, or indeterminate', () => {
  const bar = render(<Progress value={40} max={100} />);
  const root = bar.root.findByProps({ 'data-aicl': 'progress' });
  assert.equal(root.props['aria-valuenow'], 40);
  assert.equal(root.props['data-state'], 'determinate');
  const fill = bar.root.findByProps({ 'data-aicl': 'progress-fill' });
  assert.equal(fill.props.style.transform, 'scaleX(0.4)');

  const wait = render(<Progress indeterminate />);
  const waiting = wait.root.findByProps({ 'data-aicl': 'progress' });
  assert.equal(waiting.props['data-state'], 'indeterminate');
  assert.equal(waiting.props['aria-valuenow'], undefined);
});

test('collapsible is controlled and uncontrolled, and publishes open state', () => {
  const tree = render(
    <Collapsible defaultOpen>
      <CollapsibleTrigger>Reasoning</CollapsibleTrigger>
      <CollapsibleContent>The work</CollapsibleContent>
    </Collapsible>,
  );
  const root = tree.root.findByProps({ 'data-aicl': 'collapsible' });
  assert.equal(root.props['data-state'], 'open');
  const trigger = tree.root.findByProps({ 'data-aicl': 'collapsible-trigger' });
  assert.equal(trigger.props['aria-expanded'], true);
  trigger.props.onClick({ defaultPrevented: false });
  assert.equal(tree.root.findByProps({ 'data-aicl': 'collapsible' }).props['data-state'], 'closed');
});

test('tabs select a panel and mark the active tab', () => {
  const tree = render(
    <Tabs defaultValue="chat">
      <TabsList>
        <TabsTab value="chat">Chat</TabsTab>
        <TabsTab value="files">Files</TabsTab>
      </TabsList>
      <TabsPanel value="chat">Thread</TabsPanel>
      <TabsPanel value="files">Tree</TabsPanel>
    </Tabs>,
  );
  const tabs = tree.root.findAllByProps({ 'data-aicl': 'tabs-tab' });
  assert.equal(tabs[0]!.props['data-state'], 'active');
  assert.equal(tabs[1]!.props['data-state'], 'inactive');
  assert.equal(tree.root.findByProps({ 'data-aicl': 'tabs-panel', 'data-value': 'chat' }).props.children, 'Thread');

  tabs[1]!.props.onClick({ defaultPrevented: false });
  assert.equal(tree.root.findAllByProps({ 'data-aicl': 'tabs-tab' })[1]!.props['data-state'], 'active');
});

test('a tooltip short form wraps the trigger and hides the tip until open', () => {
  const tree = render(
    <Tooltip content="Copy" open>
      <button type="button">Copy</button>
    </Tooltip>,
  );
  const root = tree.root.findByProps({ 'data-aicl': 'tooltip' });
  assert.equal(root.props['data-state'], 'open');
  const tip = tree.root.findByProps({ 'data-aicl': 'tooltip-content' });
  assert.equal(tip.props.hidden, false);
  assert.equal(tip.props.role, 'tooltip');
});

test('a tooltip compound form keeps the tip closed by default', () => {
  const tree = render(
    <Tooltip>
      <TooltipTrigger>
        <button type="button">Hint</button>
      </TooltipTrigger>
      <TooltipContent>The hint</TooltipContent>
    </Tooltip>,
  );
  const tip = tree.root.findByProps({ 'data-aicl': 'tooltip-content' });
  assert.equal(tip.props.hidden, true);
  assert.equal(tip.props['data-state'], 'closed');
});
