/**
 * How each primitive was incorporated.
 *
 * The contract says what a primitive publishes. This file says where it
 * sits against the two sample libraries: which of their components it
 * corresponds to, which shapes it uses, and which motion it takes. A
 * primitive without a record is not incorporated — the catalog test fails.
 *
 * Nothing here is copied. `aligns` names the sample component we were
 * looking at. `taken` says what we kept from that look and what stayed
 * ours. The vocabulary of shapes is `docs/INVENTORY.md` §4.
 */

/** A shape from the inventory. S7 is the slot contract, and every primitive has it. */
export type ShapeId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8' | 'S9';

export const SHAPES: Readonly<Record<ShapeId, string>> = {
  S1: 'flat primitive',
  S2: 'compound, named subparts',
  S3: 'provider and context hook',
  S4: 'controlled and uncontrolled',
  S5: 'imperative handle',
  S6: 'render-prop slots',
  S7: 'slot DOM contract',
  S8: 'size ladder',
  S9: 'icon slots',
};

/** The slowest spring the surface uses. `none` means the component is deliberately still. */
export type MotionTier = 'none' | 'fast' | 'moderate' | 'slow';

export interface MotionRecord {
  tier: MotionTier;
  /**
   * Named motions, in the sample libraries' vocabulary. Empty when the
   * component does not move.
   */
  behaviors: readonly string[];
}

export interface IncorporationRecord {
  /** The primitive's public name. Matches `PrimitiveContract.name`. */
  name: string;
  shapes: readonly ShapeId[];
  motion: MotionRecord;
  /** Sample registry item names. Exact, so discovery can join on them. */
  aligns: {
    looseleaf: readonly string[];
    fluid: readonly string[];
  };
  /** Section id in `examples/slice-1/Components.tsx`, when it has one. */
  gallery: string | null;
  /** Stop id in `examples/slice-1/Tour.tsx`, when it has one. */
  tour: string | null;
  /** Where a person goes to see it, in one sentence. */
  see: string;
  /** What we took from the samples, and what stayed ours. */
  taken: string;
}

/**
 * One record per primitive, in the same order as the contract.
 */
