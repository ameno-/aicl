/** Surface view: diff (wave 4). Stub until its package lands. */
import type { SurfaceViewProps } from './types.ts';

export default function DiffSurface({ info }: SurfaceViewProps) {
  return <div className="surface-empty">{info?.title ?? 'diff'} — coming soon</div>;
}
