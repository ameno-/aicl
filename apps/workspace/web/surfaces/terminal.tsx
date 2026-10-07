/** Surface view: terminal (wave 4). Stub until its package lands. */
import type { SurfaceViewProps } from './types.ts';

export default function TerminalSurface({ info }: SurfaceViewProps) {
  return <div className="surface-empty">{info?.title ?? 'terminal'} — coming soon</div>;
}
