/**
 * Wave 2, work package C — agent nodes: independent agents on the canvas.
 * CONTRACT: shared/agentic.ts + server/feature.ts.
 *
 * A node is a canvas component "agent" with its own session (kind 'node').
 * Whenever its session runs, a hidden <canvas-context> block carries its role
 * and its inputs (shapes with arrows pointing into it). The block reuses the
 * existing tag so the history stripper in sessions.ts removes it.
 */
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { AgentNodeProps } from '../shared/agentic.ts';
import { shortId, type ShapeSummary } from '../shared/scratch.ts';
import type { FeatureContext, FeatureModule } from './feature.ts';
import { json, readJson } from './http.ts';
import type { SessionHub } from './sessions.ts';

export const NODES_PROMPT = `## Agent nodes
Independent agents can live on the canvas, each with its own conversation and role. Create one with scratch_add kind "component" component "agent" props {name, role} (give it an id); keep roles to a sentence. Draw an arrow from one node to another to make the first an input of the second: the receiving node is shown what its incoming neighbours contain (a node's input is that node's latest reply). Delegate with agent_send {to: <node shape id>, message}: it runs that node and returns its reply. Send to upstream nodes first, then to the nodes that read them.`;

const MAX_INPUT = 1500;

const clip = (s: string, max = MAX_INPUT) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** The component "agent" shapes of a canvas read. */
export const agentShapes = (shapes: ShapeSummary[]): ShapeSummary[] =>
  shapes.filter((s) => s.kind === 'component' && s.component === 'agent');

export const nodeProps = (shape: ShapeSummary): AgentNodeProps => {
  const p = shape.props ?? {};
  return {
    name: typeof p['name'] === 'string' && p['name'] ? p['name'] : (shape.title ?? 'Agent'),
    ...(typeof p['role'] === 'string' && p['role'] ? { role: p['role'] } : {}),
    ...(typeof p['sessionId'] === 'string' && p['sessionId'] ? { sessionId: p['sessionId'] } : {}),
  };
};

