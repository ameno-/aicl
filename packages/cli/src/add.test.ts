import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { addItems } from './add.js';
import { findRepoRoot } from './repo.js';

const root = findRepoRoot();

test('aicl add copies source and resolves registry dependencies', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'aicl-add-'));
  try {
    const result = await addItems(['button'], root, { cwd });
    assert.ok(result.items.includes('button'));
    assert.ok(result.items.includes('icon-slots'), 'button depends on icon-slots');
    const copied = result.copied.map((file) => file.to);
    assert.ok(copied.some((to) => to.endsWith('Button.tsx')));
    assert.ok(copied.some((to) => to.endsWith('icons.tsx')));
    const written = await readFile(
      copied.find((to) => to.endsWith('Button.tsx'))!,
      'utf8',
    );
    assert.match(written, /data-aicl="button"/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('aicl add --dry-run does not write', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'aicl-add-dry-'));
  try {
    const result = await addItems(['badge'], root, { cwd, dryRun: true });
    assert.ok(result.copied.length > 0);
    await assert.rejects(readFile(result.copied[0]!.to, 'utf8'));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('aicl add rejects an unknown item', async () => {
  await assert.rejects(() => addItems(['not-a-component'], root), /unknown item/);
});

test('aicl add streaming-text copies cn next to the fx tree', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'aicl-add-fx-'));
  try {
    const result = await addItems(['streaming-text'], root, { cwd });
    assert.ok(result.items.includes('cn'));
    assert.ok(result.items.includes('fx-provider'));
    const copied = result.copied.map((file) => file.to.replace(cwd + '/', ''));
    assert.ok(copied.includes('components/aicl/fx/components/stream/StreamingText.tsx'));
    assert.ok(copied.includes('components/aicl/fx/lib/cn.ts'));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('aicl add transcript pulls the parts it imports', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'aicl-add-tx-'));
  try {
    const result = await addItems(['transcript'], root, { cwd, dryRun: true });
    assert.ok(result.items.includes('message-actions'));
    assert.ok(result.items.includes('part-renderer'));
    const files = result.copied.map((file) => file.to);
    assert.ok(files.some((to) => to.endsWith('Transcript.tsx')));
    assert.ok(files.some((to) => to.endsWith('MessageActions.tsx')));
    assert.ok(files.some((to) => to.endsWith('parts.tsx')));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
