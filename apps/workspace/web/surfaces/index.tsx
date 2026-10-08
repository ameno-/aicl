/**
 * Wave 4 contract (shared/surfaces.ts): render any surface anywhere.
 * <SurfaceView kind id variant/> picks the kind's view (lazy, so heavy views —
 * xterm, CodeMirror, the browser screencast — load only when shown), wraps it
 * in an error boundary, and feeds it the live index entry.
 */
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import type { SurfaceKind, SurfaceVariant } from '../../shared/surfaces.ts';
import { ErrorBoundary } from '../ErrorBoundary.tsx';
import { useSurface } from './store.ts';
import type { SurfaceViewProps } from './types.ts';
import './surfaces.css';

export { closeSurface, useSurface, useSurfaces } from './store.ts';
export type { SurfaceViewProps } from './types.ts';

const views: Partial<Record<SurfaceKind, LazyExoticComponent<ComponentType<SurfaceViewProps>>>> = {
  terminal: lazy(() => import('./terminal.tsx')),
  browser: lazy(() => import('./browser.tsx')),
  file: lazy(() => import('./file.tsx')),
  diff: lazy(() => import('./diff.tsx')),
  review: lazy(() => import('./review.tsx')),
  sideshow: lazy(() => import('./sideshow.tsx')),
};

export function SurfaceView({ kind, id, variant }: { kind: SurfaceKind; id: string; variant: SurfaceVariant }) {
  const info = useSurface(kind, id);
  const View = views[kind];
  if (!View) return <div className="surface-empty">No view for {kind} surfaces yet.</div>;
  return (
    <div className="surface" data-surface={kind} data-surface-id={id} data-variant={variant}>
      <ErrorBoundary label={`${kind} surface`} resetKeys={[kind, id]}>
        <Suspense fallback={<div className="surface-empty">Loading {kind}…</div>}>
          <View id={id} info={info} variant={variant} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
