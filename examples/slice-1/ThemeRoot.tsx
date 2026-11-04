import { useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
type Skin = 'default' | 'looseleaf';

const THEME_KEY = 'aicl:theme';
const SKIN_KEY = 'aicl:skin';

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const saved = window.localStorage.getItem(key);
  return allowed.includes(saved as T) ? (saved as T) : fallback;
}

function apply(theme: Theme, skin: Skin) {
  const root = document.documentElement;

  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }

  // A skin and the mode live on the same element, so a skin can resolve the
  // mode itself.
  if (skin === 'default') {
    root.removeAttribute('data-aicl-theme');
  } else {
    root.setAttribute('data-aicl-theme', skin);
  }
}

export function ThemeRoot({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => read(THEME_KEY, ['light', 'dark', 'system'], 'system'));
  const [skin, setSkin] = useState<Skin>(() => read(SKIN_KEY, ['default', 'looseleaf'], 'default'));

  useEffect(() => {
    apply(theme, skin);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, theme);
      window.localStorage.setItem(SKIN_KEY, skin);
    }
  }, [theme, skin]);

  useEffect(() => {
    const onSkin = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (next === 'default' || next === 'looseleaf') setSkin(next);
    };
    const onTheme = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (next === 'light' || next === 'dark' || next === 'system') setTheme(next);
    };
    window.addEventListener('aicl:skin', onSkin);
    window.addEventListener('aicl:theme', onTheme);
    return () => {
      window.removeEventListener('aicl:skin', onSkin);
      window.removeEventListener('aicl:theme', onTheme);
    };
  }, []);

  return (
    <>
      {children}
      <div className="theme-switcher" role="group" aria-label="Theme">
        {(['light', 'system', 'dark'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={theme === value}
            onClick={() => setTheme(value)}
            aria-label={value === 'system' ? 'System theme' : `${value} theme`}
          >
            {value === 'light' ? 'Light' : value === 'dark' ? 'Dark' : 'System'}
          </button>
        ))}
        <span className="theme-switcher-divider" aria-hidden="true" />
        {(['default', 'looseleaf'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={skin === value}
            onClick={() => setSkin(value)}
            aria-label={`${value} skin`}
          >
            {value === 'default' ? 'Default' : 'LooseLeaf'}
          </button>
        ))}
      </div>
    </>
  );
}