/** Shapes with an arrow pointing INTO `nodeId` (outgoing arrows are ignored). */
export function inputsOf(shapes: ShapeSummary[], nodeId: string): ShapeSummary[] {
  const byId = new Map(shapes.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const out: ShapeSummary[] = [];
  for (const a of shapes) {
    if (a.kind !== 'arrow' || !a.to || shortId(a.to) !== nodeId || !a.from) continue;
    const src = byId.get(shortId(a.from));
    if (!src || src.id === nodeId || seen.has(src.id)) continue;
    seen.add(src.id);
    out.push(src);
  }
  return out;
}

/** One input as a line of text. `lastReply` resolves an agent node's latest answer. */
export function describeInput(shape: ShapeSummary, lastReply: (sessionId: string) => string | undefined): string {
  if (shape.component === 'agent') {
    const { name, sessionId } = nodeProps(shape);
    const reply = sessionId ? lastReply(sessionId) : undefined;
    return `- agent "${name}" (${shape.id}), its latest reply: ${reply ? clip(reply) : '(nothing yet)'}`;
  }
  if (shape.kind === 'component') {
    const props = shape.props ? clip(JSON.stringify(shape.props)) : '';
    return `- component ${shape.component ?? '?'}${shape.title ? ` "${shape.title}"` : ''} (${shape.id}): ${props}`;
  }
  return `- ${shape.kind} (${shape.id}): ${clip(shape.text ?? shape.title ?? '(no text)')}`;
}

/** The hidden block prepended to a node's prompt. Empty when the node has neither role nor inputs. */
export function nodeContextBlock(node: ShapeSummary, inputs: ShapeSummary[], lastReply: (sessionId: string) => string | undefined): string {
  const { name, role } = nodeProps(node);
  const lines = [`You are the agent node "${name}" on a shared canvas (shape ${node.id}).`];
  if (role) lines.push(`Your role: ${role}`);
  if (inputs.length) {
    lines.push('Your inputs (shapes with arrows pointing into you):', ...inputs.map((s) => describeInput(s, lastReply)));
  }
  if (!role && !inputs.length) return '';
  return `\n\n<canvas-context>\n${lines.join('\n')}\n</canvas-context>`;
}

/** Last assistant text in a Pi message list. */
export function lastAssistantText(messages: readonly unknown[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as { role?: string; content?: unknown };
    if (m.role !== 'assistant' || !Array.isArray(m.content)) continue;
    const text = (m.content as Array<{ type: string; text?: string }>)
      .map((c) => (c.type === 'text' ? (c.text ?? '') : ''))
      .join('\n')
      .trim();
    if (text) return text;
  }
  return undefined;
}

type NodeHub = Pick<SessionHub, 'reserve' | 'run' | 'agent' | 'create'>;

export interface NodeDeps {
  hub(): NodeHub;
  /** The canvas shapes right now. Rejects when no canvas is open. */
  readCanvas(signal?: AbortSignal): Promise<ShapeSummary[]>;
  /** Persists a new sessionId on a node shape. */
  saveSession(shapeId: string, props: Record<string, unknown>): Promise<void>;
}

export function createNodeLogic(deps: NodeDeps) {
  const lastReplyOf = async (sessionIds: Iterable<string>) => {
    const replies = new Map<string, string>();
    for (const id of sessionIds) {
      try {
        const text = lastAssistantText((await deps.hub().agent(id)).messages);
        if (text) replies.set(id, text);
      } catch {
        // Unknown or unloadable session: treated as "nothing yet".
      }
    }
    return replies;
  };

  /** Context block for the session `sessionId` (composer path); '' when it is not a node. */
  async function contextForSession(sessionId: string): Promise<string> {
    let shapes: ShapeSummary[];
    try {
      shapes = await deps.readCanvas();
    } catch {
      return '';
    }
    const node = agentShapes(shapes).find((s) => nodeProps(s).sessionId === sessionId);
    return node ? await contextForNode(shapes, node) : '';
  }

  async function contextForNode(shapes: ShapeSummary[], node: ShapeSummary): Promise<string> {
    const inputs = inputsOf(shapes, node.id);
    const ids = inputs.flatMap((s) => (s.component === 'agent' ? [nodeProps(s).sessionId ?? ''] : [])).filter(Boolean);
    const replies = await lastReplyOf(ids);
    return nodeContextBlock(node, inputs, (id) => replies.get(id));
  }

  /** Runs a node with `message`; resolves to its final reply. */
  async function send(shapeId: string, message: string, signal?: AbortSignal): Promise<string> {
    const id = shortId(shapeId);
    const shapes = await deps.readCanvas(signal);
    const node = agentShapes(shapes).find((s) => s.id === id);
    if (!node) throw new Error(`No agent node "${id}" on the canvas. Create one with scratch_add component "agent".`);
    let { sessionId } = nodeProps(node);
    if (!sessionId) {
      const { name } = nodeProps(node);
      sessionId = (await deps.hub().create({ title: name, kind: 'node' })).id;
      await deps.saveSession(id, { ...(node.props ?? {}), sessionId });
      node.props = { ...(node.props ?? {}), sessionId };
    }
    const hub = deps.hub();
    hub.reserve(sessionId);
    const block = await contextForNode(shapes, node);
    let error: string | undefined;
    for await (const event of hub.run(sessionId, message + block, signal ?? new AbortController().signal)) {
      if (event.type === 'error') error = event.error.message;
    }
    if (error) throw new Error(`Agent "${nodeProps(node).name}" failed: ${error}`);
    return lastAssistantText((await hub.agent(sessionId)).messages) ?? '(no reply)';
  }

  return { contextForSession, send };
}

export function createNodes(context: FeatureContext): FeatureModule {
  const logic = createNodeLogic({
    hub: () => context.hub(),
    async readCanvas(signal) {
      const result = await context.relay.request({ op: 'read' }, signal);
      return result.op === 'read' ? result.shapes : [];
    },
    async saveSession(shapeId, props) {
      await context.relay.request({ op: 'update', shapes: [{ id: shapeId, props }] });
    },
  });

  const agentSend = defineTool({
    name: 'agent_send',
    label: 'Message an agent node',
    description:
      'Send a message to an agent node on the canvas (`to` = its shape id). It runs in its own conversation with its role and the contents of the shapes that have arrows into it, and the tool returns its final reply. Send to upstream nodes before the nodes that read them.',
    parameters: Type.Object({
      to: Type.String({ description: 'Shape id of an agent node (component "agent").' }),
      message: Type.String(),
    }),
    async execute(_id, params, signal) {
      const reply = await logic.send(params.to, params.message, signal);
      return { content: [{ type: 'text' as const, text: reply }], details: {} };
    },
  });

  return {
    tools: [agentSend],
    prompt: NODES_PROMPT,
    contextFor: logic.contextForSession,
    routes: {
      'POST /api/nodes/:shapeId/run': async (req, res, { params }) => {
        const body = await readJson<{ message?: unknown }>(req);
        if (typeof body.message !== 'string' || !body.message.trim()) return json(res, 400, { message: 'message is required.' });
        try {
          json(res, 200, { reply: await logic.send(params['shapeId']!, body.message) });
        } catch (cause) {
          json(res, 502, { message: cause instanceof Error ? cause.message : String(cause) });
        }
      },
    },
  };
}
