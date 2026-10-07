/**
 * The command menu (⌘K) and the app's global shortcuts:
 * ⌘K is CommandMenu's own hotkey. ⌘P open file, ⌘N new session, ⌘/ shortcuts, ⌘, settings, ⌘\ work panel, Esc stops a running turn.
 */
import { useEffect, useMemo } from 'react';
import { CommandMenu, type CommandItem } from '@aicl/fx';
import { KIT_IDS, KITS, type ProviderKit } from '../../shared/kits.ts';
import { setKit } from '../kits/index.tsx';
import { navigate } from '../router.ts';
import { MAIN_SESSION_ID } from '../../shared/runtime.ts';
import { sendToSession, setActiveSession, useActiveSessionId, useSessionChat, useSessions } from '../sessionsApi.ts';
import { useModels, setSessionModel } from './models.ts';
import { getOverlay, setOverlay, useOverlay } from './overlays.ts';
import { getPrefs, setPrefs, toggledTheme, usePrefs } from './prefs.ts';
import { openSession, startSession } from './Sessions.tsx';
import { openFilePicker } from '../files/index.ts';
import { WORKFLOWS } from '../swarm/workflows.ts';

/** Global keyboard handling; renders nothing. */
export function useAppHotkeys(kit: ProviderKit): void {
  const activeId = useActiveSessionId();
  const chat = useSessionChat(activeId);
  const busy = chat.isBusy;
  const stop = chat.stop;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        void startSession();
      } else if (mod && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        openFilePicker();
      } else if (mod && e.key === '/') {
        e.preventDefault();
        setOverlay(getOverlay() === 'shortcuts' ? null : 'shortcuts');
      } else if (mod && e.key === ',') {
        e.preventDefault();
        setOverlay('settings');
      } else if (mod && e.key === '\\') {
        e.preventDefault();
        setPrefs({ workPanelOpen: !getPrefs().workPanelOpen });
      } else if (e.key === 'Escape' && busy && !e.defaultPrevented && getOverlay() === null) {
        // Dialogs and menus handle (and prevent) their own Escape first.
        stop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, stop, kit.id]);
}

export function CommandPalette({ kit, prefersDark }: { kit: ProviderKit; prefersDark: boolean }) {
  const overlay = useOverlay();
  const sessions = useSessions();
  const activeId = useActiveSessionId();
  const { models } = useModels();
  const prefs = usePrefs();
  const s = kit.vocabulary.sessions.toLowerCase().replace(/s$/, '');

  const items = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      { id: 'new', group: 'Actions', label: kit.vocabulary.newSession, shortcut: ['cmd', 'N'], onSelect: () => void startSession() },
      { id: 'open-file', group: 'Actions', label: 'Open file…', shortcut: ['cmd', 'P'], onSelect: openFilePicker },
      { id: 'panel', group: 'Actions', label: prefs.workPanelOpen ? 'Hide work panel' : 'Show work panel', shortcut: ['cmd', '\\'], onSelect: () => setPrefs({ workPanelOpen: !prefs.workPanelOpen }) },
      { id: 'sidebar', group: 'Actions', label: prefs.sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar', onSelect: () => setPrefs({ sidebarCollapsed: !prefs.sidebarCollapsed }) },
      { id: 'theme', group: 'Actions', label: 'Toggle light/dark theme', onSelect: () => setPrefs({ theme: toggledTheme(kit, prefs.theme, prefersDark) }) },
      { id: 'settings', group: 'Actions', label: 'Open settings', shortcut: ['cmd', ','], onSelect: () => setOverlay('settings') },
      { id: 'shortcuts', group: 'Actions', label: 'Keyboard shortcuts', shortcut: ['cmd', '/'], onSelect: () => setOverlay('shortcuts') },
      { id: 'go-agent', group: 'Go to', label: 'Go to Agent', onSelect: () => navigate({ tab: 'agent' }) },
      { id: 'go-canvas', group: 'Go to', label: 'Go to Canvas', onSelect: () => navigate({ tab: 'canvas' }) },
      { id: 'go-agents', group: 'Go to', label: 'Go to agents', onSelect: () => navigate({ tab: 'agents' }) },
      ...WORKFLOWS.map((w) => ({ id: `wf-${w.id}`, group: 'Workflows', label: w.label, onSelect: () => (navigate({ tab: 'agents' }), sendToSession(w.prompt, MAIN_SESSION_ID)) })),
      { id: 'go-overview', group: 'Go to', label: 'Go to Overview', onSelect: () => navigate({ tab: 'overview' }) },
      ...KIT_IDS.map((id) => ({ id: `kit-${id}`, group: 'Kit', label: `Switch kit: ${KITS[id].label}${id === kit.id ? ' (current)' : ''}`, onSelect: () => setKit(id) })),
      ...sessions.map((x) => ({ id: `s-${x.id}`, group: kit.vocabulary.sessions, label: `Open ${s}: ${x.title}`, onSelect: () => (setActiveSession(x.id), openSession(x.id)) })),
      ...models.map((m) => ({ id: `m-${m.id}`, group: 'Model', label: `Switch model: ${m.label}`, onSelect: () => void setSessionModel(activeId, m.id) })),
    ];
    return list;
  }, [kit, prefs, prefersDark, sessions, models, activeId, s]);

  return <CommandMenu open={overlay === 'palette'} onOpenChange={(o) => setOverlay(o ? 'palette' : null)} items={items} placeholder={`Search commands, ${kit.vocabulary.sessions.toLowerCase()}, kits, models…`} />;
}

