/** Canvas component "live-plan": a session's plan_update checklist, live. */
import { LivePlanView } from '../agentic/live.tsx';
import { useActiveSessionId } from '../sessionsApi.ts';
import type { ComponentRendererProps } from './types.ts';

export function LivePlanRenderer({ props }: ComponentRendererProps) {
  const active = useActiveSessionId();
  const sessionId = typeof props['sessionId'] === 'string' && props['sessionId'] ? props['sessionId'] : active;
  return (
    <div className="aicl-cmp-body">
      <LivePlanView sessionId={sessionId} />
    </div>
  );
}
