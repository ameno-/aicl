/**
 * The Agent tab: a complete chat product laid out by the active kit —
 * sessions sidebar (or the top bar's menu), the conversation column, and the
 * work panel beside it. Conversations render only through the kit contract.
 */
import { useEffect, useRef } from 'react';
import { StatusIsland } from '@aicl/fx';
import { PanelLeftOpen, PanelRight } from 'lucide-react';
import type { ProviderKit } from '../../shared/kits.ts';
import { Conversation } from '../app/Conversation.tsx';
import { setPrefs, usePrefs } from '../app/prefs.ts';
import { SessionsMenu, SessionsSidebar, sessionTitle } from '../app/Sessions.tsx';
import { WorkPanel } from '../app/WorkPanel.tsx';
import { setActiveSession, useActiveSessionId, useSessionChat, useSessions } from '../sessionsApi.ts';

export function AgentPage({ routeSessionId, kit }: { routeSessionId?: string; kit: ProviderKit }) {
  const sessions = useSessions();
  const activeId = useActiveSessionId();
  const chat = useSessionChat(activeId);
  const prefs = usePrefs();
  const current = sessions.find((s) => s.id === activeId);
  const panelType = kit.layout.workPanel;
  const sidebar = kit.layout.nav === 'sidebar';
  const showSidebar = sidebar && !prefs.sidebarCollapsed;
  // A new, empty conversation shows the hero alone; the panel belongs to a conversation with work in it.
  const hasWork = chat.messages.length > 0;
  const panelVisible = prefs.workPanelOpen && hasWork && panelType !== 'none';

  useEffect(() => {
    if (routeSessionId) setActiveSession(routeSessionId);
  }, [routeSessionId]);

  // The panel opens by itself when the agent starts working.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (chat.isBusy && !wasBusy.current && panelType !== 'none') setPrefs({ workPanelOpen: true });
    wasBusy.current = chat.isBusy;
  }, [chat.isBusy, panelType]);

  return (
    <div className="agent-page" data-panel-type={panelType} data-panel-open={panelVisible || undefined} data-sidebar={showSidebar || undefined}>
      {showSidebar ? <SessionsSidebar kit={kit} /> : null}
      <main className="agent-thread" aria-label="Conversation">
        <header className="agent-thread-header">
          {sidebar && prefs.sidebarCollapsed ? (
            <button type="button" className="icon-button" aria-label="Show sidebar" title="Show sidebar" onClick={() => setPrefs({ sidebarCollapsed: false })}>
              <PanelLeftOpen size={16} aria-hidden="true" />
            </button>
          ) : null}
          {/* Narrow screens hide the sidebar: the same list as a menu. */}
          {sidebar ? <span className="agent-narrow-menu"><SessionsMenu kit={kit} /></span> : null}
          <h1 className={sidebar ? undefined : 'sr-only'}>{current ? sessionTitle(current, kit) : kit.vocabulary.newSession}</h1>
          {chat.isBusy ? <StatusIsland status="working" label={`${kit.vocabulary.agent} is working`} /> : null}
          <span className="shell-spacer" />
          {panelType !== 'none' && hasWork ? (
            <button
              type="button"
              className="icon-button"
              aria-label={prefs.workPanelOpen ? 'Hide work panel' : 'Show work panel'}
              aria-pressed={prefs.workPanelOpen}
              title={`${prefs.workPanelOpen ? 'Hide' : 'Show'} work panel`}
              onClick={() => setPrefs({ workPanelOpen: !prefs.workPanelOpen })}
            >
              <PanelRight size={16} aria-hidden="true" />
            </button>
          ) : null}
        </header>
        <Conversation key={activeId} sessionId={activeId} kit={kit} />
      </main>
      <WorkPanel kit={kit} sessionId={activeId} busy={chat.isBusy} visible={panelVisible} />
    </div>
  );
}
