/**
 * Tool calls that render as live components in chat instead of a step line.
 * Keyed by Pi tool name; AgentStep (web/agentSteps.tsx) consults this map.
 * Each wave-2 package owns its renderer file.
 */
import type { ComponentType } from 'react';
import type { PartProps } from '@aicl/react';
import { AskUserPart } from './hitl.tsx';
import { BashPart, PlanUpdatePart } from './live.tsx';

export const toolRenderers: Record<string, ComponentType<PartProps>> = {
  ask_user: AskUserPart, // A
  plan_update: PlanUpdatePart, // B
  bash: BashPart, // B
};
