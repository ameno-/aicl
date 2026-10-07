import { ApprovalCard, QuestionCard, type ApprovalState, type QuestionAnswer } from '@aicl/fx';
import { useState } from 'react';
import type { Story } from '../types.ts';

function ApprovalDemo({ initial = 'pending' }: { initial?: ApprovalState }) {
  const [state, setState] = useState<ApprovalState>(initial);
  const [note, setNote] = useState<string>('');
  return (
    <div className="flex flex-col gap-2">
      <ApprovalCard
        tool="bash"
        summary="Run the test suite in apps/workspace"
        details={'$ npm test --workspace apps/workspace\ncwd: /repo\ntimeout: 120s'}
        state={state}
        onApprove={() => setState('approved')}
        onDeny={(n) => {
          setNote(n ?? '');
          setState('denied');
        }}
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button className="rounded border border-border px-1.5 py-0.5" onClick={() => setState('pending')}>
          reset
        </button>
        <span>
          note: <b data-testid="deny-note">{note || '(none)'}</b>
        </span>
      </div>
    </div>
  );
}

const OPTIONS = [
  { id: 'a', label: 'TypeScript', description: 'Strict mode' },
  { id: 'b', label: 'Python' },
  { id: 'c', label: 'Rust' },
];

function QuestionDemo({ multiple, allowText }: { multiple?: boolean; allowText?: boolean }) {
  const [answer, setAnswer] = useState<QuestionAnswer | undefined>();
  return (
    <div className="flex flex-col gap-2">
      <QuestionCard
        question="Which language should the new service use?"
        options={OPTIONS}
        multiple={multiple}
        allowText={allowText}
        answered={answer}
        onAnswer={setAnswer}
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button className="rounded border border-border px-1.5 py-0.5" onClick={() => setAnswer(undefined)}>
          reset
        </button>
        <span>
          answer: <b data-testid="answer">{answer ? JSON.stringify(answer) : '(none)'}</b>
        </span>
      </div>
    </div>
  );
}

export default [
  {
    group: 'Input',
    title: 'ApprovalCard',
    note: 'Tool approval with expandable details and a deny note; resolves with a state morph.',
    states: {
      pending: () => <ApprovalDemo />,
      approved: () => <ApprovalDemo initial="approved" />,
      denied: () => <ApprovalDemo initial="denied" />,
    },
  },
  {
    group: 'Input',
    title: 'QuestionCard',
    note: 'Agent question with animated option chips.',
    states: {
      single: () => <QuestionDemo />,
      multiple: () => <QuestionDemo multiple />,
      'with text': () => <QuestionDemo allowText />,
    },
  },
] satisfies Story[];
