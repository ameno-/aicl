import { formatAddress, type CanvasContext } from './runtime.ts';

/**
 * Renders a CanvasContext as the text inside the hidden <canvas-context>
 * block (without the tags). Tolerates untrusted/partial input. Empty string
 * when there is nothing to say.
 */
export function formatCanvasContext(ctx: CanvasContext | null | undefined): string {
  if (!ctx || typeof ctx !== 'object') return '';
  const lines: string[] = [];
  const shapes = Array.isArray(ctx.selectedShapes) ? ctx.selectedShapes.filter((s): s is string => typeof s === 'string') : [];
  if (shapes.length) lines.push(`selected: ${shapes.join(', ')}`);
  const ui = ctx.uiSelection;
  if (ui && typeof ui.shapeId === 'string' && typeof ui.nodeId === 'string') {
    lines.push(`ui-selection: screen ${ui.shapeId.replace(/^shape:/, '')}, element ${ui.nodeId}`);
  }
  const v = ctx.viewport;
  if (v && [v.x, v.y, v.w, v.h].every((n) => typeof n === 'number' && Number.isFinite(n))) {
    lines.push(`viewport: x ${Math.round(v.x)}, y ${Math.round(v.y)}, ${Math.round(v.w)}x${Math.round(v.h)} (page coordinates the user is looking at)`);
  }
  const actions = Array.isArray(ctx.recentActions) ? ctx.recentActions.filter((a): a is string => typeof a === 'string') : [];
  if (actions.length) lines.push(`recent user actions (oldest first):\n${actions.slice(-20).map((a) => `- ${a}`).join('\n')}`);
  if (ctx.route && typeof ctx.route === 'object' && typeof ctx.route.tab === 'string') lines.push(`route: ${formatAddress(ctx.route)}`);
  return lines.join('\n');
}
