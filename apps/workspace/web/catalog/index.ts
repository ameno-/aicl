import './catalog.css';
import type { ComponentRenderer } from './types.ts';
import { AppletRenderer } from './applet.tsx';
import { ScreenRenderer } from './screen.tsx';
import {
  ArtifactRenderer,
  ChatRenderer,
  CodeRenderer,
  MetricRenderer,
  PlanRenderer,
  TableRenderer,
  TerminalRenderer,
  TranscriptRenderer,
} from './renderers.tsx';

/**
 * Renderers keyed by catalog name (shared/components.ts). The shape falls back
 * to an "unknown component" notice for any name missing here.
 */
export const renderers: Record<string, ComponentRenderer> = {
  chat: ChatRenderer,
  plan: PlanRenderer,
  code: CodeRenderer,
  terminal: TerminalRenderer,
  artifact: ArtifactRenderer,
  transcript: TranscriptRenderer,
  table: TableRenderer,
  metric: MetricRenderer,
  screen: ScreenRenderer,
  applet: AppletRenderer,
};
