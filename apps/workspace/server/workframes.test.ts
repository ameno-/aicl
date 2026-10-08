import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ScratchOp, ScratchResult } from '../shared/scratch.ts';
import type { SurfaceInfo } from '../shared/surfaces.ts';
import {
  canReposition,
  layoutLanes,
  overlaps,
  placeCard,
  planSurface,
  reflowFrame,
  sizeFor,
  GAP,
  MIN_FRAME,
  PAD,
  type FrameCard,
  type Rect,
} from '../web/workspace/layout.ts';
import { createWorkframes, frameOwner } from './workframes.ts';

const noOverlap = (rects: Rect[]) => rects.every((a, i) => rects.every((b, j) => i === j || !overlaps(a, b)));

describe('placement and frame growth', () => {
  it('puts the first card at the padding and sizes the frame to hold it', () => {
    const p = placeCard({ w: 0, h: 0 }, [], { w: 560, h: 340 });
    assert.deepEqual([p.x, p.y], [PAD, PAD]);
    assert.equal(p.frame.w, Math.max(MIN_FRAME.w, 560 + 2 * PAD));
    assert.equal(p.frame.h, 340 + 2 * PAD);
  });

  it('flows cards without overlap and the frame only ever grows', () => {
    let frame = { w: 0, h: 0 };
    const cards: FrameCard[] = [];
    for (const kind of ['file', 'diff', 'terminal', 'browser', 'review']) {
      const p = planSurface(frame, cards, { kind, id: kind })!;
      assert.ok(p.frame.w >= frame.w && p.frame.h >= frame.h, 'frame never shrinks');
      cards.push({ x: p.x, y: p.y, w: p.w, h: p.h, key: `${kind}/${kind}`, kind });
      frame = p.frame;
    }
    assert.ok(noOverlap(cards), 'no two cards overlap');
    for (const c of cards) {
      assert.ok(c.x + c.w + PAD <= frame.w && c.y + c.h + PAD <= frame.h, 'every card is inside the grown frame');
    }
  });

  it('places a diff next to the file it changes', () => {
    const file = { x: PAD, y: PAD, ...sizeFor('file'), key: 'file/a', kind: 'file' };
    const terminal = { x: PAD + file.w + GAP, y: PAD, ...sizeFor('terminal'), key: 'terminal/t', kind: 'terminal' };
    const p = planSurface({ w: 1300, h: 400 }, [file, terminal], { kind: 'diff', id: 'd' })!;
    // Right of the file is taken by the terminal, so it goes beneath the file.
    assert.equal(p.x, file.x);
    assert.equal(p.y, file.y + file.h + GAP);
  });

  it('uses the spot beside the related card when it is free', () => {
    const file = { x: PAD, y: PAD, ...sizeFor('file'), key: 'file/a', kind: 'file' };
    const p = planSurface({ w: 600, h: 400 }, [file], { kind: 'diff', id: 'd' })!;
    assert.equal(p.x, file.x + file.w + GAP);
    assert.equal(p.y, file.y);
  });
});

describe('dedupe by surface id', () => {
  it('refuses a surface the frame already holds', () => {
    const cards: FrameCard[] = [{ x: PAD, y: PAD, w: 500, h: 300, key: 'diff/turn-1', kind: 'diff' }];
    assert.equal(planSurface({ w: 600, h: 400 }, cards, { kind: 'diff', id: 'turn-1' }), null);
    assert.ok(planSurface({ w: 600, h: 400 }, cards, { kind: 'diff', id: 'turn-2' }));
    // same id, different kind: a different surface
    assert.ok(planSurface({ w: 600, h: 400 }, cards, { kind: 'file', id: 'turn-1' }));
  });
});

