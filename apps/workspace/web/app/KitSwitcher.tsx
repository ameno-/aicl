/** Top-bar kit switcher: a small menu of the five kits; choosing one restyles the whole app. */
import { useEffect, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { KIT_IDS, KITS, type ProviderKit } from '../../shared/kits.ts';
import { setKit } from '../kits/index.tsx';

export function KitSwitcher({ kit }: { kit: ProviderKit }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
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
    <div className="kit-switcher" ref={root}>
      <button type="button" className="kit-switcher-btn" aria-haspopup="menu" aria-expanded={open} aria-label="Switch kit" title="Switch kit" onClick={() => setOpen((o) => !o)}>
        <Palette size={14} aria-hidden="true" />
        <span>{kit.label}</span>
      </button>
      {open ? (
        <div className="kit-switcher-menu" role="menu" aria-label="Kits">
          {KIT_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={id === kit.id}
              onClick={() => {
                setKit(id);
                setOpen(false);
              }}
            >
              <span className="kit-menu-swatch" aria-hidden="true" style={{ background: KITS[id].tokens.accent }} />
              <span className="kit-menu-text">
                <span>{KITS[id].label}</span>
                <small>{KITS[id].vocabulary.sessions}</small>
              </span>
              {id === kit.id ? <Check size={14} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
