/**
 * Wave 2, package A — human in the loop (browser). CONTRACT: shared/agentic.ts.
 * Stubs: A implements the question card (chat + canvas) and the pending
 * approvals strip shown above every composer.
 */
import type { PartProps } from '@aicl/react';

/** Chat rendering of an ask_user tool call (pending → options; answered → the choice). */
export function AskUserPart(props: PartProps) {
  void props;
  return null;
}

/** Pending approvals/questions for a session, rendered above its composer. */
export function HitlStrip({ sessionId }: { sessionId: string }) {
  void sessionId;
  return null;
}
