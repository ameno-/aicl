/**
 * A small pill, top-centre, while the page cannot reach the server or is
 * reloading a conversation whose turn was cut off. It never takes pointer
 * events, so it cannot cover a control.
 */
import { useConnectionState } from './events.ts';
import { useChatRecovery } from './sessionsApi.ts';

export function ConnectionBanner() {
  const connection = useConnectionState();
  const recovery = useChatRecovery();
  const text =
    connection === 'offline'
      ? 'Offline'
      : connection === 'reconnecting'
        ? 'Reconnecting…'
        : recovery === 'lost'
          ? 'Connection lost — reloading conversation'
          : recovery === 'busy'
            ? 'The agent is still working — waiting for it to finish'
            : null;
  if (!text) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-aicl-connection={connection === 'connected' ? 'recovering' : connection}
      style={{
        position: 'fixed',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        pointerEvents: 'none',
        padding: '3px 12px',
        borderRadius: 999,
        fontSize: 12,
        lineHeight: 1.5,
        background: 'var(--aicl-surface, #fff)',
        color: 'var(--aicl-text, #222)',
        border: '1px solid var(--aicl-border-strong, #bbb)',
        boxShadow: '0 1px 4px #0002',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
}
