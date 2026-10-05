import { useRef, useState, type ReactNode } from 'react';
import type { ArtifactKind, ArtifactPart, Message } from '@aicl/core';
import { ArtifactCard, CodeBlock, Composer, PlanChecklist, TerminalOutput, Transcript, type PlanItem } from '@aicl/react';
import { MarkdownTextPart } from '@aicl/react/markdown';
import type { ComponentType } from 'react';
import type { PartProps } from '@aicl/react';
import { createRendererRegistry } from '@aicl/core';
import { workspaceRegistry } from '../agentSteps.tsx';
import { useWorkspaceChat } from '../chatStore.ts';
import type { ComponentRendererProps } from './types.ts';

/* ---- normalisers: unknown JSON in, safe values out ---- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : undefined;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const Empty = ({ children }: { children?: ReactNode }) => (
  <div className="aicl-cmp-empty">{children ?? 'Nothing to show yet'}</div>
);

const Body = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`aicl-cmp-body ${className}`.trim()}>{children}</div>
);

/* ---- chat ---- */

export function ChatRenderer() {
  const chat = useWorkspaceChat();
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  return (
    <div className="aicl-cmp-chat" onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      {chat.messages.length === 0 ? (
        <Empty>Say something to the agent</Empty>
      ) : (
        <Transcript messages={chat.messages} status={chat.status} streamingId={chat.streamingId} registry={workspaceRegistry} />
      )}
      <div className="aicl-cmp-chat-composer">
        <Composer
          status={chat.status}
          value={draft}
          onChange={setDraft}
          inputRef={inputRef}
          placeholder="Message the agent"
          onSubmit={(text) => void chat.send(text)}
          onStop={chat.stop}
        />
      </div>
    </div>
  );
}

/* ---- plan ---- */

const PLAN_STATUS = ['pending', 'running', 'done', 'error'] as const;

export function PlanRenderer({ props }: ComponentRendererProps) {
  const items: PlanItem[] = arr(props['steps']).flatMap((s, i) => {
    const o = isObj(s) ? s : { label: s };
    const label = str(o['label']);
    if (!label) return [];
    const status = PLAN_STATUS.find((x) => x === o['status']) ?? 'pending';
    return [{ id: `s${i}`, label, status }];
  });
  if (items.length === 0) return <Empty>No steps</Empty>;
  return (
    <Body>
      <PlanChecklist items={items} title={str(props['title'])} />
    </Body>
  );
}

/* ---- code ---- */

export function CodeRenderer({ props }: ComponentRendererProps) {
  const content = str(props['content']);
  if (content === undefined) return <Empty>No code</Empty>;
  return (
    <Body>
      <CodeBlock content={content} language={str(props['language'])} />
    </Body>
  );
}

/* ---- terminal ---- */

export function TerminalRenderer({ props }: ComponentRendererProps) {
  const raw = props['lines'];
  const lines = typeof raw === 'string' ? raw.split('\n') : arr(raw).flatMap((l) => str(l) ?? []);
  if (lines.length === 0) return <Empty>No output</Empty>;
  return (
    <Body>
      <TerminalOutput lines={lines} />
    </Body>
  );
}

/* ---- artifact ---- */

const KINDS: ArtifactKind[] = ['code', 'document', 'diff', 'preview', 'terminal', 'table', 'chart'];

export function ArtifactRenderer({ props }: ComponentRendererProps) {
  const title = str(props['title']);
  if (!title) return <Empty>No artifact</Empty>;
  const kind = KINDS.find((k) => k === props['kind']) ?? 'document';
  const version = typeof props['version'] === 'number' ? props['version'] : undefined;
  const part: ArtifactPart = { type: 'artifact', artifactId: title, kind, title, version };
  const message: Message = { id: 'cmp-artifact', role: 'assistant', parts: [part] };
  return (
    <Body>
      <ArtifactCard part={part} message={message} index={0} streaming={false} />
    </Body>
  );
}

/* ---- transcript ---- */

const staticRegistry = createRendererRegistry<ComponentType<PartProps>>({
  text: MarkdownTextPart as ComponentType<PartProps>,
});

export function TranscriptRenderer({ props }: ComponentRendererProps) {
  const messages: Message[] = arr(props['messages']).flatMap((m, i) => {
    if (!isObj(m)) return [];
    const text = str(m['text']);
    if (text === undefined) return [];
    const role = m['role'] === 'user' ? 'user' : 'assistant';
    return [{ id: `m${i}`, role, parts: [{ type: 'text' as const, text }] }];
  });
  if (messages.length === 0) return <Empty>No messages</Empty>;
  return (
    <div className="aicl-cmp-transcript">
      <Transcript messages={messages} status="idle" registry={staticRegistry} />
    </div>
  );
}

/* ---- table ---- */

export function TableRenderer({ props }: ComponentRendererProps) {
  const columns = arr(props['columns']).map((c) => str(c) ?? '');
  const rows = arr(props['rows']).map((r) => arr(r).map((c) => str(c) ?? ''));
  const width = Math.max(columns.length, ...rows.map((r) => r.length), 0);
  if (width === 0) return <Empty>No data</Empty>;
  const pad = (cells: string[]) => Array.from({ length: width }, (_, i) => cells[i] ?? '');
  return (
    <Body>
      <table className="aicl-cmp-table">
        {columns.length > 0 ? (
          <thead>
            <tr>
              {pad(columns).map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {pad(r).map((c, ci) => (
                <td key={ci}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Body>
  );
}

/* ---- metric ---- */

export function MetricRenderer({ props }: ComponentRendererProps) {
  const value = str(props['value']);
  if (value === undefined) return <Empty>No value</Empty>;
  const trend = props['trend'] === 'up' || props['trend'] === 'down' ? props['trend'] : 'flat';
  const delta = str(props['delta']);
  const label = str(props['label']);
  return (
    <div className="aicl-cmp-metric">
      {label ? <div className="aicl-cmp-metric-label">{label}</div> : null}
      <div className="aicl-cmp-metric-value">{value}</div>
      {delta ? (
        <div className="aicl-cmp-metric-delta" data-trend={trend}>
          {trend === 'up' ? '↑ ' : trend === 'down' ? '↓ ' : ''}
          {delta}
        </div>
      ) : null}
    </div>
  );
}
