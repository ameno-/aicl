import type { LucideIcon } from 'lucide-react';

/**
 * Default renderers draw Lucide line icons, the set the surveyed products
 * converge on. Icons are decoration: the control's accessible name lives on
 * the control, never on the icon.
 */
export function Icon({ as: Glyph, size = 16, spin }: { as: LucideIcon; size?: number; spin?: boolean }) {
  return <Glyph aria-hidden="true" focusable="false" size={size} strokeWidth={1.75} data-aicl="icon" data-spin={spin || undefined} />;
}
