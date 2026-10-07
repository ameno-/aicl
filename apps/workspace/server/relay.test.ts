import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRelay, NoCanvasError } from './relay.ts';

test('a canvas op with no browser connected fails at once with a clear message', async () => {
  const relay = createRelay(60_000);
  const started = Date.now();
  await assert.rejects(
    relay.request({ op: 'clear' } as never),
    (e: Error) => e instanceof NoCanvasError && /not open in a browser/.test(e.message),
  );
  assert.ok(Date.now() - started < 1000);
});
