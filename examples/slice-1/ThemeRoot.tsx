import { useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'aicl:theme';

function read(): Theme {
  if (typeof window === 'undefined') return 'system';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  return 'system';
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function ThemeRoot({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(read);

  useEffect(() => {
    apply(theme);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
  }, [theme]);

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
      </div>
    </>
  );
}
