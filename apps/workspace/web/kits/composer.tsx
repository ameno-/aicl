/**
 * KitComposer: PromptComposer configured per provider kit (mode chip, integration
 * chips, progress chip, attach label, context chips, hero vs bottom, model picker).
 * Adds the data-aicl hooks the e2e suites rely on to the fx elements.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { PromptComposer, type PromptChip } from '@aicl/fx';
import { Plus } from 'lucide-react';
import './kits.css';
import type { ProviderKit } from '../../shared/kits.ts';

export interface KitComposerProps {
  kit: ProviderKit;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  onStop?: () => void;
  status: 'ready' | 'streaming' | 'error';
  variant: 'bottom' | 'hero';
  /** Live plan progress for kits with composer.progressChip. */
  progress?: { label: string; done: number; total: number };
  /** Context chips (kits with composer.contextChips), e.g. workspace name, model. */
  chips?: string[];
  /** The app's model picker, rendered where the kit puts it. */
  model?: { value: string; options: Array<{ id: string; label: string; description?: string }>; onChange: (id: string) => void };
  autoFocus?: boolean;
  /** Called by the attach control (icon, or the kit's "Attach" label). Kits with an attach label show it even without a handler. */
  onAttach?: () => void;
  /** Placeholder override (the app may know better than the kit vocabulary). */
  placeholder?: string;
  /** Selected mode id (kits with modes); uncontrolled when omitted. */
  mode?: string;
  onModeChange?: (id: string) => void;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function KitComposer({
  kit,
  value,
  onChange,
  onSubmit,
  onStop,
  status,
  variant,
  progress,
  chips,
  model,
  autoFocus,
  onAttach,
  placeholder,
  mode,
  onModeChange,
}: KitComposerProps) {
  const root = useRef<HTMLDivElement>(null);
  const [ownMode, setOwnMode] = useState(kit.composer.modes[0] ? slug(kit.composer.modes[0]) : '');
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  // The fx composer owns its elements; tag them with the stable data-aicl hooks.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const input = el.querySelector('textarea');
    input?.setAttribute('data-aicl', 'composer-input');
    if (autoFocus) input?.focus();
  }, [autoFocus, variant]);
  useLayoutEffect(() => {
    const btn = root.current?.querySelector<HTMLElement>('[data-fx-part="send"], [data-fx-part="stop"]');
    if (!btn) return;
    btn.setAttribute('data-aicl', 'composer-submit');
    btn.setAttribute('data-role', status === 'streaming' ? 'stop' : 'send');
  }, [status, value]);

  const modes = kit.composer.modes.map((label) => ({ id: slug(label), label }));
  const allChips: PromptChip[] = [];
  if (kit.composer.contextChips) for (const label of chips ?? []) allChips.push({ id: `ctx-${label}`, label });
  for (const name of kit.composer.integrations) {
    const on = enabled[name] ?? true;
    allChips.push({
      id: `int-${name}`,
      label: name,
      onClick: () => setEnabled((e) => ({ ...e, [name]: !on })),
      icon: <span aria-hidden="true" className={on ? 'size-1.5 rounded-full bg-success' : 'size-1.5 rounded-full bg-faint'} />,
    });
  }
  if (kit.composer.attachLabel) {
    allChips.unshift({
      id: 'attach',
      label: kit.composer.attachLabel,
      icon: <Plus size={12} aria-hidden="true" />,
      onClick: onAttach ?? (() => undefined),
    });
  }

  return (
    <div ref={root} data-aicl="composer" data-state={status} data-kit-composer={kit.id} data-variant={variant} className="w-full">
      <PromptComposer
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        {...(onStop ? { onStop } : {})}
        status={status}
        variant={variant}
        placeholder={placeholder ?? kit.vocabulary.placeholder}
        {...(onAttach && !kit.composer.attachLabel ? { onAttach } : {})}
        {...(modes.length ? { modes, mode: mode ?? ownMode, onModeChange: onModeChange ?? setOwnMode } : {})}
        {...(model ? { models: model.options, model: model.value, onModelChange: model.onChange } : {})}
        {...(kit.composer.progressChip && progress ? { progress } : {})}
        chips={allChips}
      />
    </div>
  );
}
