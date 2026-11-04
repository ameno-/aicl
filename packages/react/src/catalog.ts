/**
 * What AICL did with every component in the sample registries.
 *
 * Discovery produces one row per registry item (`docs/catalog/items.json`).
 * This function gives that row exactly one disposition:
 *
 *   - **incorporated** — an AICL primitive names it in its incorporation record
 *   - **candidate** — a chat app will want it, and it is not built yet
 *   - **reference** — a system, a flavour, or a shape we study and do not ship
 *   - **out-of-scope** — marketing, auth, paper, and drawn art
 *
 * An item that matches nothing is `unclassified`. The catalog test fails
 * on that, so a newly discovered component cannot land without a decision.
 */

import { incorporations } from './incorporation.js';

export interface CatalogItem {
  source: 'looseleaf' | 'fluid';
  name: string;
  type: string;
  title: string;
  description: string;
  categories: readonly string[];
}

export type DispositionStatus = 'incorporated' | 'candidate' | 'reference' | 'out-of-scope' | 'unclassified';

export interface Disposition {
  status: DispositionStatus;
  /** Primitive names, when the item is incorporated. */
  as?: readonly string[];
  /** Roadmap coordinate, when the item is a candidate. */
  wave?: string;
  reason: string;
}

const FLUID_FLAVOUR = /-base$/;

/** Sample components that are drawings, toys, or page chrome a chat library does not ship. */
const OUT_OF_SCOPE: Readonly<Record<string, string>> = {
  'looseleaf:direction': 'A direction provider for LooseLeaf\'s drawn pages. AICL does not ship a second writing-direction system.',
  'looseleaf:signature-pad': 'A drawing surface for a signature. The shape is the sketchpad\'s, and the component is not a chat field.',
  'looseleaf:sticker-picker': 'A picker for LooseLeaf\'s sticker sheet. The stickers are the ink layer.',
  'looseleaf:stamp-button': 'A rubber-stamp button. The button primitive covers the control; the stamp is ink.',
  'fluid:carousel-dots': 'Carousel chrome. AICL does not ship a carousel.',
  'fluid:calendar': 'A month grid. A chat library does not ship a date picker.',
  'fluid:date-picker': 'A date field on the calendar. A chat library does not ship a date picker.',
  'fluid:color-picker': 'A color field. Not a chat primitive.',
};

/** Candidates whose wave is more specific than their category. */
const NAMED_CANDIDATE: Readonly<Record<string, { wave: string; reason: string }>> = {
  'looseleaf:command': {
    wave: '2 · C5',
    reason: 'The command palette. @aicl/fx has a Tailwind-coupled one; the library primitive is the roadmap\'s C5.',
  },
  'fluid:command-menu': {
    wave: '2 · C5',
    reason: 'The command palette: input, list, empty, and shortcut helpers. Session search is the narrower combobox that exists today.',
  },
  'fluid:ask-user-questions': {
    wave: '3 · E3',
    reason: 'A structured question flow. @aicl/fx has a question card; the library primitive is the roadmap\'s question flow.',
  },
  'fluid:thinking-indicator': {
    wave: '3 · E2',
    reason: 'A morphing status with cycling text. The spinner covers the plain working state; this is the thinking family.',
  },
  'fluid:thinking-steps': {
    wave: '3 · E2',
    reason: 'A collapsible chain of thought. The reasoning disclosure is the chat row; the sequential family is still open.',
  },
  'fluid:dropdown': {
    wave: '2 · C2',
    reason: 'A menu. The roadmap builds one popup chrome and composes the menu, the select and the combobox from it.',
  },
  'fluid:queued-stack': {
    wave: '3 · E4',
    reason: 'Messages queued while a turn streams. The suggestion stack in @aicl/fx is the same idea without the queue.',
  },
};

const SHIPPED_REFERENCE: Readonly<Record<string, string>> = {
  'fluid:springs': 'Shipped as the three spring tiers in @aicl/motion. The sample stays the reference, not a dependency.',
  'fluid:use-fluid-hover': 'Shipped as useFluidHover in @aicl/motion.',
  'fluid:use-fluid-hover-standard': 'The non-gliding sibling of fluid hover. AICL ships the gliding one.',
  'fluid:icon-context': 'Shipped as the icon slots in @aicl/react.',
  'fluid:size-context': 'Shipped as the CSS size ladder. AICL does not re-provide size through React context.',
  'fluid:type-scale': 'Shipped as the six type roles on the token contract.',
  'fluid:typography': 'Shipped as the type roles. Prose styles stay with the markdown renderer.',
  'fluid:tokens': 'Shipped as the --aicl-* token contract.',
  'fluid:surfaces': 'Shipped as the elevation ladder on the token contract.',
  'looseleaf:looseleaf-theme': 'Shipped as packages/styles/src/themes/looseleaf.css. Tokens only, not the ink.',
  'looseleaf:sketchpad': 'The shape the surface contract is aiming at: compound, controlled, an imperative handle, a model. The drawing surface itself is not incorporated.',
};

const LOOSELEAF_ART = new Set(['Marks', 'Paper', 'Stickers & doodles', 'Icons', 'Charts']);

const LOOSELEAF_TOYS = new Set([
  'boil',
  'confetti',
  'corkboard',
  'flip-card',
  'marquee',
  'peel-corner',
  'sticker-board',
  'tear-off',
]);

const BLOCK_OUT = new Set(['marketing', 'authentication', 'commerce', 'dashboard']);

