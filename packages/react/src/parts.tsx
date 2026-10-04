import { useState, type ComponentType, type ReactNode } from 'react';
import {
  createRendererRegistry,
  type ArtifactPart,
  type FilePart,
  type Message,
  type Part,
  type ReasoningPart,
  type RendererRegistry,
  type TextPart as TextPartModel,
  type ToolCallPart,
  type ToolResultPart,
} from '@aicl/core';

export interface PartProps<P extends Part = Part> {
  part: P;
  message: Message;
  index: number;
  streaming: boolean;
}

export function createPartRegistry(
  initial?: Partial<Record<string, ComponentType<PartProps>>>,
  fallback?: ComponentType<PartProps>,
): RendererRegistry<ComponentType<PartProps>> {
  return createRendererRegistry(initial, fallback);
}

export function PartRenderer({
  part,
  message,
  index,
  streaming,
  registry,
}: PartProps & { registry?: RendererRegistry<ComponentType<PartProps>> }) {
  const custom = registry?.has(part.type) ? registry.resolve(part) : undefined;
  const Renderer = custom ?? defaultRegistry().resolve(part) ?? UnknownPart;
  return <Renderer part={part} message={message} index={index} streaming={streaming} />;
}

export function TextPartView({ part }: PartProps<TextPartModel>) {
  return <div data-aicl="part" data-part="text">{part.text}</div>;
}

