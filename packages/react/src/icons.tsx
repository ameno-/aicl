/**
 * Icon slots.
 *
 * A primitive never imports an icon. It asks for the icon that plays a
 * *role* — `close`, `spinner`, `send` — and the role is resolved through
 * {@link IconProvider}. The default set is Lucide, the line set the surveyed
 * products converge on, but an app that wants another set wraps its tree
 * once and every primitive follows.
 *
 * This is the same discipline LooseLeaf uses for its drawn art: the drawing
 * is a layer, the component is not. It is why an icon set is a *theming*
 * axis rather than a dependency.
 *
 * Icons are decoration. The control's accessible name lives on the control,
 * never on the icon, so a slot can be swapped for anything — a glyph, a
 * doodle, an emoji — without touching a single accessible name.
 */

import {
  createContext,
  useContext,
  useMemo,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  Ban,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleX,
  Code,
  Copy,
  Eye,
  File,
  FileText,
  GitCompare,
  Info,
  Lightbulb,
  LoaderCircle,
  PanelLeft,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Square,
  SquareTerminal,
  Table,
  ThumbsDown,
  ThumbsUp,
  X,
  type LucideIcon,
} from 'lucide-react';

/** The props an icon component receives. */
export interface IconGlyphProps {
  size?: number;
  className?: string;
  /** The line weight of the default set. An override may ignore it. */
  strokeWidth?: number;
  'aria-hidden'?: boolean | 'true' | 'false';
  focusable?: boolean | 'true' | 'false';
  'data-aicl'?: string;
  'data-spin'?: boolean | string;
}

/**
 * The default icon for each role.
 *
 * The names are roles, not shapes: `success` rather than `circle-check`,
 * `spinner` rather than `loader-circle`. A role survives a change of icon
 * set; a shape does not.
 */
export const iconDefaults = {
  /* chrome */
  close: X,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  'panel-left': PanelLeft,
  plus: Plus,
  search: Search,

  /* actions */
  send: ArrowUp,
  stop: Square,
  copy: Copy,
  check: Check,
  retry: RotateCcw,
  edit: Pencil,
  'thumb-up': ThumbsUp,
  'thumb-down': ThumbsDown,

  /* status */
  spinner: LoaderCircle,
  info: Info,
  success: CircleCheck,
  alert: CircleAlert,
  failure: CircleX,
  pending: Circle,
  cancelled: Ban,

  /* content kinds */
  attachment: File,
  document: FileText,
  code: Code,
  diff: GitCompare,
  preview: Eye,
  terminal: SquareTerminal,
  table: Table,
  chart: ChartColumn,
  reasoning: Lightbulb,
} as const satisfies Record<string, LucideIcon>;

/** Every role an icon can play. */
export type IconSlot = keyof typeof iconDefaults;

/** An icon component a consumer can supply. */
export type IconComponent = ComponentType<IconGlyphProps>;

/**
 * The overrides. A slot the consumer does not name keeps its default, so an
 * override is a diff, not a replacement.
 */
export type IconOverrides = Partial<Record<IconSlot, IconComponent>>;

const IconContext = createContext<IconOverrides>({});

/**
 * Swaps the icon set for everything below.
 *
 * ```tsx
 * <IconProvider icons={{ spinner: () => <MySpinner /> }}>
 *   <App />
 * </IconProvider>
 * ```
 */
export function IconProvider({
  icons,
  children,
}: {
  icons?: IconOverrides;
  children: ReactNode;
}) {
  const value = useMemo(() => icons ?? {}, [icons]);
  return <IconContext.Provider value={value}>{children}</IconContext.Provider>;
}

/**
 * The component for one role.
 *
 * Components read the slot rather than calling a hook per icon: a component
 * created inside a render is flagged by React Compiler's lint, and a
 * property read from a map is the same lookup without the false alarm.
 */
export function useIcons(): Record<IconSlot, IconComponent> {
  const overrides = useContext(IconContext);
  return useMemo(
    () => ({ ...(iconDefaults as unknown as Record<IconSlot, IconComponent>), ...overrides }),
    [overrides],
  );
}

/** The component for one role, resolved through the provider. */
export function useIcon(slot: IconSlot): IconComponent {
  return useIcons()[slot];
}

export interface IconProps {
  /** The role this icon plays. */
  name: IconSlot;
  /** Size in pixels. */
  size?: number;
  /** Spins the glyph. Used for the running spinner. */
  spin?: boolean;
}

/**
 * One icon.
 *
 * The stroke width is a property of the Lucide set and is passed through;
 * a component that does not understand it ignores it.
 */
export function Icon({ name, size = 16, spin }: IconProps) {
  const Glyph = useIcon(name);
  return (
    <Glyph
      aria-hidden="true"
      focusable="false"
      size={size}
      strokeWidth={1.75}
      data-aicl="icon"
      data-spin={spin || undefined}
    />
  );
}
