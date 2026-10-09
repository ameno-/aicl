// AICL chat client: a dependency-free store for one conversation over the AICL
// wire (StreamEvent JSON in Server-Sent Events, see server/index.js).
// Framework bindings subscribe to it: React (useSyncExternalStore), Vue
// (shallowRef), Svelte ($store), or plain DOM.

/** @typedef {import('./aicl-chat').ChatState} ChatState */

const BUSY = new Set(['submitted', 'streaming']);

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** @param {import('./aicl-chat').ChatOptions} [options] */
export function createChat(options = {}) {
  const endpoint = options.endpoint ?? '/api/chat';
  const fetchImpl = options.fetch ?? ((...args) => globalThis.fetch(...args));
  /** @type {ChatState} */
  let state = { messages: [...(options.initialMessages ?? [])], status: 'idle', error: null };
  const listeners = new Set();
  /** @type {AbortController | null} */
  let controller = null;

  const set = (patch) => {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener(state);
  };
  const patchMessage = (id, fn) =>
    set({ messages: state.messages.map((m) => (m.id === id ? fn(m) : m)) });

  async function run() {
    const ac = new AbortController();
    controller = ac;
    set({ status: 'submitted', error: null });
    /** @type {string | null} */
    let assistantId = null;
    try {
      const history = state.messages.filter((m) => options.sendSeedMessages || !m.seed);
      const headers =
        typeof options.headers === 'function' ? options.headers() : (options.headers ?? {});
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        signal: ac.signal,
        headers: { 'content-type': 'application/json', accept: 'text/event-stream', ...headers },
        body: JSON.stringify({ messages: history.map(({ seed, ...m }) => m), ...(options.body ?? {}) }),
      });
      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => '');
        let message = detail;
        try {
          message = JSON.parse(detail).message ?? detail;
        } catch {}
        throw Object.assign(new Error(message || `Request failed (${response.status})`), {
          retryable: response.status >= 500 || response.status === 429,
        });
      }
      for await (const event of readEvents(response.body)) {
        if (ac.signal.aborted) break;
        assistantId = reduce(event, assistantId);
        if (event.type === 'error') return;
      }
      if (!ac.signal.aborted) set({ status: 'idle' });
    } catch (cause) {
      if (ac.signal.aborted) return;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      set({ status: 'error', error: { message: error.message, retryable: error.retryable ?? true } });
    } finally {
      if (controller === ac) controller = null;
    }
  }

  function reduce(event, assistantId) {
    switch (event.type) {
      case 'message-start': {
        const id = event.id || newId();
        set({ status: 'streaming', messages: [...state.messages, { id, role: 'assistant', parts: [] }] });
        return id;
      }
      case 'part-start':
      case 'part-end':
        if (assistantId && (event.type === 'part-start' || event.part)) {
          patchMessage(assistantId, (m) => {
            const parts = m.parts.slice();
            parts[event.index] = event.part;
            return { ...m, parts };
          });
        }
        return assistantId;
      case 'part-delta':
        if (assistantId) {
          patchMessage(assistantId, (m) => {
            const target = m.parts[event.index];
            if (!target) return m;
            const parts = m.parts.slice();
            if (target.type === 'text' || target.type === 'reasoning') parts[event.index] = { ...target, text: target.text + event.delta };
            else if (target.type === 'tool-call') parts[event.index] = { ...target, argsText: (target.argsText ?? '') + event.delta };
            return { ...m, parts };
          });
        }
        return assistantId;
      case 'message-end':
        if (assistantId && event.usage) patchMessage(assistantId, (m) => ({ ...m, usage: event.usage }));
        return assistantId;
      case 'error':
        set({ status: 'error', error: event.error });
        return assistantId;
      default:
        return assistantId;
    }
  }

  return {
    getState: () => state,
    /** Calls `listener` now and on every change; returns an unsubscribe function (Svelte store contract). */
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    /** Appends a user message and streams the reply. Ignored while a reply is in flight. */
    async send(text) {
      const value = String(text ?? '').trim();
      if (!value || BUSY.has(state.status)) return;
      set({ messages: [...state.messages, { id: newId(), role: 'user', parts: [{ type: 'text', text: value }] }] });
      await run();
    },
    /** Re-runs the last turn, whether it failed before or after the reply started. */
    async retry() {
      if (BUSY.has(state.status)) return;
      const last = state.messages[state.messages.length - 1];
      if (!last || last.seed) return;
      if (last.role === 'assistant') set({ messages: state.messages.slice(0, -1) });
      await run();
    },
    /** Stops the reply. Partial output is kept; running tools become cancelled. */
    stop() {
      if (!controller) return;
      controller.abort();
      controller = null;
      const last = state.messages[state.messages.length - 1];
      if (last?.role === 'assistant' && !last.seed) {
        patchMessage(last.id, (m) => ({
          ...m,
          aborted: true,
          parts: m.parts.map((p) => (p?.type === 'tool-call' && (p.status === 'running' || p.status === 'pending') ? { ...p, status: 'cancelled' } : p)),
        }));
      }
      set({ status: 'aborted' });
    },
    /** Removes every message, including the designed sample conversation. */
    clear() {
      if (BUSY.has(state.status)) return;
      set({ messages: [], status: 'idle', error: null });
    },
  };
}

/** Parses an SSE body into StreamEvent objects. `[DONE]` and comment frames are skipped. */
export async function* readEvents(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (!data || data === '[DONE]') continue;
        try {
          yield JSON.parse(data);
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ESCAPES[c]);

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
}

/**
 * Small, safe Markdown → HTML for assistant text: paragraphs, headings, lists,
 * fenced code, inline code, bold, italic, http(s)/mailto links. All input is
 * escaped first, so model output cannot inject markup. Swap in a full Markdown
 * renderer if you need tables or nested lists.
 */
export function renderMarkdown(source) {
  const out = [];
  const lines = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  let list = null;
  let paragraph = [];
  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^```\s*([\w-]*)\s*$/.exec(line);
    if (fence) {
      flushParagraph();
      flushList();
      const code = [];
      while (++i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i]);
      const lang = fence[1] ? ` data-language="${escapeHtml(fence[1])}"` : '';
      out.push(`<pre${lang}><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      out.push(`<h${heading[1].length + 2}>${inline(heading[2])}</h${heading[1].length + 2}>`);
    } else if (bullet || numbered) {
      flushParagraph();
      const tag = bullet ? 'ul' : 'ol';
      if (list?.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push((bullet ?? numbered)[1]);
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return out.join('');
}

/** Label for a tool-call part: "search…", "search failed", "search". */
export function toolLabel(part) {
  const name = part.name || 'tool';
  if (part.status === 'error') return `${name} failed`;
  if (part.status === 'cancelled') return `${name} cancelled`;
  if (part.status === 'running' || part.status === 'pending') return `${name}…`;
  return name;
}

/** Label for a reasoning part: "Thinking…" while streaming, then "Thought for Ns" or "Thought". */
export function reasoningLabel(part, streaming) {
  if (part.durationMs) return `Thought for ${Math.max(1, Math.round(part.durationMs / 1000))}s`;
  return streaming ? 'Thinking…' : 'Thought';
}