export const incorporations: readonly IncorporationRecord[] = [
  {
    name: 'Button',
    shapes: ['S1', 'S7', 'S8', 'S9'],
    motion: { tier: 'fast', behaviors: ['hover', 'press'] },
    aligns: { looseleaf: ['button'], fluid: ['button'] },
    gallery: 'buttons',
    tour: 'button',
    see: 'The components gallery, section Button, and the first stop of the tour.',
    taken: 'Both libraries ship a button with variants, a size ladder, a loading state and icon slots. AICL publishes those as attributes and resolves the glyphs through the icon provider. The press distance comes from the experience tokens, so a skin can sit the button down.',
  },
  {
    name: 'Transcript',
    shapes: ['S2', 'S3', 'S7'],
    motion: { tier: 'moderate', behaviors: ['entrance'] },
    aligns: { looseleaf: ['message-scroller', 'message'], fluid: ['chat-message'] },
    gallery: null,
    tour: 'transcript',
    see: 'The tour\'s Transcript stop, and the live thread in examples/slice-1.',
    taken: 'LooseLeaf splits the scroller from the row, and Fluid puts the actions in a hover-revealed meta line. AICL keeps one live region for the whole thread and lets a message arrive rather than pop. Streaming, parts and branching stay ours.',
  },
  {
    name: 'Composer',
    shapes: ['S2', 'S4', 'S6', 'S7'],
    motion: { tier: 'fast', behaviors: ['hover'] },
    aligns: { looseleaf: ['prompt-input'], fluid: ['input-message'] },
    gallery: 'composer-compound',
    tour: 'composer',
    see: 'The components gallery, section Composer, and the tour\'s Composer stop.',
    taken: 'The compound slots — body, field, submit, attachments, suggestions — are the shape both composers use, including a status that already matched AICL\'s. The send action, the IME-safe Enter and the submission guards stay ours.',
  },
  {
    name: 'PartRenderer',
    shapes: ['S1', 'S7'],
    motion: { tier: 'fast', behaviors: ['fade'] },
    aligns: { looseleaf: ['code-block', 'attachment', 'typing-indicator'], fluid: ['file-thumbnail'] },
    gallery: null,
    tour: 'transcript',
    see: 'Inside every transcript row. The live thread in examples/slice-1 renders the default parts.',
    taken: 'A code block, a file chip and a typing row exist in both libraries as separate components. AICL keeps them as part renderers on one registry, so an unknown part cannot blank the thread. The morphing thinking indicator and the sequential thinking steps are still candidates.',
  },
  {
    name: 'MessageActions',
    shapes: ['S1', 'S7', 'S9'],
    motion: { tier: 'fast', behaviors: ['hover'] },
    aligns: { looseleaf: ['message'], fluid: ['chat-message'] },
    gallery: null,
    tour: 'transcript',
    see: 'On a completed message, in the tour\'s Transcript stop.',
    taken: 'Fluid reveals the action row on hover. AICL does the same and also reveals it on keyboard focus, which the corpus requires. Copy, retry and feedback stay role-scoped.',
  },
  {
    name: 'PlanChecklist',
    shapes: ['S1', 'S7'],
    motion: { tier: 'none', behaviors: [] },
    aligns: { looseleaf: [], fluid: [] },
    gallery: null,
    tour: null,
    see: 'examples/slice-1/Gallery.tsx renders a plan inside the thread.',
    taken: 'Neither sample has a plan rollup. This one is AICL\'s, from the corpus: an ordered list and a derived count, render only.',
  },
  {
    name: 'ComposerSurface',
    shapes: ['S1', 'S6', 'S7'],
    motion: { tier: 'fast', behaviors: ['indeterminate'] },
    aligns: { looseleaf: ['attachment', 'prompt-input'], fluid: ['input-message'] },
    gallery: 'trigger-menus',
    tour: null,
    see: 'The components gallery: slash and mention menus, suggestion chips, attachment chips, and the dropzone.',
    taken: 'Attachments and suggestion chips are slots on both composers. AICL\'s trigger menus (slash, mention) are the corpus behaviour those composers do not have.',
  },
  {
    name: 'SessionList',
    shapes: ['S1', 'S7'],
    motion: { tier: 'fast', behaviors: ['shimmer'] },
    aligns: { looseleaf: ['sidebar'], fluid: ['sidebar'] },
    gallery: 'session-list',
    tour: 'sessions',
    see: 'The components gallery, section Session list, and the tour\'s Sessions stop.',
    taken: 'Both libraries have a sidebar of rows. AICL\'s list is grouped by recency, which is the corpus pattern, and the loading rows shimmer.',
  },
  {
    name: 'SessionSearch',
    shapes: ['S1', 'S7', 'S9'],
    motion: { tier: 'fast', behaviors: ['fade'] },
    aligns: { looseleaf: [], fluid: [] },
    gallery: 'session-search',
    tour: null,
    see: 'The components gallery, section Session search.',
    taken: 'A command palette is the sample shape and is still a candidate. This search is narrower: one combobox over the sessions the host already has.',
  },
  {
    name: 'SidebarNav',
    shapes: ['S1', 'S7', 'S9'],
    motion: { tier: 'moderate', behaviors: ['fade'] },
    aligns: { looseleaf: ['sidebar'], fluid: ['sidebar'] },
    gallery: 'sidebar-nav',
    tour: null,
    see: 'The components gallery, section Sidebar nav.',
    taken: 'The collapsible nav is the piece of both sidebars a chat app actually needs. The sixteen sidebar blocks stay candidates for the registry.',
  },
  {
    name: 'Dialog',
    shapes: ['S2', 'S7'],
    motion: { tier: 'slow', behaviors: ['entrance', 'exit'] },
    aligns: { looseleaf: ['dialog'], fluid: ['dialog'] },
    gallery: 'overlays',
    tour: 'dialog',
    see: 'The components gallery, section Dialog, and the tour\'s Dialog stop.',
    taken: 'A modal that lands and then gets out of the way. The entrance uses the slow spring and the experience tokens, so a skin can tip the sheet as it arrives. Focus trap and focus return stay ours.',
  },
  {
    name: 'AlertDialog',
    shapes: ['S2', 'S7'],
    motion: { tier: 'slow', behaviors: ['entrance'] },
    aligns: { looseleaf: ['alert-dialog'], fluid: ['dialog'] },
    gallery: 'overlays',
    tour: null,
    see: 'The components gallery, in the overlays section.',
    taken: 'LooseLeaf\'s alert dialog cannot be dismissed by the scrim. AICL keeps that, and adds a typed confirmation for the destructive case.',
  },
  {
    name: 'Drawer',
    shapes: ['S1', 'S7'],
    motion: { tier: 'moderate', behaviors: ['entrance'] },
    aligns: { looseleaf: ['drawer', 'sheet'], fluid: ['mobile-drawer'] },
    gallery: 'overlays',
    tour: null,
    see: 'The components gallery, in the overlays section.',
    taken: 'A sheet from the edge. LooseLeaf has both a drawer and a sheet; Fluid has a mobile drawer. AICL ships one, with a side and a swipe to dismiss.',
  },
  {
    name: 'ToastRegion',
    shapes: ['S1', 'S7'],
    motion: { tier: 'moderate', behaviors: ['entrance'] },
    aligns: { looseleaf: ['sonner'], fluid: [] },
    gallery: 'toasts',
    tour: null,
    see: 'The components gallery, section Toasts.',
    taken: 'One polite live region for transient status. The placement is an attribute, so a skin can move the pile.',
  },
  {
    name: 'Toast',
    shapes: ['S1', 'S7', 'S9'],
    motion: { tier: 'moderate', behaviors: ['entrance', 'exit'] },
    aligns: { looseleaf: ['sonner'], fluid: ['banner'] },
    gallery: 'toasts',
    tour: null,
    see: 'The components gallery, section Toasts.',
    taken: 'A toast arrives and leaves. Fluid\'s banner is the durable cousin; the alert primitive is that. A toast is the transient one.',
  },
  {
    name: 'Field',
    shapes: ['S2', 'S7'],
    motion: { tier: 'fast', behaviors: ['fade'] },
    aligns: { looseleaf: ['field', 'label'], fluid: [] },
    gallery: 'forms',
    tour: null,
    see: 'The components gallery, section Field.',
    taken: 'The words around a control: label, description, error, and a save acknowledgement. The save state is AICL\'s, from the settings corpus.',
  },
  {
    name: 'Switch',
    shapes: ['S1', 'S7'],
    motion: { tier: 'fast', behaviors: ['thumb'] },
    aligns: { looseleaf: ['switch'], fluid: ['switch'] },
    gallery: 'forms',
    tour: 'choice',
    see: 'The components gallery, section Field, and the tour\'s Choice stop.',
    taken: 'A thumb that travels. Both libraries spring it; AICL uses the fast tier. The label is a real label.',
  },
  {
    name: 'Select',
    shapes: ['S1', 'S7', 'S9'],
    motion: { tier: 'moderate', behaviors: ['entrance'] },
    aligns: { looseleaf: ['select'], fluid: ['select'] },
    gallery: 'forms',
    tour: 'choice',
    see: 'The components gallery, section Field, and the tour\'s Choice stop.',
    taken: 'A listbox trigger with typeahead. The shared popup chrome both libraries factor out is still a candidate; this select carries its own list.',
  },
  {
    name: 'SegmentedControl',
    shapes: ['S1', 'S7', 'S9'],
    motion: { tier: 'moderate', behaviors: ['travelling-indicator'] },
    aligns: { looseleaf: ['toggle-group', 'tabs'], fluid: ['tabs'] },
    gallery: 'forms',
    tour: 'choice',
    see: 'The components gallery, section Field, and the tour\'s Choice stop.',
    taken: 'The selection is a pill that travels across equal columns, which is Fluid\'s tab motion and LooseLeaf\'s lifted tab. Arrow keys move and select. It is a radiogroup, not a set of panels — panels are Tabs.',
  },
  {
    name: 'Badge',
    shapes: ['S1', 'S7'],
    motion: { tier: 'fast', behaviors: ['hover'] },
    aligns: { looseleaf: ['badge'], fluid: ['badge'] },
    gallery: 'content',
    tour: null,
    see: 'The components gallery, section Content.',
    taken: 'A small label with a variant axis. Both libraries draw one; AICL publishes the variant and lets the skin decide the ink.',
  },
  {
    name: 'Separator',
    shapes: ['S1', 'S7'],
    motion: { tier: 'none', behaviors: [] },
    aligns: { looseleaf: ['separator'], fluid: [] },
    gallery: 'content',
    tour: null,
    see: 'The components gallery, section Content.',
    taken: 'A rule. Decorative by default, so it is not announced, and semantic when a region boundary matters. It does not move.',
  },
  {
    name: 'Kbd',
    shapes: ['S1', 'S7'],
    motion: { tier: 'fast', behaviors: ['press'] },
    aligns: { looseleaf: ['kbd'], fluid: [] },
    gallery: 'content',
    tour: null,
    see: 'The components gallery, section Content.',
    taken: 'A keycap that presses flat. LooseLeaf draws the cap; Fluid only formats shortcut strings inside the command menu. AICL ships the cap, and the command menu remains a candidate.',
  },
  {
    name: 'Progress',
    shapes: ['S1', 'S7'],
    motion: { tier: 'moderate', behaviors: ['fill', 'indeterminate'] },
    aligns: { looseleaf: ['progress'], fluid: [] },
    gallery: 'motion',
    tour: 'motion',
    see: 'The components gallery, section Motion, and the tour\'s Motion stop.',
    taken: 'Determinate fill on the moderate spring, and an indeterminate bar that travels when the value is unknown. LooseLeaf hatches the track; AICL uses the accent and the same indeterminate motion as an upload.',
  },
  {
    name: 'Skeleton',
    shapes: ['S1', 'S7'],
    motion: { tier: 'moderate', behaviors: ['shimmer'] },
    aligns: { looseleaf: ['skeleton'], fluid: [] },
    gallery: 'motion',
    tour: 'motion',
    see: 'The components gallery, section Motion, and the tour\'s Motion stop.',
    taken: 'A placeholder that shimmers while content is on its way, and is hidden from assistive tech. LooseLeaf boils a pencil hatch; AICL shimmers a flat block so any skin can restyle it.',
  },
  {
    name: 'Spinner',
    shapes: ['S1', 'S7', 'S9'],
    motion: { tier: 'fast', behaviors: ['spin'] },
    aligns: { looseleaf: ['spinner'], fluid: [] },
    gallery: 'motion',
    tour: 'motion',
    see: 'The components gallery, section Motion, and the tour\'s Motion stop.',
    taken: 'A status glyph that spins, through the spinner icon slot, with an accessible name. Fluid\'s thinking indicator morphs a path and cycles text; that one is still a candidate. This is the plain working state.',
  },
  {
    name: 'Alert',
    shapes: ['S2', 'S7', 'S9'],
    motion: { tier: 'slow', behaviors: ['entrance'] },
    aligns: { looseleaf: ['alert'], fluid: ['banner'] },
    gallery: 'content',
    tour: null,
    see: 'The components gallery, section Content.',
    taken: 'A durable status message with a title and a description. Fluid exports a motion config for the banner; AICL uses the slow entrance spring and the experience tokens instead of a second runtime.',
  },
  {
    name: 'Card',
    shapes: ['S2', 'S7'],
    motion: { tier: 'none', behaviors: [] },
    aligns: { looseleaf: ['card'], fluid: ['card'] },
    gallery: 'content',
    tour: null,
    see: 'The components gallery, section Content.',
    taken: 'Header, title, description, body, footer. Both libraries compose a card this way. The elevation is the shadow ladder, and the card itself does not move.',
  },
  {
    name: 'Empty',
    shapes: ['S2', 'S7'],
    motion: { tier: 'moderate', behaviors: ['fade'] },
    aligns: { looseleaf: ['empty'], fluid: [] },
    gallery: 'content',
    tour: null,
    see: 'The components gallery, section Content.',
    taken: 'A title, an explanation and an action, for a region with nothing in it. LooseLeaf draws a mascot beside it; AICL leaves the picture to the icon slot the caller passes.',
  },
  {
    name: 'Tooltip',
    shapes: ['S1', 'S7'],
    motion: { tier: 'fast', behaviors: ['fade'] },
    aligns: { looseleaf: ['tooltip'], fluid: ['tooltip'] },
    gallery: 'content',
    tour: null,
    see: 'The components gallery, section Content.',
    taken: 'Shows on hover and on keyboard focus, on the fast tier, and is hidden from assistive tech until it is open. It does not dodge the viewport. A collision-aware popover is still a candidate.',
  },
  {
    name: 'Tabs',
    shapes: ['S2', 'S3', 'S4', 'S7'],
    motion: { tier: 'moderate', behaviors: ['travelling-indicator'] },
    aligns: { looseleaf: ['tabs'], fluid: ['tabs'] },
    gallery: 'motion',
    tour: 'motion',
    see: 'The components gallery, section Motion, and the tour\'s Motion stop.',
    taken: 'Panels plus a pill that travels across equal columns, on the moderate spring. Arrow keys move the selection. Controlled and uncontrolled. Fluid also glides a hover highlight; the tour\'s Go to list is where that highlight lives.',
  },
  {
    name: 'Collapsible',
    shapes: ['S2', 'S4', 'S7', 'S9'],
    motion: { tier: 'moderate', behaviors: ['height', 'chevron'] },
    aligns: { looseleaf: ['collapsible'], fluid: ['accordion'] },
    gallery: 'motion',
    tour: 'motion',
    see: 'The components gallery, section Motion, and the tour\'s Motion stop.',
    taken: 'One panel. The height animates by opening the grid row, and the chevron turns on the same spring. Closed content stays mounted and is not readable or tabbable. The reasoning disclosure stays the chat-specific one.',
  },
  {
    name: 'Accordion',
    shapes: ['S2', 'S3', 'S4', 'S7', 'S9'],
    motion: { tier: 'moderate', behaviors: ['height', 'chevron'] },
    aligns: { looseleaf: ['accordion'], fluid: ['accordion'] },
    gallery: 'motion',
    tour: 'motion',
    see: 'The components gallery, section Motion, and the tour\'s Motion stop.',
    taken: 'A list of collapsible rows. Single closes the previous row; multiple keeps them. Both libraries animate the height and the chevron, and Fluid adds a hover highlight in grouped mode. AICL takes the height and the chevron.',
  },
];