export function ReasoningDisclosure({
  part,
  streaming,
}: {
  part?: ReasoningPart;
  streaming: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pending = streaming && !part?.text;
  const label = part?.durationMs
    ? `Thought for ${Math.max(1, Math.round(part.durationMs / 1000))}s`
    : pending || streaming
      ? 'Thinking'
      : 'Thought';
  return (
    <div data-aicl="reasoning" data-state={pending ? 'pending' : open ? 'open' : 'closed'}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {label}
      </button>
      {open && part?.text ? <div data-aicl="reasoning-body">{part.text}</div> : null}
    </div>
  );
}

export function ToolCallDisclosure({ part }: PartProps<ToolCallPart>) {
  const forceOpen = part.status === 'error';
  const [open, setOpen] = useState(forceOpen);
  const shown = forceOpen || open;
  const label =
    part.status === 'cancelled'
      ? `${part.name} cancelled`
      : part.status === 'error'
        ? `${part.name} failed`
        : part.status === 'running' || part.status === 'pending'
          ? `${part.name}…`
          : part.name;
  return (
    <div data-aicl="tool-call" data-status={part.status} data-open={shown || undefined}>
      <button
        type="button"
        aria-expanded={shown}
        onClick={() => {
          if (!forceOpen) setOpen((v) => !v);
        }}
      >
        {label}
      </button>
      {shown ? (
        <pre data-aicl="tool-call-body">{part.argsText ?? JSON.stringify(part.args)}</pre>
      ) : null}
    </div>
  );
}

export function ArtifactCard({
  part,
  onOpen,
  children,
}: PartProps<ArtifactPart> & { onOpen?: (part: ArtifactPart) => void; children?: ReactNode }) {
  return (
    <div
      data-aicl="artifact-card"
      data-part="artifact"
      data-artifact-kind={part.kind}
      data-artifact-id={part.artifactId}
      data-artifact-version={part.version}
      data-openable={onOpen ? '' : undefined}
    >
      <span data-aicl="artifact-title">{part.title ?? part.artifactId}</span>
      <span data-aicl="artifact-kind">{part.kind}</span>
      {part.version != null ? <span data-aicl="artifact-version">v{part.version}</span> : null}
      {onOpen ? (
        <button type="button" data-aicl="artifact-open" aria-label={`Open ${part.kind} artifact${part.version != null ? `, version ${part.version}` : ''}`} onClick={() => onOpen(part)}>
          Open
        </button>
      ) : null}
      {children}
    </div>
  );
}

export function CodeBlock({
  content,
  language,
  inline = false,
}: {
  content: string;
  language?: string;
  inline?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <figure data-aicl="code-block" data-language={language} data-copied={copied || undefined} data-inline={inline || undefined}>
      {language ? <figcaption>{language}</figcaption> : null}
      <pre>
        <code>{content}</code>
      </pre>
      <button
        type="button"
        aria-label="Copy code"
        onClick={() => {
          void navigator.clipboard?.writeText(content);
          setCopied(true);
        }}
      >
        Copy
      </button>
      <span aria-live="polite">{copied ? 'Copied' : ''}</span>
    </figure>
  );
}

export function ToolResultView({ part }: PartProps<ToolResultPart>) {
  return (
    <div
      data-aicl="part"
      data-part="tool-result"
      data-is-error={part.isError || undefined}
      role="region"
      aria-label={part.toolCallId}
    >
      {part.isError ? 'Error' : 'Result'}
    </div>
  );
}

export function FileChip({ part, onOpen }: PartProps<FilePart> & { onOpen?: (part: FilePart) => void }) {
  const uploading = part.uploadProgress != null && part.uploadProgress < 100;
  return (
    <div
      data-aicl="part"
      data-part="file"
      data-media-type={part.mediaType}
      data-state={uploading ? 'uploading' : 'uploaded'}
      data-progress={part.uploadProgress}
    >
      <button type="button" onClick={() => onOpen?.(part)}>
        {part.name ?? part.url}
      </button>
    </div>
  );
}

export function ErrorNotice({
  part,
  streaming,
  onRetry,
}: PartProps & { onRetry?: () => void }) {
  if (part.type !== 'error') return null;
  return (
    <div data-aicl="part" data-part="error" data-retryable={part.retryable || undefined} role={streaming ? 'alert' : 'status'}>
      <p>{part.message}</p>
      {part.retryable && onRetry ? (
        <button type="button" aria-label="Retry" onClick={onRetry}>
          ↻
        </button>
      ) : null}
    </div>
  );
}

export function SuggestionRows({ part, onSelect }: PartProps & { onSelect?: (label: string) => void }) {
  const suggestions =
    part.type === 'data-suggested-followups' &&
    part.data &&
    typeof part.data === 'object' &&
    'suggestions' in part.data &&
    Array.isArray((part.data as { suggestions: unknown }).suggestions)
      ? (part.data as { suggestions: Array<{ id?: string; label: string }> }).suggestions
      : [];
  if (!suggestions.length) return null;
  return (
    <div data-aicl="part" data-part="data-suggested-followups" data-count={suggestions.length} data-behavior="insert">
      {suggestions.map((item) => (
        <button key={item.id ?? item.label} type="button" onClick={() => onSelect?.(item.label)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function TerminalOutput({ lines, streaming = false }: { lines: string[]; streaming?: boolean }) {
  return (
    <div
      data-aicl="terminal-output"
      data-streaming={streaming || undefined}
      data-following={streaming || undefined}
      data-line-count={lines.length}
      role="log"
      aria-live="off"
    >
      {lines.map((line, index) => (
        <div key={`${index}:${line}`}>{line}</div>
      ))}
    </div>
  );
}

export function UnknownPart({ part }: PartProps) {
  return (
    <div data-aicl="part" data-part="unknown" data-raw-type={part.type}>
      {part.type}
    </div>
  );
}

const sharedRegistry = createRendererRegistry<ComponentType<PartProps>>(
  {
    text: TextPartView as ComponentType<PartProps>,
    reasoning: ((props: PartProps) =>
      props.part.type === 'reasoning' ? (
        <ReasoningDisclosure part={props.part} streaming={props.streaming} />
      ) : null) as ComponentType<PartProps>,
    'tool-call': ((props: PartProps) =>
      props.part.type === 'tool-call' ? <ToolCallDisclosure {...props} part={props.part} /> : null) as ComponentType<PartProps>,
    artifact: ((props: PartProps) => {
      if (props.part.type !== 'artifact') return null;
      if (props.part.kind === 'terminal') {
        return (
          <ArtifactCard {...props} part={props.part}>
            <TerminalOutput lines={['ready']} streaming={props.streaming} />
          </ArtifactCard>
        );
      }
      return <ArtifactCard {...props} part={props.part} />;
    }) as ComponentType<PartProps>,
    'tool-result': ToolResultView as ComponentType<PartProps>,
    file: FileChip as ComponentType<PartProps>,
    error: ErrorNotice as ComponentType<PartProps>,
    'data-suggested-followups': SuggestionRows as ComponentType<PartProps>,
  },
  UnknownPart,
);

/** Default closed set. Consumers register `data-*` parts on a copy, not on this object. */
export function defaultRegistry(): RendererRegistry<ComponentType<PartProps>> {
  return sharedRegistry;
}
