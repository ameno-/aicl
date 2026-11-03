/**
 * React bindings for the AICL motion system.
 *
 * The system itself is framework-agnostic — the springs are CSS, and the
 * geometry is pure functions in the package root. This module adds the two
 * pieces that need a component model:
 *
 *   - `useFluidHover` and `FluidHoverHighlight`: one highlight per list that
 *     travels under the cursor instead of blinking between rows.
 *   - `WeightText`: a label that gets heavier without moving its neighbours.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import {
  pickNearest,
  toLocalPoint,
  type HoverAxis,
  type Point,
  type Rect,
} from './geometry.js';
import { ghostWeight, type WeightName } from './weight.js';

export interface FluidHoverOptions {
  /** The axis the list resolves its nearest item along. Defaults to `y`. */
  axis?: HoverAxis;
  /**
   * Skips an item without removing it from the set — for rows that stay
   * mounted while clipped out of view.
   */
  isItemDisabled?: (element: HTMLElement) => boolean;
}

export interface FluidHoverResult {
  /** The index of the item under the pointer, or `null`. */
  activeIndex: number | null;
  /** The highlight's rectangle in container-local coordinates. */
  highlight: Rect | null;
  /** Attach to the list container. */
  containerRef: (element: HTMLElement | null) => void;
  /**
   * Register an item. Call it from a ref callback:
   *
   * ```tsx
   * const ref = useCallback((el) => registerItem(index, el), [index, registerItem]);
   * ```
   */
  registerItem: (index: number, element: HTMLElement | null) => void;
  /** Spread onto the list container. */
  handlers: {
    onMouseMove: (event: React.MouseEvent<HTMLElement>) => void;
    onMouseLeave: (event: React.MouseEvent<HTMLElement>) => void;
    onClick: (event: React.MouseEvent<HTMLElement>) => void;
  };
}

/**
 * One gliding highlight for a list.
 *
 * The pointer resolves to an item on every move; the highlight travels to it
 * on the fast spring, so the user sees where a click will land before they
 * click. A click that lands in the gap between items — or in the container's
 * padding — is routed to the item that is lit, so what is lit is what a click
 * hits.
 */
export function useFluidHover(options: FluidHoverOptions = {}): FluidHoverResult {
  const { axis = 'y', isItemDisabled } = options;

  const containerRef = useRef<HTMLElement | null>(null);
  const itemsRef = useRef(new Map<number, HTMLElement>());
  const rectsRef = useRef<(Rect | undefined)[] | null>(null);

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<Rect | null>(null);

  const invalidate = useCallback(() => {
    rectsRef.current = null;
  }, []);

  const setContainer = useCallback(
    (element: HTMLElement | null) => {
      containerRef.current = element;
      invalidate();
    },
    [invalidate],
  );

  const registerItem = useCallback(
    (index: number, element: HTMLElement | null) => {
      if (element) {
        itemsRef.current.set(index, element);
      } else {
        itemsRef.current.delete(index);
      }
      invalidate();
    },
    [invalidate],
  );

  // The cached rectangles go stale when anything moves them: the list
  // scrolls, the window resizes, or a row changes size. Nothing else does —
  // moving the pointer writes nothing.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => invalidate();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [invalidate]);

  const measure = useCallback((): (Rect | undefined)[] => {
    const container = containerRef.current;
    if (!container) return [];
    if (rectsRef.current) return rectsRef.current;

    const containerRect = container.getBoundingClientRect();
    const rects: (Rect | undefined)[] = [];
    for (const [index, element] of itemsRef.current) {
      const rect = element.getBoundingClientRect();
      rects[index] = {
        top: rect.top - containerRect.top,
        left: rect.left - containerRect.left,
        width: rect.width,
        height: rect.height,
      };
    }
    rectsRef.current = rects;
    return rects;
  }, []);

  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const point: Point = toLocalPoint(
        { x: event.clientX, y: event.clientY },
        {
          top: containerRect.top,
          left: containerRect.left,
          width: containerRect.width,
          height: containerRect.height,
        },
      );

      const rects = measure();
      const index = pickNearest(point, rects, {
        axis,
        isDisabled: (i) => {
          const element = itemsRef.current.get(i);
          return element ? (isItemDisabled?.(element) ?? false) : false;
        },
      });

      setActiveIndex(index);
      setHighlight(index === null ? null : (rects[index] ?? null));
    },
    [axis, isItemDisabled, measure],
  );

  const onMouseLeave = useCallback(() => {
    setActiveIndex(null);
    setHighlight(null);
  }, []);

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (activeIndex === null) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // A click that landed inside an item, or on a control between items,
      // is that control's business.
      for (const element of itemsRef.current.values()) {
        if (element === target || element.contains(target)) return;
      }

      const element = itemsRef.current.get(activeIndex);
      if (element && !isItemDisabled?.(element)) element.click();
    },
    [activeIndex, isItemDisabled],
  );

  return {
    activeIndex,
    highlight,
    containerRef: setContainer,
    registerItem,
    handlers: { onMouseMove, onMouseLeave, onClick },
  };
}