describe('never move what the user moved', () => {
  it('only unmoved cards are repositioned, and user-moved ones become obstacles', () => {
    const a: FrameCard = { x: 500, y: 500, w: 300, h: 200, key: 'file/a', kind: 'file', userMoved: true };
    const b: FrameCard = { x: 900, y: 900, w: 300, h: 200, key: 'diff/b', kind: 'diff' };
    const c: FrameCard = { x: 40, y: 40, w: 300, h: 200, key: 'terminal/c', kind: 'terminal' };
    const { moves } = reflowFrame([a, b, c]);
    assert.ok(!moves.has(0), 'the user-moved card is not in the plan');
    assert.ok(moves.has(1) && moves.has(2));
    assert.ok(noOverlap([a, moves.get(1)!, moves.get(2)!]), 'repacked cards avoid the user-moved one');
  });

  it('reads the userMoved flag from shape meta', () => {
    assert.equal(canReposition({ userMoved: true }), false);
    assert.equal(canReposition({}), true);
    assert.equal(canReposition(undefined), true);
  });

  it('adding a card never alters existing rectangles', () => {
    const existing: FrameCard[] = [{ x: 100, y: 100, w: 300, h: 200, key: 'file/a', kind: 'file', userMoved: true }];
    const before = JSON.stringify(existing);
    planSurface({ w: 600, h: 400 }, existing, { kind: 'terminal', id: 't' });
    assert.equal(JSON.stringify(existing), before);
  });
});

describe('lane layout', () => {
  const lane = (key: string, ...sizes: Array<[number, number]>) => ({ key, items: sizes.map(([w, h], i) => ({ id: `${key}${i}`, w, h })) });

  it('one row per session in the order given, frames of a session side by side', () => {
    const at = layoutLanes([lane('new', [600, 300], [400, 200]), lane('old', [500, 500])], { x: 0, y: 0 }, [], 80);
    assert.deepEqual(at.get('new0'), { x: 0, y: 0 });
    assert.deepEqual(at.get('new1'), { x: 680, y: 0 });
    assert.deepEqual(at.get('old0'), { x: 0, y: 380 });
  });

  it('pushes a lane below a user-placed shape outside the frames', () => {
    const note: Rect = { x: 100, y: 0, w: 200, h: 150 };
    const at = layoutLanes([lane('a', [600, 300]), lane('b', [600, 300])], { x: 0, y: 0 }, [note], 80);
    const rects = [...at.entries()].map(([id, p]) => ({ x: p.x, y: p.y, w: 600, h: 300, id }));
    assert.ok(noOverlap([note, ...rects]), 'no lane touches the note');
    assert.ok(at.get('a0')!.y >= 150 + 80, 'first lane starts below the note');
    assert.ok(at.get('b0')!.y > at.get('a0')!.y, 'order is kept');
  });
});

describe('workframes service', () => {
  const surface = (over: Partial<SurfaceInfo>): SurfaceInfo => ({
    kind: 'file',
    id: 'src/app.ts',
    title: 'src/app.ts',
    status: 'idle',
    openedBy: 'agent',
    sessionId: 's1',
    createdAt: 1,
    updatedAt: 1,
    ...over,
  });
  const make = (connected = true) => {
    const ops: ScratchOp[] = [];
    const sessions = new Map([
      ['s1', { id: 's1', title: 'Fix greeting' }],
      ['sub', { id: 'sub', title: 'Helper', parentId: 's1', rootId: 's1' }],
    ]);
    const svc = createWorkframes({
      relay: {
        connected,
        request: async (op: ScratchOp) => (ops.push(op), { op: 'workframe', ids: [], placed: true } as ScratchResult),
      },
      session: (id) => sessions.get(id),
    });
    return { svc, ops };
  };

  it('announces an agent surface once, with the session title', async () => {
    const { svc, ops } = make();
    svc.onEvent({ type: 'surface', surface: surface({}) });
    svc.onEvent({ type: 'surface', surface: surface({ updatedAt: 5 }) });
    await svc.idle();
    assert.equal(ops.length, 1);
    assert.deepEqual(ops[0], { op: 'workframe', sessionId: 's1', title: 'Fix greeting', surface: { kind: 'file', id: 'src/app.ts', title: 'src/app.ts' } });
  });

  it('ignores user surfaces and does nothing without a canvas', async () => {
    const a = make();
    a.svc.onEvent({ type: 'surface', surface: surface({ openedBy: 'user' }) });
    await a.svc.idle();
    assert.equal(a.ops.length, 0);
    const b = make(false);
    b.svc.onEvent({ type: 'surface', surface: surface({}) });
    await b.svc.idle();
    assert.equal(b.ops.length, 0);
  });

  it('puts a sub-agent surface in the root session frame', async () => {
    const { svc, ops } = make();
    svc.onEvent({ type: 'surface', surface: surface({ kind: 'terminal', id: 't1', sessionId: 'sub' }) });
    await svc.idle();
    assert.equal((ops[0] as { sessionId: string }).sessionId, 's1');
    assert.equal(frameOwner({ session: () => undefined }, 'x'), 'x');
  });
});
