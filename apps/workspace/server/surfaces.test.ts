import assert from 'node:assert/strict';
import test from 'node:test';
import { createSurfaceRegistry } from './surfaces/registry.ts';
import { parseSurfaceAddress, surfaceAddress } from '../shared/surfaces.ts';

test('surface registry: upsert, patch, list, remove broadcast to pages', () => {
  const events: Array<{ type: string }> = [];
  const reg = createSurfaceRegistry({ broadcast: (e) => events.push(e as { type: string }) });
  reg.upsert({ kind: 'terminal', id: 't1', title: 'zsh', status: 'idle', openedBy: 'user' });
  reg.upsert({ kind: 'browser', id: 'b1', title: 'localhost:5173', status: 'busy', openedBy: 'agent', sessionId: 'main' });
  const created = reg.get('terminal', 't1')!.createdAt;
  assert.equal(reg.patch('terminal', 't1', { status: 'busy', summary: 'npm test' })?.status, 'busy');
  assert.equal(reg.get('terminal', 't1')!.createdAt, created, 'createdAt survives patches');
  assert.equal(reg.patch('terminal', 'nope', { status: 'busy' }), undefined);
  assert.deepEqual(reg.list('terminal').map((s) => s.id), ['t1']);
  reg.remove('terminal', 't1');
  reg.remove('terminal', 't1');
  assert.deepEqual(reg.list().map((s) => s.id), ['b1']);
  assert.deepEqual(events.map((e) => e.type), ['surface', 'surface', 'surface', 'surface-removed']);
});

test('surface addresses round-trip and reject unknown kinds', () => {
  const ref = { kind: 'file' as const, id: 'src/app one.ts' };
  assert.deepEqual(parseSurfaceAddress(surfaceAddress(ref)), ref);
  assert.equal(parseSurfaceAddress('aicl:/surface/teapot/1'), null);
});
