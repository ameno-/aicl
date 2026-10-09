<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { reasoningLabel, renderMarkdown, toolLabel, type Chat, type ChatState } from './aicl-chat.js';

const props = defineProps<{ chat: Chat; state: ChatState }>();
const end = ref<HTMLElement | null>(null);

watch(
  () => props.state,
  async (s) => {
    if (s.status === 'idle' && s.messages.every((m) => m.seed)) return;
    await nextTick();
    end.value?.scrollIntoView({ block: 'end' });
  },
);

const userText = (parts: ChatState['messages'][number]['parts']) =>
  parts.map((p) => (p?.type === 'text' ? p.text : '')).join('\n');
</script>

<template>
  <div class="aicl-thread" role="log" aria-live="polite" aria-label="Conversation">
    <template v-for="(m, mi) in state.messages" :key="m.id">
      <div v-if="m.role === 'user'" class="aicl-msg" data-role="user">
        <div class="aicl-bubble">{{ userText(m.parts) }}</div>
      </div>
      <div v-else class="aicl-msg" data-role="assistant">
        <template v-for="(part, i) in m.parts" :key="i">
          <template v-if="part">
            <div v-if="part.type === 'text'" class="aicl-md" v-html="renderMarkdown(part.text)" />
            <details
              v-else-if="part.type === 'reasoning'"
              class="aicl-reasoning"
              :data-streaming="state.status === 'streaming' && mi === state.messages.length - 1 && !part.durationMs ? '' : undefined"
            >
              <summary>
                <span class="aicl-dot" />
                {{ reasoningLabel(part, state.status === 'streaming' && mi === state.messages.length - 1) }}
              </summary>
              <div v-if="part.text">{{ part.text }}</div>
            </details>
            <details v-else-if="part.type === 'tool-call'" class="aicl-tool" :data-status="part.status" :open="part.status === 'error'">
              <summary><span class="aicl-dot" />{{ toolLabel(part) }}</summary>
              <pre>{{ part.argsText ?? JSON.stringify(part.args, null, 2) }}</pre>
            </details>
            <div v-else-if="part.type === 'artifact'" class="aicl-artifact">
              <span class="aicl-artifact-kind">{{ part.kind }}</span>
              <span class="aicl-artifact-title">{{ part.title ?? part.artifactId }}</span>
              <span v-if="part.version != null" class="aicl-artifact-version">v{{ part.version }}</span>
            </div>
            <div v-else-if="part.type === 'error'" class="aicl-error" role="alert">{{ part.message }}</div>
            <div v-else-if="part.type === 'html'" v-html="part.html" />
          </template>
        </template>
        <div v-if="m.aborted" class="aicl-status">Stopped</div>
      </div>
    </template>
    <div v-if="state.status === 'submitted'" class="aicl-msg" data-role="assistant">
      <span class="aicl-pending"><span class="aicl-dot" data-status="running" />Thinking…</span>
    </div>
    <div v-if="state.status === 'error' && state.error" class="aicl-error" role="alert">
      <span>{{ state.error.message }}</span>
      <button v-if="state.error.retryable !== false" type="button" @click="chat.retry()">Retry</button>
    </div>
    <div ref="end" />
  </div>
</template>
