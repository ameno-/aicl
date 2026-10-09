<script lang="ts">
  import { tick } from 'svelte';
  import { reasoningLabel, renderMarkdown, toolLabel, type Chat } from './aicl-chat.js';

  let { chat }: { chat: Chat } = $props();
  let end: HTMLElement | undefined = $state();

  $effect(() => {
    const s = $chat;
    if (s.status === 'idle' && s.messages.every((m) => m.seed)) return;
    tick().then(() => end?.scrollIntoView({ block: 'end' }));
  });

  const userText = (parts: { type: string; text?: string }[]) => parts.map((p) => (p?.type === 'text' ? p.text : '')).join('\n');
</script>

<div class="aicl-thread" role="log" aria-live="polite" aria-label="Conversation">
  {#each $chat.messages as m, mi (m.id)}
    {@const streaming = $chat.status === 'streaming' && mi === $chat.messages.length - 1}
    {#if m.role === 'user'}
      <div class="aicl-msg" data-role="user"><div class="aicl-bubble">{userText(m.parts)}</div></div>
    {:else}
      <div class="aicl-msg" data-role="assistant">
        {#each m.parts as part}
          {#if part?.type === 'text'}
            <div class="aicl-md">{@html renderMarkdown(part.text)}</div>
          {:else if part?.type === 'reasoning'}
            <details class="aicl-reasoning" data-streaming={streaming && !part.durationMs ? '' : undefined}>
              <summary><span class="aicl-dot"></span>{reasoningLabel(part, streaming)}</summary>
              {#if part.text}<div>{part.text}</div>{/if}
            </details>
          {:else if part?.type === 'tool-call'}
            <details class="aicl-tool" data-status={part.status} open={part.status === 'error'}>
              <summary><span class="aicl-dot"></span>{toolLabel(part)}</summary>
              <pre>{part.argsText ?? JSON.stringify(part.args, null, 2)}</pre>
            </details>
          {:else if part?.type === 'artifact'}
            <div class="aicl-artifact">
              <span class="aicl-artifact-kind">{part.kind}</span>
              <span class="aicl-artifact-title">{part.title ?? part.artifactId}</span>
              {#if part.version != null}<span class="aicl-artifact-version">v{part.version}</span>{/if}
            </div>
          {:else if part?.type === 'error'}
            <div class="aicl-error" role="alert">{part.message}</div>
          {:else if part?.type === 'html'}
            <div>{@html part.html}</div>
          {/if}
        {/each}
        {#if m.aborted}<div class="aicl-status">Stopped</div>{/if}
      </div>
    {/if}
  {/each}
  {#if $chat.status === 'submitted'}
    <div class="aicl-msg" data-role="assistant">
      <span class="aicl-pending"><span class="aicl-dot" data-status="running"></span>Thinking…</span>
    </div>
  {/if}
  {#if $chat.status === 'error' && $chat.error}
    <div class="aicl-error" role="alert">
      <span>{$chat.error.message}</span>
      {#if $chat.error.retryable !== false}<button type="button" onclick={() => chat.retry()}>Retry</button>{/if}
    </div>
  {/if}
  <div bind:this={end}></div>
</div>