const CATEGORY_WAVE: Readonly<Record<string, { wave: string; reason: string }>> = {
  Chat: { wave: '3', reason: 'A chat component AICL has not given a primitive yet.' },
  Overlays: { wave: '2 · C2', reason: 'An overlay. One shared popup chrome comes first, then the menus that sit on it.' },
  Forms: { wave: '2 · C3', reason: 'A form control. The settings surface and the composer are where it lands.' },
  Feedback: { wave: '2 · C4', reason: 'Status and empty-state content the transcript and the settings surface both use.' },
  'Data display': { wave: '2 · C4', reason: 'A content primitive for lists, tables and media the transcript renders.' },
  Layout: { wave: '2 · C4', reason: 'A layout primitive. The shells in wave 4 are built out of these.' },
  Navigation: { wave: '2 · C4', reason: 'A navigation primitive. The sidebar and the session list are the ones that exist today.' },
  Actions: { wave: '2 · C4', reason: 'An action primitive. It composes Button, which is the one that exists today.' },
  Interactive: { wave: '3', reason: 'An interactive surface. Study the shape before giving it a primitive.' },
  Typography: { wave: '2 · C4', reason: 'A type treatment. AICL\'s type roles cover the scale; this is the component on top.' },
};

/** Fluid components whose category is just "components", so the category cannot place them. */
const FLUID_UI: Readonly<Record<string, { wave: string; reason: string }>> = {
  'checkbox-group': {
    wave: '2 · C3',
    reason: 'A checkbox group with a merging selection. The form set, after Button.',
  },
  'radio-group': {
    wave: '2 · C3',
    reason: 'A radio group. The segmented control covers a single-choice row; this is the labelled group.',
  },
  'input-copy': {
    wave: '2 · C3',
    reason: 'A read-only field with copy. The code block already copies; this is the field form of it.',
  },
  'input-group': {
    wave: '2 · C3',
    reason: 'An input with a leading icon and a trailing button. The form set.',
  },
  table: {
    wave: '2 · C4',
    reason: 'A table with a hover row. The corpus has tables inside transcripts; the primitive is still open.',
  },
  slider: {
    wave: '2 · C3',
    reason: 'A slider. The form set, for settings that are a range rather than a switch.',
  },
  'scroll-area': {
    wave: '2 · C4',
    reason: 'A scroll container with its own bar. The transcript scroller is the one AICL owns today.',
  },
  combobox: {
    wave: '2 · C3',
    reason: 'A type-ahead over a list. createComboboxModel exists in core; the primitive does not.',
  },
};

function key(item: CatalogItem): string {
  return `${item.source}:${item.name}`;
}

function incorporated(item: CatalogItem): readonly string[] {
  return incorporations
    .filter((record) => record.aligns[item.source].includes(item.name))
    .map((record) => record.name);
}

function categoryWave(item: CatalogItem): { wave: string; reason: string } | null {
  for (const category of item.categories) {
    const wave = CATEGORY_WAVE[category];
    if (wave) return wave;
  }
  return null;
}

/**
 * The decision for one discovered item.
 *
 * The order is the policy: an incorporation wins, then a flavour twin,
 * then an explicit decision, then the item's type, then its category.
 */
export function disposition(item: CatalogItem): Disposition {
  const names = incorporated(item);
  if (names.length > 0) {
    return {
      status: 'incorporated',
      as: names,
      reason: `Incorporated as ${names.join(', ')}. The record on that primitive says what was taken.`,
    };
  }

  if (item.source === 'fluid' && FLUID_FLAVOUR.test(item.name)) {
    const twin = item.name.replace(FLUID_FLAVOUR, '');
    return {
      status: 'reference',
      reason: `Base UI flavour of \`${twin}\`. AICL ships one binding, not a second primitive library.`,
    };
  }

  const id = key(item);
  const shipped = SHIPPED_REFERENCE[id];
  if (shipped) return { status: 'reference', reason: shipped };

  const out = OUT_OF_SCOPE[id];
  if (out) return { status: 'out-of-scope', reason: out };

  const named = NAMED_CANDIDATE[id];
  if (named) return { status: 'candidate', wave: named.wave, reason: named.reason };

  if (item.source === 'looseleaf' && LOOSELEAF_TOYS.has(item.name)) {
    return {
      status: 'out-of-scope',
      reason: 'A paper toy. The motion is charming and the component is not a chat primitive.',
    };
  }

  if (item.type === 'registry:block') {
    if (item.categories.includes('umbrella')) {
      return {
        status: 'reference',
        reason: 'An umbrella that installs every block. AICL does not publish a registry yet.',
      };
    }
    if (item.categories.some((category) => BLOCK_OUT.has(category))) {
      return {
        status: 'out-of-scope',
        reason: 'A marketing, auth, commerce or dashboard block. AICL does not ship those pages.',
      };
    }
    return {
      status: 'candidate',
      wave: '4',
      reason: 'An app-shell block. Blocks wait until the registry exists, and the shells are extracted from the workspace.',
    };
  }

  if (item.type !== 'registry:ui') {
    return {
      status: 'reference',
      reason: 'A system, a hook or a token set. AICL studies it and ships its own version where the roadmap says so.',
    };
  }

  if (item.source === 'looseleaf' && item.categories.some((category) => LOOSELEAF_ART.has(category))) {
    return {
      status: 'out-of-scope',
      reason: 'Drawn art. The ink layer is a later package, and this component is the drawing.',
    };
  }

  const wave = categoryWave(item);
  if (wave) return { status: 'candidate', wave: wave.wave, reason: wave.reason };

  if (item.source === 'fluid' && item.type === 'registry:ui') {
    const placed = FLUID_UI[item.name];
    if (placed) return { status: 'candidate', wave: placed.wave, reason: placed.reason };
  }

  return {
    status: 'unclassified',
    reason: `${item.source} ${item.type} ${item.name} has no disposition. Add one in catalog.ts.`,
  };
}
