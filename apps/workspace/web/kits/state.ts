/**
 * The app's one design (AICL-44): every conversation renders with the
 * assistant kit. Kits stay as presets for screens designed on the canvas.
 */
import { KITS, type ProviderKit } from '../../shared/kits.ts';

export function useKit(): ProviderKit {
  return KITS.assistant;
}
