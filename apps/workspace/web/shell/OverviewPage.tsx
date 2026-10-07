import { ArrowLeft, ArrowRight, Ellipsis, X } from 'lucide-react';
import { useState } from 'react';
import { SuggestionChips } from '@aicl/react';
import type { AppletInfo } from '../../shared/runtime.ts';
import { AppletHost, useApplets, useWorkspaceConfig } from '../applets/index.tsx';
import { sendToSession } from '../sessionsApi.ts';
import { AppletIcon } from './icons.tsx';

const clamp = (n: number) => Math.min(4, Math.max(1, Math.round(n) || 1));

function Card({ applet, index, count, onMove, onRemove }: { applet: AppletInfo; index: number; count: number; onMove: (d: -1 | 1) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="ov-card" style={{ gridColumn: `span ${clamp(applet.colSpan)}`, gridRow: `span ${clamp(applet.rowSpan)}` }} data-applet={applet.id}>
      <header className="ov-card-header">
        <AppletIcon name={applet.icon} size={14} />
        <span className="ov-card-title">{applet.title}</span>
        <button type="button" className="icon-button ov-menu-btn" aria-label={`${applet.title} options`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Ellipsis size={14} aria-hidden="true" />
        </button>
        {open ? (
          <div className="ov-menu" role="menu" onMouseLeave={() => setOpen(false)}>
            <button type="button" role="menuitem" disabled={index === 0} onClick={() => (setOpen(false), onMove(-1))}>
              <ArrowLeft size={14} aria-hidden="true" /> Move earlier
            </button>
            <button type="button" role="menuitem" disabled={index === count - 1} onClick={() => (setOpen(false), onMove(1))}>
              <ArrowRight size={14} aria-hidden="true" /> Move later
            </button>
            <button type="button" role="menuitem" onClick={() => (setOpen(false), onRemove())}>
              <X size={14} aria-hidden="true" /> Remove from overview
            </button>
          </div>
        ) : null}
      </header>
      <div className="ov-card-body">
        <AppletHost id={applet.id} />
      </div>
    </section>
  );
}

export function OverviewPage() {
  const applets = useApplets();
  const [config, setConfig] = useWorkspaceConfig();
  const shown = config.overview.map((id) => applets.find((a) => a.id === id && a.kind === 'widget')).filter((a): a is AppletInfo => !!a);

  if (shown.length === 0) {
    return (
      <div className="shell-empty">
        <p className="shell-empty-title">No widgets on the overview yet</p>
        <p className="shell-empty-hint">Widgets are small live cards the agent writes for you: stats, lists, trackers. They show up here as a grid.</p>
        <SuggestionChips
          behavior="send"
          suggestions={[{ id: 'build', label: 'Ask the agent to build one', prompt: 'Build me a widget for the Overview that shows ' }]}
          onSelect={(s) => sendToSession(s.prompt ?? s.label)}
        />
      </div>
    );
  }

  const move = (id: string, d: -1 | 1) => {
    const ids = [...config.overview];
    const i = ids.indexOf(id);
    const a = ids[i];
    const b = ids[i + d];
    if (a === undefined || b === undefined) return;
    ids[i] = b;
    ids[i + d] = a;
    setConfig({ ...config, overview: ids });
  };

  return (
    <div className="ov-scroll">
      <div className="ov-grid">
        {shown.map((a, i) => (
          <Card
            key={a.id}
            applet={a}
            index={i}
            count={shown.length}
            onMove={(d) => move(a.id, d)}
            onRemove={() => setConfig({ ...config, overview: config.overview.filter((id) => id !== a.id) })}
          />
        ))}
      </div>
    </div>
  );
}
