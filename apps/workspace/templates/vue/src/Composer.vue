<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { Chat, ChatState } from './aicl-chat.js';

const props = withDefaults(
  defineProps<{ chat: Chat; state: ChatState; placeholder?: string; suggestions?: string[]; variant?: 'docked' | 'hero' }>(),
  { placeholder: 'Message', suggestions: () => [], variant: 'docked' },
);

const value = ref('');
const input = ref<HTMLTextAreaElement | null>(null);
const status = computed(() => props.state.status);
const busy = computed(() => status.value === 'submitted' || status.value === 'streaming');

watch(value, async () => {
  await nextTick();
  const el = input.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
});

function submit() {
  if (busy.value || !value.value.trim()) return;
  void props.chat.send(value.value);
  value.value = '';
}

function onSubmit() {
  if (status.value === 'streaming') props.chat.stop();
  else submit();
}

/** Enter sends (never mid-IME-composition); Shift+Enter adds a line. */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    submit();
  }
}

function pick(s: string) {
  value.value = s;
  input.value?.focus();
}
</script>

<template>
  <form class="aicl-composer" :data-variant="variant" @submit.prevent="onSubmit">
    <div v-if="suggestions.length" class="aicl-chips">
      <button v-for="s in suggestions" :key="s" type="button" class="aicl-chip" @click="pick(s)">{{ s }}</button>
    </div>
    <div class="aicl-input">
      <textarea ref="input" v-model="value" rows="1" :placeholder="placeholder" aria-label="Message" @keydown="onKeydown" />
      <button
        type="submit"
        class="aicl-send"
        :aria-label="status === 'streaming' ? 'Stop' : 'Send'"
        :disabled="status === 'submitted' || (status !== 'streaming' && !value.trim())"
      >
        {{ status === 'streaming' ? '■' : '↑' }}
      </button>
    </div>
  </form>
</template>
