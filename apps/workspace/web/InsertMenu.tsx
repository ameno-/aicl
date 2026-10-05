import { useState } from 'react';
import { createShapeId, type Editor } from 'tldraw';
import { LayoutGrid } from 'lucide-react';
import { COMPONENTS, COMPONENT_SHAPE_TYPE, type ComponentSpec } from '../shared/components.ts';

function insert(editor: Editor, spec: ComponentSpec) {
  const center = editor.getViewportPageBounds().center;
  const id = createShapeId();
  editor.createShape({
    id,
    type: COMPONENT_SHAPE_TYPE,
    x: center.x - spec.defaultSize.w / 2,
    y: center.y - spec.defaultSize.h / 2,
    props: {
      w: spec.defaultSize.w,
      h: spec.defaultSize.h,
      component: spec.name,
      title: spec.title,
      props: structuredClone(spec.sample),
    },
  });
  editor.select(id);
}

export function InsertMenu({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="insert-menu" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="insert-menu__button"
        aria-expanded={open}
        disabled={!editor}
        onClick={() => setOpen((v) => !v)}
      >
        <LayoutGrid size={14} aria-hidden /> Components
      </button>
      {open && (
        <ul className="insert-menu__list" role="menu">
          {COMPONENTS.map((spec) => (
            <li key={spec.name} role="none">
              <button
                type="button"
                role="menuitem"
                className="insert-menu__item"
                onClick={() => {
                  if (editor) insert(editor, spec);
                  setOpen(false);
                }}
              >
                <strong>{spec.title}</strong>
                <span>{spec.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
