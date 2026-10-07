/** Surface view: browser (wave 4). Stub until its package lands. */
import type { SurfaceViewProps } from './types.ts';

export default function BrowserSurface({ info }: SurfaceViewProps) {
  return <div className="surface-empty">{info?.title ?? 'browser'} — coming soon</div>;
}
