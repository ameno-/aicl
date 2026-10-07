import { BaseBoxShapeUtil, HTMLContainer, Rectangle2d, T, type RecordProps, type TLShape } from 'tldraw';
import { Box } from 'lucide-react';
import { COMPONENTS, COMPONENT_SHAPE_TYPE, type ComponentShapeProps } from '../shared/components.ts';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { renderers } from './catalog/index.ts';

declare module 'tldraw' {
  interface TLGlobalShapePropsMap {
    'aicl-component': ComponentShapeProps;
  }
}

export type ComponentShape = TLShape<typeof COMPONENT_SHAPE_TYPE>;

/** Test hook: a card with `__aiclThrow` set renders a component that throws, to exercise the boundary. */
function Thrower(): never {
  throw new Error('Intentional render failure (__aiclThrow)');
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export class ComponentShapeUtil extends BaseBoxShapeUtil<ComponentShape> {
  static override type = COMPONENT_SHAPE_TYPE;
  static override props: RecordProps<ComponentShape> = {
    w: T.number,
    h: T.number,
    component: T.string,
    title: T.string,
    props: T.dict(T.string, T.jsonValue),
  };

  override canEdit() {
    return false;
  }
  override hideRotateHandle() {
    return true;
  }

  getDefaultProps(): ComponentShape['props'] {
    const first = COMPONENTS[0] ?? { name: 'chat', title: 'Component', defaultSize: { w: 360, h: 240 } };
    return {
      w: first.defaultSize.w,
      h: first.defaultSize.h,
      component: first.name,
      title: first.title,
      props: {},
    };
  }

  override getGeometry(shape: ComponentShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: ComponentShape) {
    const { w, h, component, title, props } = shape.props;
    const Renderer = renderers[component];
    return (
      <HTMLContainer className="aicl-card" style={{ width: w, height: h }}>
        <div className="aicl-card__header">
          <Box size={14} aria-hidden />
          <span className="aicl-card__title">{title}</span>
          <span className="aicl-card__name">{component}</span>
        </div>
        <div
          className="aicl-card__body"
          onPointerDown={stop}
          onPointerUp={stop}
          onTouchStart={stop}
          onWheelCapture={stop}
        >
          {Renderer ? (
            <ErrorBoundary label="component" resetKeys={[props]}>
              {props['__aiclThrow'] === true ? <Thrower /> : null}
              <Renderer
                props={props}
                width={w}
                height={Math.max(0, h - 32)}
                shapeId={shape.id}
                onPropsChange={(next) =>
                  this.editor.updateShape({ id: shape.id, type: COMPONENT_SHAPE_TYPE, props: { props: next as ComponentShape["props"]["props"] } })
                }
              />
            </ErrorBoundary>
          ) : (
            <div className="aicl-card__notice">Unknown component “{component}”.</div>
          )}
        </div>
      </HTMLContainer>
    );
  }

  getIndicatorPath(shape: ComponentShape) {
    const path = new Path2D();
    path.roundRect(0, 0, shape.props.w, shape.props.h, 12);
    return path;
  }
}

export const shapeUtils = [ComponentShapeUtil];
