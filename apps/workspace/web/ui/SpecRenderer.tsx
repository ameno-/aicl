import { Component, useCallback, useMemo, useRef, type MouseEvent, type ReactNode } from 'react';
import { THEME_PRESETS, resolveTheme, type ScreenSpec, type UiNode } from '../../shared/ui-spec.ts';
import { NodeBody, isObj, layoutStyle } from './nodes.tsx';
import { themeVars } from './theme.ts';
import './ui.css';

export interface SpecRendererProps {
  spec: ScreenSpec;
  mode: 'select' | 'interact';
  selectedId?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
}

class NodeBoundary extends Component<{ children: ReactNode; reset: unknown }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { reset: unknown }) {
    if (prev.reset !== this.props.reset && this.state.failed) this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? <div className="aicl-ui-quiet">Could not draw this element</div> : this.props.children;
  }
}

function Node({ node, selectedId, depth }: { node: UiNode; selectedId: string | undefined; depth: number }) {
  if (!isObj(node)) return null;
  const id = typeof node.id === 'string' && node.id ? node.id : `auto-${depth}`;
  const type = typeof node.type === 'string' ? node.type : 'unknown';
  const container = type === 'row' || type === 'column';
  const kids = container && Array.isArray(node.children) && depth < 40 ? node.children : [];
  return (
    <div
      className="aicl-ui-node"
      data-ui-id={id}
      data-ui-type={type}
      data-ui-selected={selectedId === id ? '' : undefined}
      style={depth === 0 ? { ...layoutStyle(node), width: "100%", height: "100%" } : layoutStyle(node)}
    >
      <NodeBoundary reset={node}>
        <NodeBody node={node}>
          {kids.map((child, i) => (
            <Node key={isObj(child) && typeof child.id === 'string' ? child.id : i} node={child} selectedId={selectedId} depth={depth + 1} />
          ))}
        </NodeBody>
      </NodeBoundary>
    </div>
  );
}

/** Renders a ScreenSpec at its natural size. The parent decides the frame and scale. */
export function SpecRenderer({ spec, mode, selectedId, onSelect }: SpecRendererProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<Element | null>(null);

  const tokens = useMemo(() => {
    const theme = isObj(spec?.theme) ? spec.theme : { preset: 'default' as const };
    return resolveTheme({ ...theme, preset: THEME_PRESETS[theme.preset] ? theme.preset : 'default' });
  }, [spec?.theme]);
  const vars = useMemo(() => themeVars(tokens), [tokens]);

  const innermost = (target: EventTarget | null) =>
    target instanceof Element ? target.closest('[data-ui-id]') : null;

  const setHover = useCallback((el: Element | null) => {
    if (hoverRef.current === el) return;
    hoverRef.current?.removeAttribute('data-ui-hover');
    el?.setAttribute('data-ui-hover', '');
    hoverRef.current = el;
  }, []);

  const swallow = (e: MouseEvent) => {
    if (mode !== 'select') return;
    e.preventDefault();
  };

  const onClick = (e: MouseEvent) => {
    if (mode !== 'select') return;
    e.preventDefault();
    e.stopPropagation();
    const el = innermost(e.target);
    const id = el?.getAttribute('data-ui-id');
    if (id) onSelect?.(id);
  };

  const root = isObj(spec?.root) ? spec.root : null;

  return (
    <div
      ref={rootRef}
      className="aicl-ui-root"
      data-ui-mode={mode}
      data-ui-theme-mode={tokens.mode}
      data-aicl-ui-selected={selectedId}
      style={vars}
      onMouseDownCapture={swallow}
      onClickCapture={onClick}
      onPointerMove={mode === 'select' ? (e) => setHover(innermost(e.target)) : undefined}
      onPointerLeave={() => setHover(null)}
    >
      {root ? (
        <Node node={root} selectedId={selectedId} depth={0} />
      ) : (
        <div className="aicl-ui-quiet">This screen has no content yet</div>
      )}
    </div>
  );
}
