/** Surface view: file (wave 4). Stub until its package lands. */
import type { SurfaceViewProps } from './types.ts';

export default function FileSurface({ info }: SurfaceViewProps) {
  return <div className="surface-empty">{info?.title ?? 'file'} — coming soon</div>;
}
