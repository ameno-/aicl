/** Settings dialog (appearance, model, motion) and the shortcuts help. */
import { Dialog, SegmentedControl, Switch } from '@aicl/react';
import { Kbd } from '@aicl/fx';
import type { ProviderKit } from '../../shared/kits.ts';
import { useActiveSessionId } from '../sessionsApi.ts';
import { useSessionModel } from './models.ts';
import { setOverlay, useOverlay } from './overlays.ts';
import { setPrefs, usePrefs, type ThemeMode } from './prefs.ts';

export function SettingsDialog({ kit }: { kit: ProviderKit }) {
  const open = useOverlay() === 'settings';
  const prefs = usePrefs();
  const sessionId = useActiveSessionId();
  const model = useSessionModel(sessionId);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && setOverlay(null)} size="md">
      <Dialog.Title>Settings</Dialog.Title>
      <div className="settings" data-aicl-settings="">
        <section className="settings-section">
          <h3>Appearance</h3>
          <SegmentedControl<ThemeMode>
            ariaLabel="Appearance"
            value={prefs.theme}
            onValueChange={(theme) => setPrefs({ theme })}
            options={[
              { value: 'kit', label: 'Default' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
          />
        </section>
        <section className="settings-section">
          <h3>Model</h3>
          <p className="settings-hint">For the current {kit.vocabulary.sessions.toLowerCase().replace(/s$/, '')}. It is remembered.</p>
          <select
            className="settings-select"
            aria-label="Model"
            value={model.value}
            disabled={model.busy || model.options.length === 0}
            onChange={(e) => void model.set(e.target.value)}
          >
            {model.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} · {o.provider}
              </option>
            ))}
          </select>
        </section>
        <section className="settings-section settings-row">
          <div>
            <h3>Reduce motion</h3>
            <p className="settings-hint">Skip springs and slide-ins. Follows your OS setting when off.</p>
          </div>
          <Switch checked={prefs.reducedMotion} onCheckedChange={(reducedMotion) => setPrefs({ reducedMotion })} label="Reduce motion" />
        </section>
      </div>
      <Dialog.Close />
    </Dialog>
  );
}

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? 'cmd' : 'ctrl';

export const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: [MOD, 'K'], label: 'Command menu' },
  { keys: [MOD, 'N'], label: 'New session' },
  { keys: [MOD, '/'], label: 'Keyboard shortcuts' },
  { keys: [MOD, '\\'], label: 'Show or hide the work panel' },
  { keys: [MOD, ','], label: 'Settings' },
  { keys: ['esc'], label: 'Stop the running turn' },
  { keys: ['enter'], label: 'Send message' },
  { keys: ['shift', 'enter'], label: 'New line' },
];

export function ShortcutsDialog() {
  const open = useOverlay() === 'shortcuts';
  return (
    <Dialog open={open} onOpenChange={(o) => !o && setOverlay(null)} size="sm">
      <Dialog.Title>Keyboard shortcuts</Dialog.Title>
      <dl className="shortcuts" data-aicl-shortcuts="">
        {SHORTCUTS.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>
              <Kbd keys={s.keys} />
            </dd>
          </div>
        ))}
      </dl>
      <Dialog.Close />
    </Dialog>
  );
}
