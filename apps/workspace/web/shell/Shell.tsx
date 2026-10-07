import { useEffect, useState } from 'react';
import { ChatPanel } from '../ChatPanel.tsx';
import { ConnectionBanner } from '../ConnectionBanner.tsx';
import { Scratchpad } from '../Scratchpad.tsx';
import { onServerEvent } from '../events.ts';
import { navigate, useRoute } from '../router.ts';
import { useApplets, useWorkspaceConfig } from '../applets/index.tsx';
import { AgentPage } from './AgentPage.tsx';
import { OverviewPage } from './OverviewPage.tsx';
import { TopBar } from './TopBar.tsx';
import { ViewPage } from './ViewPage.tsx';
import './shell.css';

const DOCK_KEY = 'aicl.dock.open';

function useDockOpen(): [boolean, () => void] {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(DOCK_KEY) !== '0';
    } catch {
      return true;
    }
  });
  return [
    open,
    () =>
      setOpen((o) => {
        try {
          localStorage.setItem(DOCK_KEY, o ? '0' : '1');
        } catch {
          // storage unavailable: the toggle still works for this page load
        }
        return !o;
      }),
  ];
}

export function Shell() {
  const route = useRoute();
  const applets = useApplets();
  const [config] = useWorkspaceConfig();
  const [dockOpen, toggleDock] = useDockOpen();

  useEffect(() => onServerEvent('navigate', (e) => navigate(e.address)), []);

  const views = applets.filter((a) => a.kind === 'view');
  const dockVisible = route.tab !== 'agent';
  const canvasActive = route.tab === 'canvas';

  return (
    <div className="shell" data-aicl-root="" data-route={route.tab}>
      <ConnectionBanner />
      <TopBar name={config.name} route={route} views={views} dockVisible={dockVisible} dockOpen={dockOpen} onToggleDock={toggleDock} />
      <div className="shell-body">
        <div className="shell-stage">
          {/* Always mounted: agent canvas ops run in this editor. */}
          <div className={canvasActive ? 'shell-pane' : 'shell-pane shell-pane-hidden'} aria-hidden={!canvasActive} data-pane="canvas">
            <main className="canvas" aria-label="Scratchpad">
              <Scratchpad />
            </main>
          </div>
          {route.tab === 'agent' ? (
            <div className="shell-pane" data-pane="agent">
              <AgentPage routeSessionId={route.sessionId} />
            </div>
          ) : null}
          {route.tab === 'overview' ? (
            <div className="shell-pane" data-pane="overview">
              <OverviewPage />
            </div>
          ) : null}
          {route.tab === 'view' ? (
            <div className="shell-pane" data-pane="view">
              <ViewPage id={route.appletId} />
            </div>
          ) : null}
        </div>
        <div className="shell-dock" data-open={dockVisible && dockOpen} aria-hidden={!(dockVisible && dockOpen)}>
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
