import { useState } from 'react';
import type { Message, Part } from '@aicl/core';
import { Icon, type IconSlot } from './icons.js';

const LABEL: Record<MessageAction, string> = {
  copy: 'Copy',
  'thumbs-up': 'Good response',
  'thumbs-down': 'Bad response',
  retry: 'Retry',
  edit: 'Edit',
};
const GLYPH: Record<MessageAction, IconSlot> = {
  copy: 'copy',
  'thumbs-up': 'thumb-up',
  'thumbs-down': 'thumb-down',
  retry: 'retry',
  edit: 'edit',
};

export type MessageAction = 'copy' | 'thumbs-up' | 'thumbs-down' | 'retry' | 'edit';

const DEFAULTS: Record<Message['role'], MessageAction[]> = {
  user: ['edit', 'copy'],
  assistant: ['copy', 'thumbs-up', 'thumbs-down', 'retry'],
  system: ['copy'],
};

function copyableText(parts: Part[]): string {
  return parts
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('\n');
}

export function MessageActions({
  message,
  actions,
  onAction,
}: {
  message: Message;
  actions?: MessageAction[];
  onAction?: (action: MessageAction, message: Message) => void;
}) {
  const [feedback, setFeedback] = useState<'up' | 'down' | 'none'>('none');
  const [copied, setCopied] = useState(false);
  const shown = actions ?? DEFAULTS[message.role];
  return (
    <div
      data-aicl="message-actions"
      data-visibility="auto"
      data-resolved="painted"
      data-feedback={feedback}
      data-message-id={message.id}
      data-role={message.role}
      data-copied={copied || undefined}
    >
      {shown.map((action) => (
        <button
          key={action}
          type="button"
          aria-label={LABEL[action]}
          title={LABEL[action]}
          data-action={action}
          aria-pressed={action === 'thumbs-up' ? feedback === 'up' : action === 'thumbs-down' ? feedback === 'down' : undefined}
          onClick={() => {
            if (action === 'copy') {
              void navigator.clipboard?.writeText(copyableText(message.parts));
              setCopied(true);
            }
            if (action === 'thumbs-up') setFeedback(feedback === 'up' ? 'none' : 'up');
            if (action === 'thumbs-down') setFeedback(feedback === 'down' ? 'none' : 'down');
            onAction?.(action, message);
          }}
        >
          <Icon name={action === 'copy' && copied ? 'check' : GLYPH[action]} size={15} />
        </button>
      ))}
    </div>
  );
}
