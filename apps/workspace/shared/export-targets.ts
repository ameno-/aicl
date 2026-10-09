/** Export targets for a designed screen (server/export/targets.ts builds them; the screen card lists them). */
export const EXPORT_TARGETS = ['react', 'react-tailwind', 'vue', 'svelte', 'html', 'json'] as const;
export type ExportTarget = (typeof EXPORT_TARGETS)[number];

export const TARGET_LABELS: Record<ExportTarget, string> = {
  react: 'React + TypeScript (Vite)',
  'react-tailwind': 'React + Tailwind CSS (Vite)',
  vue: 'Vue 3 (Vite)',
  svelte: 'Svelte 5 (Vite)',
  html: 'Plain HTML + JavaScript (no build)',
  json: 'JSON (screen spec, theme, messages)',
};
