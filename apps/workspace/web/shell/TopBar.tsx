import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Command, LayoutGrid, MessageSquare, Network, PanelRight, PenTool, Settings } from 'lucide-react';
import type { ProviderKit } from '../../shared/kits.ts';
import type { AppletInfo, WorkspaceRoute } from '../../shared/runtime.ts';
import { setOverlay } from '../app/overlays.ts';
import { SessionsMenu, sessionTitle } from '../app/Sessions.tsx';
import { navigate } from '../router.ts';
import { useActiveSessionId, useSessions } from '../sessionsApi.ts';
import { AppletIcon } from './icons.tsx';

interface Props {
  kit: ProviderKit;
  name: string;
  route: WorkspaceRoute;
  views: AppletInfo[];
  dockVisible: boolean;
  dockOpen: boolean;
  onToggleDock: () => void;
}

/** Cofounder: the workspace switcher lives in the top bar, not a sidebar. */
function WorkspaceSwitcher({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState('');
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    void fetch('/api/info')
      .then((r) => r.json() as Promise<{ workspace?: string }>)
      .then((i) => setPath(i.workspace ?? ''))
      .catch(() => undefined);
    const away = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false));
    window.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc, true);
    return () => {
      window.removeEventListener('mousedown', away);
      window.removeEventListener('keydown', esc, true);
    };
  }, [open]);
  return (
    <div className="ws-switcher" ref={root}>
      <button type="button" className="ws-switcher-btn" aria-haspopup="menu" aria-expanded={open} aria-label="Workspace" onClick={() => setOpen((o) => !o)}>
        <span className="ws-avatar" aria-hidden="true">
          {name.slice(0, 2).toUpperCase()}
        </span>
        <span className="shell-name" title={name}>
          {name}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div className="ws-menu" role="menu" aria-label="Workspaces">
          <button type="button" role="menuitemradio" aria-checked="true" onClick={() => setOpen(false)}>
            <span className="ws-avatar" aria-hidden="true">
              {name.slice(0, 2).toUpperCase()}
            </span>
            <span className="kit-menu-text">
              <span>{name}</span>
              {path ? <small title={path}>{path}</small> : null}
            </span>
            <Check size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function TopBar({ kit, name, route, views, dockVisible, dockOpen, onToggleDock }: Props) {
  const sessions = useSessions();
  const activeId = useActiveSessionId();
  const active = sessions.find((s) => s.id === activeId);
  const topNav = kit.layout.nav === 'topbar';
  const tab = (key: string, label: string, icon: ReactNode, selected: boolean, go: () => void) => (
    <button key={key} type="button" role="tab" className="shell-tab" aria-selected={selected} data-tab={key} onClick={go}>
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <header className="shell-topbar" data-nav={kit.layout.nav}>
      {topNav ? (
        <>
          <WorkspaceSwitcher name={name} />
          <nav className="shell-crumbs" aria-label="Breadcrumb">
            <span>{kit.vocabulary.sessions}</span>
            {route.tab === 'agent' && active ? (
              <>
                <span aria-hidden="true">/</span>
                <span className="shell-crumb-current" aria-current="page">
                  {sessionTitle(active, kit)}
                </span>
              </>
            ) : null}
          </nav>
        </>
      ) : (
        <span className="shell-name" title={name}>
          {name}
        </span>
      )}
      <nav className="shell-tabs" role="tablist" aria-label="Workspace tabs">
        {tab('agent', 'Agent', <MessageSquare size={14} aria-hidden="true" />, route.tab === 'agent', () => navigate({ tab: 'agent' }))}
        {tab('canvas', 'Canvas', <PenTool size={14} aria-hidden="true" />, route.tab === 'canvas', () => navigate({ tab: 'canvas' }))}
        {tab('agents', 'Agents', <Network size={14} aria-hidden="true" />, route.tab === 'agents', () => navigate({ tab: 'agents' }))}
        {tab('overview', 'Overview', <LayoutGrid size={14} aria-hidden="true" />, route.tab === 'overview', () => navigate({ tab: 'overview' }))}
        {views.map((v) =>
          tab(`view:${v.id}`, v.title, <AppletIcon name={v.icon} size={14} />, route.tab === 'view' && route.appletId === v.id, () =>
            navigate({ tab: 'view', appletId: v.id }),
          ),
        )}
      </nav>
      <span className="shell-spacer" />
      {/* The Cofounder Tasks overlay: quick access to chats wherever the sidebar is not (AICL-44). */}
      {topNav ? (route.tab === 'agent' ? <SessionsMenu kit={kit} compact /> : null) : route.tab !== 'agent' ? <SessionsMenu kit={kit} compact /> : null}
      <button type="button" className="shell-cmdk" aria-label="Open command menu" title="Command menu" onClick={() => setOverlay('palette')}>
        <Command size={13} aria-hidden="true" />
        <span>K</span>
      </button>
      <button type="button" className="icon-button" aria-label="Settings" title="Settings" onClick={() => setOverlay('settings')}>
        <Settings size={16} aria-hidden="true" />
      </button>
      {dockVisible ? (
        <button
          type="button"
          className="icon-button shell-dock-toggle"
          aria-label={dockOpen ? 'Hide copilot' : 'Show copilot'}
          aria-pressed={dockOpen}
          title={dockOpen ? 'Hide copilot' : 'Show copilot'}
          onClick={onToggleDock}
        >
          <PanelRight size={16} aria-hidden="true" />
        </button>
      ) : null}
    </header>
  );
}
