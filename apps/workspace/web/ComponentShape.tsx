import { Component, type ReactNode } from 'react';
import { BaseBoxShapeUtil, HTMLContainer, Rectangle2d, T, type RecordProps, type TLShape } from 'tldraw';
import { Box } from 'lucide-react';
import { COMPONENTS, COMPONENT_SHAPE_TYPE, type ComponentShapeProps } from '../shared/components.ts';
import { renderers } from './catalog/index.ts';

declare module 'tldraw' {
  interface TLGlobalShapePropsMap {
    'aicl-component': ComponentShapeProps;
  }
}

export type ComponentShape = TLShape<typeof COMPONENT_SHAPE_TYPE>;

class Boundary extends Component<{ children: ReactNode; reset: unknown }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { reset: unknown }) {
    if (prev.reset !== this.props.reset && this.state.failed) this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? (
      <div className="aicl-card__notice">This component could not be drawn.</div>
    ) : (
      this.props.children
    );
  }
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
            <Boundary reset={props}>
              <Renderer props={props} width={w} height={Math.max(0, h - 32)} />
            </Boundary>
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
