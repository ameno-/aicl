import { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { ToastRegion } from '@aicl/react';
import { ChatPanel } from '../ChatPanel.tsx';
import { ConnectionBanner } from '../ConnectionBanner.tsx';
import { Scratchpad } from '../Scratchpad.tsx';
import { toasts } from '../chatStore.ts';
import { KitScope, useKit } from '../kits/index.tsx';
import { FilePickerHost } from '../files/index.ts';
import { CommandPalette, useAppHotkeys } from '../app/Palette.tsx';
import { SettingsDialog, ShortcutsDialog } from '../app/Settings.tsx';
import { themeVars } from '../ui/theme.ts';
import { usePrefs, usePrefersDark, withTheme } from '../app/prefs.ts';
import { onServerEvent } from '../events.ts';
import { navigate, useFocusMode, useRoute } from '../router.ts';
import { CanvasToolbar } from '../workspace/CanvasToolbar.tsx';
import { FloatingChat } from '../workspace/FloatingChat.tsx';
import '../workspace/workspace.css';
import { useApplets, useWorkspaceConfig } from '../applets/index.tsx';
import { AgentPage } from './AgentPage.tsx';
import { OverviewPage } from './OverviewPage.tsx';
import { AgentsView } from '../swarm/AgentsView.tsx';
import { TopBar } from './TopBar.tsx';
import { ViewPage } from './ViewPage.tsx';
import './shell.css';
import '../app/app.css';

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
  const baseKit = useKit();
  const prefs = usePrefs();
  const prefersDark = usePrefersDark();
  const kit = withTheme(baseKit, prefs.theme, prefersDark);
  useAppHotkeys(kit);
  // KitScope themes the app subtree; dialogs and toasts render in portals under <body>, so the page root carries the tokens too.
  useEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(themeVars(kit.tokens))) {
      if (name.startsWith('--')) root.style.setProperty(name, String(value));
    }
    root.style.background = kit.tokens.bg;
    root.style.colorScheme = kit.tokens.mode;
    root.dataset['theme'] = kit.tokens.mode;
  }, [kit.tokens]);
  return (
    <MotionConfig reducedMotion={prefs.reducedMotion ? 'always' : 'user'}>
      <KitScope kit={kit} className="app-root">
        <ShellBody kit={kit} prefersDark={prefersDark} />
      </KitScope>
    </MotionConfig>
  );
}

function ShellBody({ kit, prefersDark }: { kit: ReturnType<typeof withTheme>; prefersDark: boolean }) {
  const route = useRoute();
  const applets = useApplets();
  const [config] = useWorkspaceConfig();
  const [dockOpen, toggleDock] = useDockOpen();

  useEffect(() => onServerEvent('navigate', (e) => navigate(e.address)), []);

  const views = applets.filter((a) => a.kind === 'view');
  // The copilot belongs to the canvas: other pages have their own single input (AICL-52).
  const dockVisible = route.tab === 'canvas';
  const canvasActive = route.tab === 'canvas';
  // Canvas-first mode: the canvas fills the window and the chat floats over it.
  const focusMode = useFocusMode();
  const focus = canvasActive && focusMode;

  return (
    <div className="shell" data-aicl-root="" data-route={route.tab} data-kit-nav={kit.layout.nav} data-focus={focus}>
      <ConnectionBanner />
      {focus ? null : <TopBar kit={kit} name={config.name} route={route} views={views} dockVisible={dockVisible} dockOpen={dockOpen} onToggleDock={toggleDock} />}
      <div className="shell-body">
        <div className="shell-stage">
          {/* Always mounted: agent canvas ops run in this editor. */}
          <div className={canvasActive ? 'shell-pane' : 'shell-pane shell-pane-hidden'} aria-hidden={!canvasActive} data-pane="canvas">
            <main className="canvas" aria-label="Scratchpad">
              <Scratchpad active={canvasActive} />
            </main>
            {canvasActive ? <CanvasToolbar /> : null}
          </div>
          {route.tab === 'agent' ? (
            <div className="shell-pane" data-pane="agent">
              <AgentPage routeSessionId={route.sessionId} kit={kit} />
            </div>
          ) : null}
          {route.tab === 'agents' ? (
            <div className="shell-pane" data-pane="agents">
              <AgentsView kit={kit} />
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
        {focus ? (
          <FloatingChat kit={kit} />
        ) : (
          <div className="shell-dock" data-open={dockVisible && dockOpen} aria-hidden={!(dockVisible && dockOpen)}>
            <ChatPanel kit={kit} />
          </div>
        )}
      </div>
      <CommandPalette kit={kit} prefersDark={prefersDark} />
      <FilePickerHost />
      <SettingsDialog kit={kit} />
      <ShortcutsDialog />
      <ToastRegion queue={toasts} placement="top-center" />
    </div>
  );
}
