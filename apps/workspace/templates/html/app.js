// Mounts the live chat into the static page: the transcript into
// [data-aicl-thread] and the composer into [data-aicl-composer].
import { createChat, escapeHtml, reasoningLabel, renderMarkdown, toolLabel } from './aicl-chat.js';
import { seedMessages } from './seed.js';

const chat = createChat({ endpoint: '/api/chat', initialMessages: seedMessages });

const threadHost = document.querySelector('[data-aicl-thread]');
const form = document.querySelector('[data-aicl-composer]');

function partHtml(part, streaming) {
  if (!part) return '';
  switch (part.type) {
    case 'text':
      return `<div class="aicl-md">${renderMarkdown(part.text)}</div>`;
    case 'reasoning':
      return `<details class="aicl-reasoning"${streaming && !part.durationMs ? ' data-streaming' : ''}><summary><span class="aicl-dot"></span>${escapeHtml(reasoningLabel(part, streaming))}</summary>${part.text ? `<div>${escapeHtml(part.text)}</div>` : ''}</details>`;
    case 'tool-call':
      return `<details class="aicl-tool" data-status="${escapeHtml(part.status)}"${part.status === 'error' ? ' open' : ''}><summary><span class="aicl-dot"></span>${escapeHtml(toolLabel(part))}</summary><pre>${escapeHtml(part.argsText ?? JSON.stringify(part.args, null, 2))}</pre></details>`;
    case 'artifact':
      return `<div class="aicl-artifact"><span class="aicl-artifact-kind">${escapeHtml(part.kind)}</span><span class="aicl-artifact-title">${escapeHtml(part.title ?? part.artifactId)}</span>${part.version != null ? `<span class="aicl-artifact-version">v${escapeHtml(part.version)}</span>` : ''}</div>`;
    case 'error':
      return `<div class="aicl-error" role="alert">${escapeHtml(part.message)}</div>`;
    case 'html':
      return `<div>${part.html}</div>`;
    default:
      return '';
  }
}

function messageHtml(m, streaming) {
  if (m.role === 'user') {
    const text = m.parts.map((p) => (p?.type === 'text' ? p.text : '')).join('\n');
    return `<div class="aicl-msg" data-role="user"><div class="aicl-bubble">${escapeHtml(text)}</div></div>`;
  }
  return `<div class="aicl-msg" data-role="assistant">${m.parts.map((p) => partHtml(p, streaming)).join('')}${m.aborted ? '<div class="aicl-status">Stopped</div>' : ''}</div>`;
}

if (threadHost) {
  const thread = document.createElement('div');
  thread.className = 'aicl-thread';
  thread.setAttribute('role', 'log');
  thread.setAttribute('aria-live', 'polite');
  thread.setAttribute('aria-label', 'Conversation');
  threadHost.replaceWith(thread);

  // Re-render per message: messages that did not change keep their DOM (and open <details>).
  const rendered = new Map();
  chat.subscribe((state) => {
    const last = state.messages[state.messages.length - 1];
    const keep = new Set();
    let anchor = null;
    for (const m of state.messages) {
      keep.add(m.id);
      let entry = rendered.get(m.id);
      const streaming = state.status === 'streaming' && m === last;
      if (!entry || entry.message !== m) {
        const node = document.createElement('div');
        node.innerHTML = messageHtml(m, streaming);
        const el = node.firstElementChild;
        if (entry) {
          for (const [i, d] of [...entry.el.querySelectorAll('details')].entries()) {
            const next = el.querySelectorAll('details')[i];
            if (next && d.open) next.open = true;
          }
          entry.el.replaceWith(el);
        }
        entry = { message: m, el };
        rendered.set(m.id, entry);
      }
      if (entry.el.previousElementSibling !== anchor || entry.el.parentNode !== thread) {
        anchor ? anchor.after(entry.el) : thread.prepend(entry.el);
      }
      anchor = entry.el;
    }
    for (const [id, entry] of rendered) if (!keep.has(id)) (entry.el.remove(), rendered.delete(id));
    thread.querySelector('[data-aicl-transient]')?.remove();
    let extra = '';
    if (state.status === 'submitted') extra = '<div class="aicl-msg" data-role="assistant"><span class="aicl-pending"><span class="aicl-dot" data-status="running"></span>Thinking…</span></div>';
    if (state.status === 'error' && state.error)
      extra = `<div class="aicl-error" role="alert"><span>${escapeHtml(state.error.message)}</span>${state.error.retryable !== false ? '<button type="button" data-retry>Retry</button>' : ''}</div>`;
    if (extra) {
      const box = document.createElement('div');
      box.setAttribute('data-aicl-transient', '');
      box.style.display = 'contents';
      box.innerHTML = extra;
      thread.append(box);
    }
    if (state.status !== 'idle' || state.messages.some((m) => !m.seed)) thread.lastElementChild?.scrollIntoView({ block: 'end' });
  });
  thread.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('[data-retry]')) void chat.retry();
  });
}

if (form) {
  const input = form.querySelector('textarea');
  const send = form.querySelector('.aicl-send');
  const resize = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
  };
  const sync = (state = chat.getState()) => {
    const streaming = state.status === 'streaming';
    send.textContent = streaming ? '■' : '↑';
    send.setAttribute('aria-label', streaming ? 'Stop' : 'Send');
    send.disabled = state.status === 'submitted' || (!streaming && !input.value.trim());
  };
  const submit = () => {
    const state = chat.getState();
    if (state.status === 'submitted' || state.status === 'streaming' || !input.value.trim()) return;
    void chat.send(input.value);
    input.value = '';
    resize();
    sync();
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (chat.getState().status === 'streaming') chat.stop();
    else submit();
  });
  // Enter sends (never mid-IME-composition); Shift+Enter adds a line.
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submit();
    }
  });
  input.addEventListener('input', () => (resize(), sync()));
  form.querySelectorAll('.aicl-chip').forEach((chip) =>
    chip.addEventListener('click', () => {
      input.value = chip.textContent ?? '';
      input.focus();
      resize();
      sync();
    }),
  );
  chat.subscribe(sync);
}
