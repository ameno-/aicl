<script lang="ts">
  import type { Chat } from './aicl-chat.js';

  let {
    chat,
    placeholder = 'Message',
    suggestions = [],
    variant = 'docked',
  }: { chat: Chat; placeholder?: string; suggestions?: string[]; variant?: 'docked' | 'hero' } = $props();

  let value = $state('');
  let input: HTMLTextAreaElement | undefined = $state();
  const status = $derived($chat.status);
  const busy = $derived(status === 'submitted' || status === 'streaming');

  $effect(() => {
    void value;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
  });

  function submit() {
    if (busy || !value.trim()) return;
    void chat.send(value);
    value = '';
  }

  function onsubmit(e: SubmitEvent) {
    e.preventDefault();
    if (status === 'streaming') chat.stop();
    else submit();
  }

  /** Enter sends (never mid-IME-composition); Shift+Enter adds a line. */
  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submit();
    }
  }
</script>

<form class="aicl-composer" data-variant={variant} {onsubmit}>
  {#if suggestions.length}
    <div class="aicl-chips">
      {#each suggestions as s}
        <button type="button" class="aicl-chip" onclick={() => ((value = s), input?.focus())}>{s}</button>
      {/each}
    </div>
  {/if}
  <div class="aicl-input">
    <textarea bind:this={input} bind:value rows="1" {placeholder} aria-label="Message" {onkeydown}></textarea>
    <button
      type="submit"
      class="aicl-send"
      aria-label={status === 'streaming' ? 'Stop' : 'Send'}
      disabled={status === 'submitted' || (status !== 'streaming' && !value.trim())}
    >
      {status === 'streaming' ? '■' : '↑'}
    </button>
  </div>
</form>
