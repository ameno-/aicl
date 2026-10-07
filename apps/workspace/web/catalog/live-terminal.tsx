/** Canvas component "live-terminal": a session's latest shell command (or one tool call), streaming. */
import { TerminalView } from '../agentic/live.tsx';
import { useTerminal } from '../agentic/liveData.ts';
import { useActiveSessionId } from '../sessionsApi.ts';
import type { ComponentRendererProps } from './types.ts';

export function LiveTerminalRenderer({ props }: ComponentRendererProps) {
  const active = useActiveSessionId();
  const sessionId = typeof props['sessionId'] === 'string' && props['sessionId'] ? props['sessionId'] : active;
  const toolCallId = typeof props['toolCallId'] === 'string' && props['toolCallId'] ? props['toolCallId'] : undefined;
  const state = useTerminal(sessionId, toolCallId);
  if (!state) return <div className="aicl-cmp-empty">No command yet.</div>;
  return (
    <div className="aicl-cmp-body aicl-cmp-live-terminal">
      <TerminalView state={state} running={!state.done} />
    </div>
  );
}
