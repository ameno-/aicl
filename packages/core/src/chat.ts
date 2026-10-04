/**
 * The conversation engine: status transitions, stream reduction, branching.
 *
 * This file contains no DOM access and no framework imports. Everything an
 * adapter needs is exposed through `ChatController`.
 */

import { createStore, batched, type WritableStore } from './store.js';
import type {
  ChatState,
  ChatStatus,
  ChatTransport,
  Message,
  MessageNode,
  Part,
  ReadableStore,
  StreamEvent,
} from './types.js';

export interface ChatOptions {
  transport: ChatTransport;
  initialMessages?: Message[];
  generateId?: () => string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  onFinish?: (message: Message) => void;
  onError?: (error: Error) => void;
}

const defaultId = (): string =>
  // crypto.randomUUID is unavailable on http origins and in older runtimes.
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function emptyState(): ChatState {
  return { status: 'idle', nodes: {}, path: [] };
}

/** Statuses during which a new submission must be rejected. */
const BUSY: ReadonlySet<ChatStatus> = new Set<ChatStatus>(['submitted', 'streaming']);

export class ChatController {
  readonly state: ReadableStore<ChatState>;

  private store: WritableStore<ChatState>;
  private options: ChatOptions;
  private controller: AbortController | null = null;
  private genId: () => string;

  constructor(options: ChatOptions) {
    this.options = options;
    this.genId = options.generateId ?? defaultId;

    const base = createStore<ChatState>(emptyState());
    this.store = base;
    // Adapters subscribe to the batched view so a burst of token deltas
    // collapses into one render per microtask.
    this.state = batched(base);

    if (options.initialMessages?.length) {
      this.store.set(seedLinear(options.initialMessages));
    }
  }

  /** Messages along the currently selected branch, oldest first. */
  get messages(): Message[] {
    const { nodes, path } = this.store.get();
    return path.map((id) => nodes[id]!.message);
  }

  get status(): ChatStatus {
    return this.store.get().status;
  }

  /** Appends a user message and streams the assistant reply. */
  async send(text: string, attachments: Part[] = []): Promise<void> {
    if (BUSY.has(this.status)) return;

    const parts: Part[] = [];
    if (text.trim()) parts.push({ type: 'text', text });
    parts.push(...attachments);
    if (!parts.length) return;

    const message: Message = {
      id: this.genId(),
      role: 'user',
      parts,
      createdAt: Date.now(),
    };
    this.appendToPath(message);
    await this.run();
  }

  /** Re-runs the last assistant turn as a sibling branch. */
  async regenerate(): Promise<void> {
    if (BUSY.has(this.status)) return;
    const { path, nodes } = this.store.get();
    const lastId = path[path.length - 1];
    if (!lastId || nodes[lastId]!.message.role !== 'assistant') return;

    this.store.update((s) => ({ ...s, path: s.path.slice(0, -1) }));
    await this.run();
  }

  /**
   * Edits a user message, forking rather than overwriting. The original stays
   * in the tree and remains reachable through the branch switcher.
   */
  async edit(messageId: string, text: string): Promise<void> {
    if (BUSY.has(this.status)) return;
    const { nodes } = this.store.get();
    const node = nodes[messageId];
    if (!node || node.message.role !== 'user') return;

    const forked: Message = {
      id: this.genId(),
      role: 'user',
      parts: [{ type: 'text', text }],
      createdAt: Date.now(),
    };

    this.store.update((s) => {
      const parentId = node.parentId;
      const nextNodes: Record<string, MessageNode> = {
        ...s.nodes,
        [forked.id]: { message: forked, parentId, childIds: [] },
      };
      if (parentId) {
        nextNodes[parentId] = {
          ...nextNodes[parentId]!,
          childIds: [...nextNodes[parentId]!.childIds, forked.id],
        };
      }
      const cut = s.path.indexOf(messageId);
      return { ...s, nodes: nextNodes, path: [...s.path.slice(0, cut), forked.id] };
    });

    await this.run();
  }

  /** Switches to a sibling branch and truncates the path at that point. */
  selectBranch(messageId: string): void {
    const { nodes } = this.store.get();
    if (!nodes[messageId]) return;

    const path: string[] = [];
    for (let id: string | null = messageId; id; id = nodes[id]!.parentId) path.unshift(id);
    // Extend along first children so the branch renders to its end.
    let tail = messageId;
    while (nodes[tail]!.childIds.length) {
      tail = nodes[tail]!.childIds[0]!;
      path.push(tail);
    }
    this.store.update((s) => ({ ...s, path }));
  }

  /**
   * Cooperative abort. The partial message is kept and flagged rather than
   * discarded; every surveyed product preserves partial output on interrupt.
   */
  stop(): void {
    this.controller?.abort();
    this.controller = null;
    this.store.update((s) => {
      if (!s.streamingId) return { ...s, status: 'idle' };
      const node = s.nodes[s.streamingId];
      if (!node) return { ...s, status: 'aborted', streamingId: undefined };
      return {
        ...s,
        status: 'aborted',
        streamingId: undefined,
        nodes: {
          ...s.nodes,
          [s.streamingId]: {
            ...node,
            message: {
              ...node.message,
              aborted: true,
              parts: cancelInFlightTools(node.message.parts),
            },
          },
        },
      };
    });
  }

  /* ---------------------------------------------------------------------- */

