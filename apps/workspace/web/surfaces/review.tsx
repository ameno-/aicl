/** Surface view: review (wave 4). Stub until its package lands. */
import type { SurfaceViewProps } from './types.ts';

export default function ReviewSurface({ info }: SurfaceViewProps) {
  return <div className="surface-empty">{info?.title ?? 'review'} — coming soon</div>;
}
