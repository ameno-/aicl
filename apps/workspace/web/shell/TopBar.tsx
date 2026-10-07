import type { ReactNode } from 'react';
import { LayoutGrid, MessageSquare, PanelRight, PenTool } from 'lucide-react';
import type { AppletInfo, WorkspaceRoute } from '../../shared/runtime.ts';
import { navigate } from '../router.ts';
import { AppletIcon } from './icons.tsx';

interface Props {
  name: string;
  route: WorkspaceRoute;
  views: AppletInfo[];
  dockVisible: boolean;
  dockOpen: boolean;
  onToggleDock: () => void;
}

export function TopBar({ name, route, views, dockVisible, dockOpen, onToggleDock }: Props) {
  const tab = (key: string, label: string, icon: ReactNode, active: boolean, go: () => void) => (
    <button key={key} type="button" role="tab" className="shell-tab" aria-selected={active} data-tab={key} onClick={go}>
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <header className="shell-topbar">
      <span className="shell-name" title={name}>
        {name}
      </span>
      <nav className="shell-tabs" role="tablist" aria-label="Workspace tabs">
        {tab('agent', 'Agent', <MessageSquare size={14} aria-hidden="true" />, route.tab === 'agent', () => navigate({ tab: 'agent' }))}
        {tab('canvas', 'Canvas', <PenTool size={14} aria-hidden="true" />, route.tab === 'canvas', () => navigate({ tab: 'canvas' }))}
        {tab('overview', 'Overview', <LayoutGrid size={14} aria-hidden="true" />, route.tab === 'overview', () => navigate({ tab: 'overview' }))}
        {views.map((v) =>
          tab(`view:${v.id}`, v.title, <AppletIcon name={v.icon} size={14} />, route.tab === 'view' && route.appletId === v.id, () =>
            navigate({ tab: 'view', appletId: v.id }),
          ),
        )}
      </nav>
      <span className="shell-spacer" />
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
