import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createReferences } from './references.ts';

async function corpus() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aicl-refs-'));
  const labels = path.join(root, '_corpus', 'labels');
  await mkdir(labels, { recursive: true });
  const add = async (folder: string, name: string, label: object) => {
    await mkdir(path.join(root, folder), { recursive: true });
    await writeFile(path.join(root, folder, `${name}.png`), 'x');
    await writeFile(path.join(labels, `${name}.json`), JSON.stringify(label));
  };
  await add('Devin web Aug 2026 (1)', 'Devin web Aug 2026 2', {
    screen_archetype: 'workspace_home',
    components: ['sidebar_nav', 'session_list_item'],
    is_chat_surface: true,
    notes: 'Sessions listed on the left',
  });
  await add('Devin web Aug 2026 (1)', 'Devin web Aug 2026 10', { screen_archetype: 'settings_account', components: ['text_input'], is_chat_surface: false });
  await add('Manus web Mar 2026', 'Manus web Mar 2026 1', { screen_archetype: 'workspace_home', components: ['composer_input'], is_chat_surface: true });
  return createReferences(root);
}

test('indexes folders with labels', async () => {
  const refs = await corpus();
  const all = await refs.search({});
  assert.equal(all.length, 3);
  assert.equal(all[0]!.ref, 'Devin web Aug 2026 (1)/Devin web Aug 2026 2.png');
  assert.equal(all[0]!.product, 'Devin');
});

test('filters by product, archetype, component, text and chatOnly', async () => {
  const refs = await corpus();
  assert.equal((await refs.search({ product: 'manus' })).length, 1);
  assert.equal((await refs.search({ archetype: 'workspace_home' })).length, 2);
  assert.equal((await refs.search({ component: 'session_list_item' })).length, 1);
  assert.equal((await refs.search({ text: 'sessions left' })).length, 1);
  assert.equal((await refs.search({ product: 'Devin', chatOnly: true })).length, 1);
  assert.equal((await refs.search({ limit: 2 })).length, 2);
  assert.equal((await refs.get('Manus web Mar 2026/Manus web Mar 2026 1.png'))?.product, 'Manus');
});
