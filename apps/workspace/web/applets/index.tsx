/**
 * Applets in the browser (work package B). CONTRACT: exports and signatures
 * are fixed; this starter returns nothing so the shell (C) can be built
 * against it. B implements: the applet list (GET /api/applets + 'applet'
 * server events), the workspace config (GET/PUT /api/workspace), and
 * AppletHost (loads /api/applets/:id/bundle.js through the host runtime,
 * renders it in an error boundary, reports runtime errors).
 */
import type { AppletInfo, WorkspaceConfig } from '../../shared/runtime.ts';

export function useApplets(): AppletInfo[] {
  return [];
}

export function useWorkspaceConfig(): [WorkspaceConfig, (next: WorkspaceConfig) => void] {
  return [{ name: 'Workspace', overview: [] }, () => {}];
}

/** Renders one applet filling its container. */
export function AppletHost({ id }: { id: string }) {
  return <div className="aicl-applet-missing">Applet “{id}” is not available yet.</div>;
}
