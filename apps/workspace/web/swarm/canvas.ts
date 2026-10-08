/**
 * Applies a swarm run (shared/scratch.ts SwarmRun) to the live tldraw editor:
 * a frame "Run: <root>" with a box for the root and an agent card per
 * sub-agent, arrows parent → child labelled with the task. Idempotent: every
 * shape id derives from a session id, so a re-sent run updates in place.
 *
 * Arrow state is the arrow's own style: dashed + blue while the child runs,
 * solid green when done, red on error, grey when stopped.
 */
import { createShapeId, toRichText, type Editor, type TLShapeId } from 'tldraw';
import { COMPONENT_SHAPE_TYPE } from '../../shared/components.ts';
import type { SwarmRun, SwarmRunNode, SwarmStatus } from '../../shared/scratch.ts';

const COLOR: Record<SwarmStatus, string> = { idle: 'grey', running: 'blue', done: 'green', error: 'red', stopped: 'orange' };

export function applySwarmRun(editor: Editor, run: SwarmRun): string[] {
  const frameId = createShapeId(run.frameId);
  const existing = editor.getShape(frameId);
  if (!existing && !run.create) return [];
  const ids: string[] = [];

  editor.run(() => {
    if (!existing) {
      const page = editor.getCurrentPageBounds();
      editor.createShape({
        id: frameId,
        type: 'frame',
        x: page ? page.minX : 0,
        y: page ? page.maxY + 160 : 0,
        props: { w: run.w, h: run.h, name: run.title },
      });
    } else {
      editor.updateShape({ id: frameId, type: 'frame', props: { w: run.w, h: run.h, name: run.title } });
    }
    ids.push(run.frameId);

    for (const node of run.nodes) {
      upsertNode(editor, frameId, node);
      ids.push(node.id);
    }
    for (const node of run.nodes) {
      if (!node.parent) continue;
      const arrow = upsertArrow(editor, node);
      if (arrow) ids.push(arrow);
    }
  });

  if (!existing) {
    const box = editor.getShapePageBounds(frameId);
    if (box) editor.zoomToBounds(box, { inset: 80, targetZoom: 1, animation: { duration: 320 } });
  }
  return ids;
}

function upsertNode(editor: Editor, frame: TLShapeId, node: SwarmRunNode): void {
  const id = createShapeId(node.id);
  const current = editor.getShape(id);
  if (node.sessionId) {
    const props = { name: node.name, ...(node.role ? { role: node.role } : {}), sessionId: node.sessionId };
    if (!current) {
      editor.createShape({
        id,
        type: COMPONENT_SHAPE_TYPE,
        parentId: frame,
        x: node.x,
        y: node.y,
        props: { w: node.w, h: node.h, component: 'agent', title: node.name, props },
      } as never);
    } else {
      const old = (current.props as { props?: Record<string, unknown> }).props ?? {};
      editor.updateShape({ id, type: current.type, props: { title: node.name, props: { ...old, ...props } } } as never);
    }
    return;
  }
  const richText = toRichText(node.name);
  if (!current) {
    editor.createShape({
      id,
      type: 'geo',
      parentId: frame,
      x: node.x,
      y: node.y,
      props: { geo: 'rectangle', w: node.w, h: node.h, richText, color: 'violet', fill: 'semi' },
    } as never);
  } else {
    editor.updateShape({ id, type: 'geo', props: { richText } });
  }
}

function upsertArrow(editor: Editor, node: SwarmRunNode): string | undefined {
  const id = createShapeId(`ar-${node.id}`);
  const from = createShapeId(node.parent!);
  const to = createShapeId(node.id);
  const dash = node.status === 'running' ? 'dashed' : node.status === 'stopped' || node.status === 'idle' ? 'dotted' : 'solid';
  const style = { color: COLOR[node.status], dash, richText: toRichText(node.label ?? '') };
  const current = editor.getShape(id);
  if (current) {
    editor.updateShape({ id, type: 'arrow', props: style } as never);
    return undefined;
  }
  const a = editor.getShapePageBounds(from);
  const b = editor.getShapePageBounds(to);
  if (!a || !b) return undefined;
  editor.createShape({
    id,
    type: 'arrow',
    x: a.midX,
    y: a.midY,
    props: { start: { x: 0, y: 0 }, end: { x: b.midX - a.midX, y: b.midY - a.midY }, ...style },
  } as never);
  editor.createBindings(
    [
      { terminal: 'start' as const, target: from },
      { terminal: 'end' as const, target: to },
    ].map((t) => ({
      type: 'arrow' as const,
      fromId: id,
      toId: t.target,
      props: { terminal: t.terminal, normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false, snap: 'none' as const },
    })),
  );
  return `ar-${node.id}`;
}
