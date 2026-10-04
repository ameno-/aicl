import { useState, type ComponentType } from 'react';
import {
  createRendererRegistry,
  type ArtifactPart,
  type Message,
  type Part,
  type ReasoningPart,
  type RendererRegistry,
  type TextPart as TextPartModel,
  type ToolCallPart,
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
}: PartProps<ArtifactPart> & { onOpen?: (part: ArtifactPart) => void }) {
  return (
    <div data-aicl="artifact-card" data-artifact-kind={part.kind} data-openable={onOpen ? '' : undefined}>
      <span data-aicl="artifact-title">{part.title ?? part.artifactId}</span>
      <span data-aicl="artifact-kind">{part.kind}</span>
      {part.version != null ? <span data-aicl="artifact-version">v{part.version}</span> : null}
      {onOpen ? (
        <button type="button" data-aicl="artifact-open" onClick={() => onOpen(part)}>
          Open
        </button>
      ) : null}
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
    artifact: ((props: PartProps) =>
      props.part.type === 'artifact' ? <ArtifactCard {...props} part={props.part} /> : null) as ComponentType<PartProps>,
  },
  UnknownPart,
);

/** Default closed set. Consumers register `data-*` parts on a copy, not on this object. */
export function defaultRegistry(): RendererRegistry<ComponentType<PartProps>> {
  return sharedRegistry;
}
