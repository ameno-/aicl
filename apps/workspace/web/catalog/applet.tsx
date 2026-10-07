import { AppletHost } from '../applets/index.tsx';
import type { ComponentRendererProps } from './types.ts';

/** A live applet (.aicl/applets/<id>.tsx) placed on the canvas. */
export function AppletRenderer({ props }: ComponentRendererProps) {
  const id = typeof props['id'] === 'string' ? props['id'] : '';
  if (!id) return <div className="aicl-cmp-empty">No applet id</div>;
  return <AppletHost id={id} />;
}
