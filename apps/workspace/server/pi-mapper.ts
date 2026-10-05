/**
 * Maps Pi agent session events onto `@aicl/core` stream events.
 *
 * One `prompt()` is one AICL assistant message. Pi may run several turns
 * (model → tools → model) inside it; every turn's content is appended to that
 * one message in order, so the transcript reads as a single answer with its
 * tool cards inline.
 *
 * Pi types are described structurally so this module stays pure and testable
 * without loading the SDK.
 */

import type { FinishReason, Part, StreamEvent, ToolCallPart, Usage } from '@aicl/core';

interface PiToolCall {
  type: 'toolCall';
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface PiAssistantMessage {
  role: string;
  content: Array<{ type: string } | PiToolCall>;
  stopReason?: string;
  errorMessage?: string;
  usage?: { input?: number; output?: number; cost?: { total?: number } };
}

type PiAssistantEvent =
  | { type: 'text_start' | 'thinking_start' | 'toolcall_start'; contentIndex: number; partial: PiAssistantMessage }
  | { type: 'text_delta' | 'thinking_delta' | 'toolcall_delta'; contentIndex: number; delta: string }
  | { type: 'text_end' | 'thinking_end'; contentIndex: number; content: string }
  | { type: 'toolcall_end'; contentIndex: number; toolCall: PiToolCall }
  | { type: 'start' | 'done' | 'error' };

export type PiEvent =
  | { type: 'agent_start' | 'agent_end' | 'turn_start' | 'turn_end' }
  | { type: 'message_start' | 'message_end'; message: { role: string } }
  | { type: 'message_update'; assistantMessageEvent: PiAssistantEvent }
  | { type: 'tool_execution_start' | 'tool_execution_update'; toolCallId: string }
  | { type: 'tool_execution_end'; toolCallId: string; isError: boolean }
  | { type: string };

export function createPiEventMapper(messageId: string) {
  let next = 0;
  /** Pi content index → AICL part index, for the assistant message in flight. */
  const indexOf = new Map<number, number>();
  const tools = new Map<string, { index: number; part: ToolCallPart }>();
  const usage: Required<Pick<Usage, 'inputTokens' | 'outputTokens'>> & { costUsd: number } = {
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  };
  let lastStop: string | undefined;
  let lastError: string | undefined;
  let started = false;

  const start = (contentIndex: number, part: Part): StreamEvent => {
    const index = next++;
    indexOf.set(contentIndex, index);
    return { type: 'part-start', index, part };
  };

  const setTool = (toolCallId: string, status: ToolCallPart['status']): StreamEvent[] => {
    const tool = tools.get(toolCallId);
    if (!tool) return [];
    tool.part = { ...tool.part, status };
    return [{ type: 'part-end', index: tool.index, part: tool.part }];
  };

  /** Terminal events, once the whole run (including retries) has settled. */
  function finish(): StreamEvent[] {
    if (lastStop === 'error') {
      return [{ type: 'error', error: { message: lastError ?? 'The agent failed.', retryable: true } }];
    }
    return [{ type: 'message-end', finishReason: finishReason(lastStop), usage }];
  }

  return Object.assign(function map(event: PiEvent): StreamEvent[] {
    switch (event.type) {
      case 'agent_start':
        // Pi auto-retries a failed run with a fresh agent_start; it is still one message.
        if (started) return [];
        started = true;
        return [{ type: 'message-start', id: messageId, role: 'assistant' }];

      case 'message_start': {
        if ((event as { message: { role: string } }).message.role === 'assistant') indexOf.clear();
        return [];
      }

      case 'message_update':
        return mapAssistant((event as { assistantMessageEvent: PiAssistantEvent }).assistantMessageEvent);

      case 'message_end': {
        const message = (event as unknown as { message: PiAssistantMessage }).message;
        if (message.role !== 'assistant') return [];
        usage.inputTokens += message.usage?.input ?? 0;
        usage.outputTokens += message.usage?.output ?? 0;
        usage.costUsd += message.usage?.cost?.total ?? 0;
        lastStop = message.stopReason;
        lastError = message.errorMessage;
        return [];
      }

      case 'tool_execution_start':
        return setTool((event as { toolCallId: string }).toolCallId, 'running');

      case 'tool_execution_end': {
        const end = event as { toolCallId: string; isError: boolean };
        return setTool(end.toolCallId, end.isError ? 'error' : 'success');
      }

      // agent_end is not the end of the turn: an auto-retry may follow it.
      // The caller ends the stream with finish() once prompt() settles.

      default:
        return [];
    }
  }, { finish });

  function mapAssistant(e: PiAssistantEvent): StreamEvent[] {
    switch (e.type) {
      case 'text_start':
        return [start(e.contentIndex, { type: 'text', text: '' })];
      case 'thinking_start':
        // Deferred until text arrives: providers that keep reasoning encrypted
        // send empty thinking blocks, which would render as blank rows.
        return [];
      case 'toolcall_start': {
        const call = e.partial.content[e.contentIndex] as Partial<PiToolCall> | undefined;
        return [
          start(e.contentIndex, {
            type: 'tool-call',
            toolCallId: call?.id ?? '',
            name: call?.name ?? 'tool',
            args: {},
            status: 'pending',
          }),
        ];
      }
      case 'thinking_delta':
        if (!indexOf.has(e.contentIndex)) {
          return e.delta ? [start(e.contentIndex, { type: 'reasoning', text: e.delta })] : [];
        }
      // falls through
      case 'text_delta':
      case 'toolcall_delta': {
        const index = indexOf.get(e.contentIndex);
        return index === undefined ? [] : [{ type: 'part-delta', index, delta: e.delta }];
      }
      case 'text_end':
      case 'thinking_end': {
        const index = indexOf.get(e.contentIndex);
        if (index === undefined) return [];
        const part: Part =
          e.type === 'text_end' ? { type: 'text', text: e.content } : { type: 'reasoning', text: e.content };
        return [{ type: 'part-end', index, part }];
      }
      case 'toolcall_end': {
        const index = indexOf.get(e.contentIndex);
        if (index === undefined) return [];
        const part: ToolCallPart = {
          type: 'tool-call',
          toolCallId: e.toolCall.id,
          name: e.toolCall.name,
          args: e.toolCall.arguments,
          argsText: JSON.stringify(e.toolCall.arguments, null, 2),
          status: 'pending',
        };
        tools.set(e.toolCall.id, { index, part });
        return [{ type: 'part-end', index, part }];
      }
      default:
        return [];
    }
  }
}

function finishReason(stop: string | undefined): FinishReason {
  if (stop === 'aborted') return 'aborted';
  if (stop === 'length') return 'length';
  return 'stop';
}
