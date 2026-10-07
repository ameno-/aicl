/**
 * @aicl/fx: animated AI-chat components on AICL tokens.
 * Import '@aicl/fx/fx.css' once (through Tailwind v4) and wrap the app in <FxProvider>.
 * Vendored sources and licences: ../ATTRIBUTION.md.
 */
export { cn } from './lib/cn.ts';
export { FxProvider } from './lib/FxProvider.tsx';
export { Ambient, type AmbientMood, type AmbientProps } from './components/Ambient.tsx';
export * from './components/stream/index.ts';
export * from './components/input/index.ts';
