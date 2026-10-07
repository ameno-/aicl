/**
 * Screen spec read/write on the canvas (work package C).
 */
import type { Editor, TLShapeId } from 'tldraw';
import { COMPONENT_SHAPE_TYPE } from '../../shared/components.ts';
import { fullId, shortId } from '../../shared/scratch.ts';

interface ScreenProps {
  component?: string;
  props?: unknown;
}

function screenShape(editor: Editor, id: string) {
  const shape = editor.getShape(fullId(id) as TLShapeId);
  if (!shape) throw new Error(`No shape with id "${id}".`);
  const props = shape.props as ScreenProps;
  if ((shape.type as string) !== COMPONENT_SHAPE_TYPE || props.component !== 'screen') {
    throw new Error(`Shape "${id}" is not a screen. Use ui_list_screens to find screens.`);
  }
  return shape;
}

/** The ScreenSpec JSON stored on screen shape `id` (short or full id). Throws if it is not a screen. */
export function uiGet(editor: Editor, id: string): unknown {
  return (screenShape(editor, id).props as ScreenProps).props;
}

/** Replace screen shape `id`'s spec; returns the short id. Throws if it is not a screen. */
export function uiSet(editor: Editor, id: string, spec: unknown): string {
  const shape = screenShape(editor, id);
  editor.updateShape({ id: shape.id, type: shape.type, props: { props: spec } } as never);
  return shortId(shape.id);
}
