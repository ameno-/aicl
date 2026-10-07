import type { ComponentType } from 'react';
import { icons, Layers, type LucideProps } from 'lucide-react';

const pascal = (name: string) =>
  name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join('');

/** Resolves an applet's kebab-case lucide icon name; falls back to a generic glyph. */
export function AppletIcon({ name, ...props }: { name?: string } & LucideProps) {
  const Icon = (name && (icons as Record<string, ComponentType<LucideProps>>)[pascal(name)]) || Layers;
  return <Icon aria-hidden="true" {...props} />;
}
