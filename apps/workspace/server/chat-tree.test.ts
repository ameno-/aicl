import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChatTree, folderForDrop } from '../shared/chat-tree.ts';
import type { SessionInfo } from '../shared/runtime.ts';

const s = (id: string, title: string, updatedAt: number, extra: Partial<SessionInfo> = {}): SessionInfo => ({ id, title, createdAt: 0, updatedAt, status: 'idle', kind: 'chat', ...extra });

test('chat tree: pinned first, folders depth-first, unfiled by recency, archived last', () => {
  const tree = buildChatTree(
    [
      s('a', 'Old note', 1),
      s('b', 'Fresh idea', 9),
      s('c', 'Research a/b', 5, { folder: 'Work/Research' }),
      s('d', 'Standup', 4, { folder: 'Work' }),
      s('e', 'Taxes', 3, { pinned: true, folder: 'Home' }),
      s('f', 'Gone', 2, { archived: true }),
    ],
    ['Work A', 'Home'],
  );
  assert.deepEqual(tree.paths, [
    'Pinned/',
    'Pinned/Taxes',
    'Home/',
    'Work/',
    'Work/Standup',
    'Work/Research/',
    'Work/Research/Research a∕b',
    'Work A/',
    'Fresh idea',
    'Old note',
    'Archived/',
    'Archived/Gone',
  ]);
  assert.deepEqual(tree.nodes.get('Work/Research/'), { kind: 'folder', folder: 'Work/Research' });
  assert.equal(tree.pathOf.get('c'), 'Work/Research/Research a∕b');
});

test('chat tree: sub-agents nest under their parent, which becomes a directory; duplicate titles stay unique', () => {
  const tree = buildChatTree(
    [s('root', 'Debate', 9), s('p', 'Pro', 8, { parentId: 'root' }), s('c', 'Con', 7, { parentId: 'root' }), s('x', 'Debate', 1)],
    [],
  );
  assert.deepEqual(tree.paths, ['Debate/', 'Debate/Pro', 'Debate/Con', 'Debate (2)']);
  assert.deepEqual(tree.nodes.get('Debate/'), { kind: 'chat', sessionId: 'root' });
});

test('chat tree: search keeps matches and their ancestors only', () => {
  const tree = buildChatTree([s('a', 'Invoices', 2, { folder: 'Finance' }), s('b', 'Recipes', 1, { folder: 'Home' })], ['Finance', 'Home'], { query: 'invo' });
  assert.deepEqual(tree.paths, ['Finance/', 'Finance/Invoices']);
});

test('long titles end-truncate before the tree sees them', () => {
  const tree = buildChatTree([s('a', 'Make a 3-step plan with plan_update for tidying my notes', 1)], []);
  assert.deepEqual(tree.paths, ['Make a 3-step plan with…']);
});

test('drops map to folder moves, pin or archive', () => {
  const tree = buildChatTree([s('a', 'A', 1, { pinned: true }), s('b', 'B', 1, { archived: true })], ['Work']);
  assert.deepEqual(folderForDrop(tree, null), { folder: '' });
  assert.deepEqual(folderForDrop(tree, 'Work/'), { folder: 'Work' });
  assert.deepEqual(folderForDrop(tree, 'Pinned/'), { pin: true });
  assert.deepEqual(folderForDrop(tree, 'Archived'), { archive: true });
});
