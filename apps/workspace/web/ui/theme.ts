import type { CSSProperties } from 'react';
import type { ThemeTokens } from '../../shared/ui-spec.ts';

const FONTS: Record<ThemeTokens['font'], string> = {
  system: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  inter: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, ui-serif, serif",
  mono: "ui-monospace, 'SF Mono', SFMono-Regular, 'JetBrains Mono', Menlo, monospace",
  rounded: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Varela Round', ui-sans-serif, system-ui, sans-serif",
};

const DENSITY: Record<ThemeTokens['density'], number> = { compact: 0.8, comfortable: 1, spacious: 1.3 };

/** Layout scale in px at density 1. */
export const SCALE = { none: 0, xs: 4, sm: 8, md: 12, lg: 20, xl: 32 } as const;

const mix = (a: string, pct: number, b: string) => `color-mix(in oklab, ${a} ${pct}%, ${b})`;

/** ThemeTokens → CSS custom properties for a screen root. Total: tolerates partial tokens. */
export function themeVars(t: ThemeTokens): CSSProperties {
  const dark = t.mode === 'dark';
  const d = DENSITY[t.density] ?? 1;
  const r = Number.isFinite(t.radius) ? Math.max(0, t.radius) : 10;
  const vars: Record<string, string | number> = {
    colorScheme: dark ? 'dark' : 'light',
    '--aicl-accent': t.accent,
    '--aicl-accent-fg': t.accentFg,
    '--aicl-accent-strong': mix(t.accent, 85, dark ? '#fff' : '#000'),
    '--aicl-accent-soft': mix(t.accent, 10, t.surface),
    '--aicl-bg': t.bg,
    '--aicl-surface': t.surface,
    '--aicl-surface-elevated': dark ? mix(t.surface, 92, '#fff') : t.surface,
    '--aicl-surface-inset': mix(t.text, 4, t.bg),
    '--aicl-surface-tint': mix(t.text, 6, t.bg),
    '--aicl-sidebar': t.sidebar,
    '--aicl-text': t.text,
    '--aicl-text-muted': t.textMuted,
    '--aicl-text-faint': mix(t.textMuted, 60, t.bg),
    '--aicl-border': t.border,
    '--aicl-border-strong': mix(t.text, 14, t.border),
    '--aicl-border-focus': mix(t.textMuted, 70, t.bg),
    '--aicl-ring': mix(t.textMuted, 70, t.bg),
    '--aicl-bubble-user': t.bubbleUser,
    '--aicl-code-bg': mix(t.text, 5, t.surface),
    '--aicl-code-fg': t.text,
    '--aicl-code-border': t.border,
    '--aicl-terminal-bg': dark ? '#0c0c0c' : '#18181b',
    '--aicl-radius-sm': `${Math.round(r * 0.6)}px`,
    '--aicl-radius-md': `${r}px`,
    '--aicl-radius-lg': `${Math.round(r * 1.4)}px`,
    '--aicl-radius-xl': `${Math.round(r * 2.2)}px`,
    '--aicl-font-sans': FONTS[t.font] ?? FONTS.system,
    '--aicl-space-1': `${Math.round(4 * d)}px`,
    '--aicl-space-2': `${Math.round(8 * d)}px`,
    '--aicl-space-3': `${Math.round(12 * d)}px`,
    '--aicl-space-4': `${Math.round(16 * d)}px`,
    '--aicl-space-5': `${Math.round(20 * d)}px`,
    '--aicl-space-6': `${Math.round(28 * d)}px`,
    '--aicl-space-7': `${Math.round(40 * d)}px`,
  };
  for (const [k, v] of Object.entries(SCALE)) vars[`--ui-s-${k}`] = `${Math.round(v * d)}px`;
  return vars as CSSProperties;
}
