import type { ReactNode } from 'react';

/**
 * One gallery entry. Drop a file in gallery/stories/ that default-exports a
 * Story (or Story[]); the gallery finds it, no registry to edit.
 */
export interface Story {
  /** Section, e.g. "Streaming", "Composer", "Status", "Ambient". */
  group: string;
  title: string;
  /** One line: what it is for in an AI chat. */
  note?: string;
  /** Named states shown side by side (idle, streaming, error…). */
  states: Record<string, () => ReactNode>;
  /** Wide stories take the full row. */
  wide?: boolean;
}