export interface FluidHoverHighlightProps extends HTMLAttributes<HTMLDivElement> {
  /** The hook's result. */
  hover: FluidHoverResult;
  /** Extra class names for the overlay. */
  className?: string;
}

/**
 * The travelling highlight.
 *
 * One element per list, moved with a transform so the travel stays on the
 * compositor. When the highlight appears for the first time it fades in at
 * the row it lands on instead of sliding over from wherever it was last.
 */
export function FluidHoverHighlight({
  hover,
  className,
  style,
  ...rest
}: FluidHoverHighlightProps) {
  const { highlight } = hover;
  const [snap, setSnap] = useState(false);
  const previousRef = useRef<Rect | null>(null);

  useLayoutEffect(() => {
    if (!highlight) {
      previousRef.current = null;
      return;
    }
    if (previousRef.current) {
      previousRef.current = highlight;
      return;
    }

    // Fresh entry: place it without travelling.
    previousRef.current = highlight;
    setSnap(true);
    const frame = requestAnimationFrame(() => setSnap(false));
    return () => cancelAnimationFrame(frame);
  }, [highlight]);

  const position = highlight
    ? {
        width: `${highlight.width}px`,
        height: `${highlight.height}px`,
        transform: `translate3d(${highlight.left}px, ${highlight.top}px, 0)`,
      }
    : { width: '0px', height: '0px', transform: 'translate3d(0, 0, 0)' };

  return (
    <div
      {...rest}
      aria-hidden="true"
      data-aicl-fluid-hover=""
      data-snap={snap ? '' : undefined}
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        opacity: highlight ? 1 : 0,
        transition: snap ? 'none' : undefined,
        ...position,
        ...style,
      }}
    />
  );
}

export interface WeightTextProps extends HTMLAttributes<HTMLElement> {
  /** The element to render. Defaults to `span`. */
  as?: ElementType;
  /** The resting weight. */
  weight?: WeightName;
  /** The weight when the label is selected, hovered or active. */
  activeWeight?: WeightName;
  /** Whether the label is in its active state. */
  active?: boolean;
  children?: ReactNode;
}

/**
 * A label that changes weight without moving its neighbours.
 *
 * The ghost span reserves the width at the heaviest weight the label can
 * take; the visible copy animates its `font-variation-settings` inside that
 * reserved space.
 */
export function WeightText({
  as,
  weight = 'normal',
  activeWeight = 'semibold',
  active = false,
  children,
  ...rest
}: WeightTextProps) {
  const Tag = (as ?? 'span') as ElementType;
  const resolved = active ? activeWeight : weight;

  return (
    <Tag {...rest} data-aicl-weight="" data-weight={resolved}>
      <span data-aicl-weight-ghost="" aria-hidden="true" data-weight={ghostWeight}>
        {children}
      </span>
      <span data-aicl-weight-text="" data-weight={resolved}>
        {children}
      </span>
    </Tag>
  );
}
