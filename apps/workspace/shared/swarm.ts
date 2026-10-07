/**
 * Multi-agent contract (AICL-40): sub-agents spawned by agents, the live
 * agent tree, and the handoff log. Types and limits shared by server and browser.
 *
 *   Tools: spawn_agent {name, role, task, wait?, model?}, agent_status {id?},
 *          agent_message {id, text}, agent_stop {id}, agent_wait {ids}
 *   HTTP:  GET  /api/swarm/log                  → { events: SwarmEvent[] }
 *          POST /api/swarm/:id/message {text}   → { ok, mode: 'steered' | 'started' }
 *          (stopping uses POST /api/sessions/:id/stop, which also stops running descendants)
 */

/** A child may not spawn below this depth (the main chat is depth 0). */
export const MAX_AGENT_DEPTH = 3;
/** Running descendants allowed at once under one root. */
export const MAX_CONCURRENT_CHILDREN = 6;

export interface SwarmEvent {
  id: string;
  at: number;
  type: 'spawn' | 'message' | 'result' | 'stop';
  /** The session acting (parent for spawn/message/stop, the child for result). */
  from: string;
  /** The session acted on. */
  to: string;
  /** Names at the time, so the log survives deleted sessions. */
  fromName: string;
  toName: string;
  /** Task for spawn, text for message, final reply excerpt for result. */
  text: string;
  status?: 'done' | 'error' | 'stopped';
}