  private appendToPath(message: Message): void {
    this.store.update((s) => {
      const parentId = s.path[s.path.length - 1] ?? null;
      const nodes: Record<string, MessageNode> = {
        ...s.nodes,
        [message.id]: { message, parentId, childIds: [] },
      };
      if (parentId) {
        nodes[parentId] = {
          ...nodes[parentId]!,
          childIds: [...nodes[parentId]!.childIds, message.id],
        };
      }
      return { ...s, nodes, path: [...s.path, message.id] };
    });
  }

  private async run(): Promise<void> {
    // Held locally as well as on `this`: stop() clears the instance field, so
    // the catch below would otherwise be unable to distinguish a user abort
    // from a transport failure and would overwrite 'aborted' with 'error'.
    const controller = new AbortController();
    this.controller = controller;
    this.store.update((s) => ({ ...s, status: 'submitted', error: undefined }));

    let assistantId: string | null = null;

    try {
      const stream = this.options.transport.send(
        {
          messages: this.messages,
          body: this.options.body,
          headers: this.options.headers,
        },
        controller.signal,
      );

      for await (const event of stream) {
        if (controller.signal.aborted) break;
        assistantId = this.reduce(event, assistantId);
        // An error event is terminal. Falling through would overwrite it with idle.
        if (event.type === 'error') break;
      }

      if (controller.signal.aborted || this.store.get().status === 'error') return;

      this.store.update((s) => ({ ...s, status: 'idle', streamingId: undefined }));
      if (assistantId) {
        const node = this.store.get().nodes[assistantId];
        if (node) this.options.onFinish?.(node.message);
      }
    } catch (cause) {
      // An abort surfaces as a throw in most transports, but the user asked for
      // it; stop() has already recorded the correct state.
      if (controller.signal.aborted) return;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.store.update((s) => ({
        ...s,
        status: 'error',
        streamingId: undefined,
        error: { message: error.message, retryable: true },
      }));
      this.options.onError?.(error);
    } finally {
      this.controller = null;
    }
  }

  /** Applies one stream event. Returns the active assistant message id. */
  private reduce(event: StreamEvent, assistantId: string | null): string | null {
    switch (event.type) {
      case 'message-start': {
        const message: Message = {
          id: event.id,
          role: 'assistant',
          parts: [],
          createdAt: Date.now(),
        };
        this.appendToPath(message);
        this.store.update((s) => ({ ...s, status: 'streaming', streamingId: event.id }));
        return event.id;
      }

      case 'part-start':
        if (assistantId) {
          this.mutateParts(assistantId, (parts) => {
            const next = parts.slice();
            next[event.index] = event.part;
            return next;
          });
        }
        return assistantId;

      case 'part-delta':
        if (assistantId) {
          this.mutateParts(assistantId, (parts) => {
            const next = parts.slice();
            const target = next[event.index];
            if (!target) return parts;
            // Only text-bearing parts accumulate deltas. Tool args stream into
            // `argsText` because they are not valid JSON until complete.
            if (target.type === 'text' || target.type === 'reasoning') {
              next[event.index] = { ...target, text: target.text + event.delta };
            } else if (target.type === 'tool-call') {
              next[event.index] = {
                ...target,
                argsText: (target.argsText ?? '') + event.delta,
              };
            }
            return next;
          });
        }
        return assistantId;

      case 'part-end':
        if (assistantId && event.part) {
          const part = event.part;
          this.mutateParts(assistantId, (parts) => {
            const next = parts.slice();
            next[event.index] = part;
            return next;
          });
        }
        return assistantId;

      case 'message-end':
        if (assistantId && event.usage) {
          const usage = event.usage;
          this.store.update((s) => {
            const node = s.nodes[assistantId!];
            if (!node) return s;
            return {
              ...s,
              nodes: {
                ...s.nodes,
                [assistantId!]: { ...node, message: { ...node.message, usage } },
              },
            };
          });
        }
        return assistantId;

      case 'error':
        this.store.update((s) => ({
          ...s,
          status: 'error',
          streamingId: undefined,
          error: event.error,
        }));
        return assistantId;
    }
  }

  /**
   * Replaces the parts of one message, leaving every other node identity
   * untouched so adapters can memoise per message.
   */
  private mutateParts(id: string, fn: (parts: Part[]) => Part[]): void {
    this.store.update((s) => {
      const node = s.nodes[id];
      if (!node) return s;
      const parts = fn(node.message.parts);
      if (parts === node.message.parts) return s;
      return {
        ...s,
        nodes: { ...s.nodes, [id]: { ...node, message: { ...node.message, parts } } },
      };
    });
  }
}

/** Abort is not failure. A tool still in flight becomes cancelled, not error. */
function cancelInFlightTools(parts: Part[]): Part[] {
  let changed = false;
  const next = parts.map((part) => {
    if (part.type !== 'tool-call') return part;
    if (part.status !== 'pending' && part.status !== 'running') return part;
    changed = true;
    return { ...part, status: 'cancelled' as const };
  });
  return changed ? next : parts;
}

/** Builds a linear (unbranched) tree from a flat message list. */
function seedLinear(messages: Message[]): ChatState {
  const nodes: Record<string, MessageNode> = {};
  const path: string[] = [];
  let parentId: string | null = null;

  for (const message of messages) {
    nodes[message.id] = { message, parentId, childIds: [] };
    if (parentId) nodes[parentId]!.childIds.push(message.id);
    path.push(message.id);
    parentId = message.id;
  }
  return { status: 'idle', nodes, path };
}
