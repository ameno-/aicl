/** The small bar over the canvas (AICL-41): follow the agent, tidy the work frames, canvas-first mode. */
import { LayoutGrid, Locate, Maximize2, Minimize2 } from 'lucide-react';
import { useFocusMode } from '../router.ts';
import { tidy, toggleFocus } from './commands.ts';
import { toggleFollow, useFollow } from './presence.ts';

export function CanvasToolbar() {
  const following = useFollow();
  const focus = useFocusMode();
  return (
    <div className="canvas-toolbar" role="toolbar" aria-label="Canvas workspace">
      <button type="button" aria-pressed={following} aria-label="Follow agent" title="Camera follows the agent while it works" onClick={toggleFollow}>
        <Locate size={14} aria-hidden="true" /> Follow
      </button>
      <button type="button" aria-label="Tidy canvas" title="Lay work frames out in lanes, one per session" onClick={() => void tidy()}>
        <LayoutGrid size={14} aria-hidden="true" /> Tidy
      </button>
      <button type="button" aria-pressed={focus} aria-label={focus ? 'Exit canvas-first mode' : 'Canvas-first mode'} title="Canvas fills the window (⌘⇧F)" onClick={toggleFocus}>
        {focus ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />} {focus ? 'Exit focus' : 'Focus'}
      </button>
    </div>
  );
}
