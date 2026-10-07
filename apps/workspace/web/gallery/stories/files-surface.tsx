import { FilePickerHost, Tree, openFilePicker } from '../../files/index.ts';
import { SurfaceView } from '../../surfaces/index.tsx';
import type { Story } from '../types.ts';

function PickerDemo() {
  return (
    <div className="flex flex-col gap-2">
      <button className="w-fit rounded-md border border-border px-2 py-1 text-sm" onClick={openFilePicker}>
        Open file picker
      </button>
      <FilePickerHost />
    </div>
  );
}

const story: Story[] = [
  {
    group: 'Surfaces',
    title: 'File picker',
    note: 'Quick open: fuzzy search or tree, preview, then Open / Attach to message / Place on canvas.',
    states: { closed: () => <PickerDemo /> },
  },
  {
    group: 'Surfaces',
    title: 'File tree',
    note: 'Lazy directories, keyboard navigation.',
    states: { tree: () => <div style={{ height: 260, width: 260 }}><Tree onOpen={() => {}} /></div> },
  },
  {
    group: 'Surfaces',
    title: 'File view',
    note: 'CodeMirror, read-only with an Edit toggle; needs a workspace file (README.md).',
    wide: true,
    states: { card: () => <div style={{ height: 320 }}><SurfaceView kind="file" id="README.md" variant="card" /></div> },
  },
];

export default story;
