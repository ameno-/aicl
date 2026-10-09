import { onScopeDispose, shallowRef, type ShallowRef } from 'vue';
import { createChat, type Chat, type ChatOptions, type ChatState } from './aicl-chat.js';

/** The chat store plus its state as a Vue ref. */
export function useChat(options: ChatOptions): { chat: Chat; state: ShallowRef<ChatState> } {
  const chat = createChat(options);
  const state = shallowRef(chat.getState());
  onScopeDispose(chat.subscribe((next) => (state.value = next)));
  return { chat, state };
}
