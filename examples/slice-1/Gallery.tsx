import type { ReactNode } from 'react';
import type { Message } from '@aicl/core';
import {
  CodeBlock,
  Composer,
  ErrorNotice,
  FileChip,
  MessageItem,
  PlanChecklist,
  SuggestionRows,
  TerminalOutput,
  Transcript,
} from '@aicl/react';

const assistant = (id: string, parts: Message['parts'], extra: Partial<Message> = {}): Message => ({
  id,
  role: 'assistant',
  parts,
  createdAt: Date.now(),
  ...extra,
});

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} data-feature={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Gallery() {
  const dayA = Date.parse('2026-10-01T12:00:00Z');
  const dayB = Date.parse('2026-10-03T12:00:00Z');
  return (
    <main className="gallery">
      <h1>Chat UI</h1>
      <Section id="empty" title="Empty">
        <Composer status="idle" placeholder="Message" onSubmit={() => {}} />
      </Section>
      <Section id="submitted" title="Submitted">
        <Composer status="submitted" placeholder="Message" onSubmit={() => {}} onStop={() => {}} />
      </Section>
      <Section id="streaming" title="Streaming">
        <Transcript
          status="streaming"
          streamingId="s1"
          messages={[
            { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Show the work' }] },
            assistant('s1', [{ type: 'text', text: 'Partial reply' }]),
          ]}
        />
        <Composer status="streaming" onSubmit={() => {}} onStop={() => {}} />
      </Section>
      <Section id="tool-running" title="Tool running">
        <MessageItem
          message={assistant('t1', [
            { type: 'tool-call', toolCallId: 'c1', name: 'search', args: {}, status: 'running' },
          ])}
        />
      </Section>
      <Section id="tool-error" title="Tool error">
        <MessageItem
          message={assistant('t2', [
            { type: 'tool-call', toolCallId: 'c2', name: 'search', args: { q: 'missing' }, status: 'error' },
          ])}
        />
      </Section>
      <Section id="tool-cancelled" title="Tool cancelled">
        <MessageItem
          message={assistant('t3', [
            { type: 'tool-call', toolCallId: 'c3', name: 'search', args: {}, status: 'cancelled' },
          ])}
        />
      </Section>
      <Section id="artifact" title="Artifact">
        <MessageItem
          message={assistant('a1', [
            { type: 'artifact', artifactId: 'notes', kind: 'document', title: 'Slice notes', version: 2 },
          ])}
        />
      </Section>
      <Section id="terminal" title="Terminal">
        <TerminalOutput lines={['$ npm test', '11 passed']} streaming />
      </Section>
      <Section id="code" title="Code">
        <CodeBlock language="ts" content={'export const ready = true;'} />
      </Section>
      <Section id="file" title="File">
        <FileChip
          part={{ type: 'file', mediaType: 'text/plain', url: '/notes.md', name: 'notes.md' }}
          message={assistant('f1', [])}
          index={0}
          streaming={false}
        />
      </Section>
      <Section id="suggestions" title="Suggestions">
        <SuggestionRows
          part={{
            type: 'data-suggested-followups',
            data: { suggestions: [{ id: '1', label: 'Open the notes' }, { id: '2', label: 'Run the checks' }] },
          }}
          message={assistant('g1', [])}
          index={0}
          streaming={false}
        />
        <Composer status="idle" suggestions={['Insert a follow-up']} onSubmit={() => {}} />
      </Section>
      <Section id="plan" title="Plan">
        <PlanChecklist
          items={[
            { id: '1', label: 'Read the diff', status: 'done' },
            { id: '2', label: 'Run checks', status: 'running' },
            { id: '3', label: 'Open the notes', status: 'pending' },
          ]}
        />
      </Section>
      <Section id="actions" title="Actions">
        <MessageItem message={assistant('act', [{ type: 'text', text: 'Checks passed.' }])} />
      </Section>
      <Section id="branch" title="Branch">
        <MessageItem
          message={assistant('b1', [{ type: 'text', text: 'Second try' }])}
          branch={{ index: 1, count: 2, onSelect: () => {} }}
        />
      </Section>
      <Section id="stopped" title="Stopped">
        <MessageItem
          isStreaming={false}
          message={assistant('stop', [{ type: 'text', text: 'Partial reply' }], { aborted: true })}
        />
      </Section>
      <Section id="error" title="Error">
        <ErrorNotice
          part={{ type: 'error', message: 'upstream 503', retryable: true }}
          message={assistant('e1', [])}
          index={0}
          streaming={false}
          onRetry={() => {}}
        />
      </Section>
      <Section id="unknown" title="Unknown part">
        <MessageItem
          message={assistant('u1', [
            { type: 'text', text: 'The thread continues.' },
            { type: 'data-mystery', data: {} },
          ])}
        />
      </Section>
      <Section id="days" title="Day separator">
        <Transcript
          status="idle"
          messages={[
            { id: 'd1', role: 'user', createdAt: dayA, parts: [{ type: 'text', text: 'Yesterday' }] },
            { id: 'd2', role: 'assistant', createdAt: dayB, parts: [{ type: 'text', text: 'Today' }] },
          ]}
        />
      </Section>
      <Section id="attachments" title="Attachments">
        <Composer
          status="idle"
          attachments={[{ id: 'file-1', name: 'notes.md' }]}
          onSubmit={() => {}}
        />
      </Section>
    </main>
  );
}
