/** "Open in app": from a surface card on the canvas to the same surface in the Agent tab's work panel (AICL-41). */
import { ExternalLink } from 'lucide-react';
import type { SurfaceKind } from '../../shared/surfaces.ts';
import { setPrefs } from '../app/prefs.ts';
import { navigate } from '../router.ts';
import { getActiveSessionId, setActiveSession } from '../sessionsApi.ts';
import { useSurface } from '../surfaces/index.tsx';

/** Which work-panel tab shows each kind of surface. */
const TAB: Partial<Record<SurfaceKind, string>> = { terminal: 'terminal', browser: 'browser', file: 'files', diff: 'changes', review: 'changes' };

export function openInApp(kind: SurfaceKind, sessionId?: string): void {
  const id = sessionId ?? getActiveSessionId();
  setActiveSession(id);
  setPrefs({ workTab: TAB[kind] ?? 'terminal', workPanelOpen: true });
  navigate({ tab: 'agent', sessionId: id });
}

export function OpenInAppButton({ kind, id }: { kind: SurfaceKind; id: string }) {
  const info = useSurface(kind, id);
  return (
    <button
      type="button"
      className="aicl-card__open"
      aria-label="Open in app"
      title="Open in the Agent tab"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => openInApp(kind, info?.sessionId)}
    >
      <ExternalLink size={11} aria-hidden="true" /> Open in app
    </button>
  );
}
