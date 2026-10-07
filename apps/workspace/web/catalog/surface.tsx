/** Canvas component "surface": any live surface (shared/surfaces.ts) as a card. */
import type { SurfaceKind } from '../../shared/surfaces.ts';
import { SurfaceView } from '../surfaces/index.tsx';
import type { ComponentRendererProps } from './types.ts';

export function SurfaceRenderer({ props }: ComponentRendererProps) {
  const kind = props['kind'] as SurfaceKind | undefined;
  const id = typeof props['id'] === 'string' ? props['id'] : '';
  if (!kind || !id) return <div className="surface-empty">Pick a surface: props {'{ kind, id }'}</div>;
  return (
    // Surfaces are interactive (typing, scrolling, clicking): keep canvas gestures out.
    <div style={{ width: '100%', height: '100%' }} onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      <SurfaceView kind={kind} id={id} variant="card" />
    </div>
  );
}
