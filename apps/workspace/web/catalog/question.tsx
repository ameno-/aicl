/** Canvas component "question": a pending agent question you can answer on the canvas. */
import { QuestionCard, useQuestion } from '../agentic/hitl.tsx';
import type { ComponentRendererProps } from './types.ts';

export function QuestionRenderer({ props }: ComponentRendererProps) {
  const requestId = typeof props['requestId'] === 'string' ? props['requestId'] : undefined;
  const { request, answer } = useQuestion(requestId);
  if (!request) return <div className="aicl-cmp-empty">No pending question.</div>;
  return (
    <div className="aicl-cmp-body" style={{ overflow: 'auto' }}>
      <QuestionCard key={request.id} request={request} answer={answer} />
    </div>
  );
}
