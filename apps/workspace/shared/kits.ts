/**
 * Wave 3b contract (AICL-32 provider kits, AICL-34 the application).
 *
 * A provider kit is how one shipping product *behaves*, not only its palette:
 * its words, how a conversation reads, how agent work is shown, what the
 * composer offers, how the app is laid out, and how it moves. Every field is
 * grounded in the 1,262-screen corpus (docs/domains/*.md); the comments cite
 * the observation.
 *
 * Kits are data. Renderers (web/kits/*) read them; screens (shared/ui-spec.ts
 * presets) and the application (web/shell/AgentPage.tsx) both use them, so a
 * Devin screen on the canvas and the Devin app look and behave the same.
 */
import { THEME_PRESETS, type ThemePresetName, type ThemeTokens } from './ui-spec.ts';

export type KitId = 'aicl' | 'devin' | 'manus' | 'lovable' | 'cofounder';

/** How the agent's tool work appears in the transcript. */
export type ToolCallStyle =
  | 'cards' //       one ToolCallCard per call (AICL default)
  | 'work-summary' // calls fold into a "Worked for 11s" disclosure (Devin)
  | 'step-rows' //   quiet one-line rows inside a "<Agent> is working" disclosure (Manus "Loading skill …")
  | 'collapsed' //   one collapsed chip per call, expandable (Lovable)
  | 'timeline'; //   vertical step timeline with aggregate rows "Ran 2 actions" (Cofounder)

export type ReasoningStyle =
  | 'inline' //      muted block (AICL)
  | 'thought-for' // "Thought for 24s" disclosure (Lovable)
  | 'in-work'; //    folded into the work disclosure (Devin, Manus)

export type WorkPanel =
  | 'none'
  | 'tabs' //      editor / terminal / preview tabs beside the chat (Devin)
  | 'computer' //  "<Agent>'s computer": live terminal/browser view of the current step (Manus)
  | 'preview' //   live preview of what is being built, chat on the left (Lovable)
  | 'board'; //    task board / timeline beside the chat (Cofounder)

export type MotionPersonality = 'crisp' | 'soft' | 'expressive' | 'calm';

export interface ProviderKit {
  id: KitId;
  /** Shown in the kit switcher. "-like": these are homages, never the real brands. */
  label: string;
  tagline: string;
  /** Base theme; screens and the app apply these as AICL tokens. */
  preset: ThemePresetName;
  tokens: ThemeTokens;

  vocabulary: {
    /** What a conversation is called: Sessions / Tasks / Projects. */
    sessions: string;
    newSession: string;
    /** The agent's display name in "<agent> is working", "Ask <agent>…". */
    agent: string;
    placeholder: string;
    heroTitle: string;
  };

  transcript: {
    /** Devin uses full-width rows for both roles; the others bubble the user. */
    user: 'bubble' | 'row';
    /** Devin: time in a header bar above each turn. */
    timestamps: 'header' | 'none';
    /** Assistant avatar/name line above replies (Manus, Cofounder). */
    assistantHeader: boolean;
    /** Persistent message actions under replies. */
    actions: Array<'copy' | 'thumbs' | 'share' | 'revert' | 'retry' | 'more'>;
    reasoning: ReasoningStyle;
    toolCalls: ToolCallStyle;
    /** How streaming text arrives. */
    streaming: 'words' | 'blur' | 'none';
    /** The waiting indicator before the first token. */
    thinking: 'shimmer' | 'dots' | 'bars';
  };

  composer: {
    /** Mode chip, e.g. Devin "Normal ▾". Empty: none. */
    modes: string[];
    /** Context chips below the box (Devin: repos · machine). */
    contextChips: boolean;
    /** Integration chips (Manus: Gmail, Calendar, Drive). */
    integrations: string[];
    /** Task progress chip in the composer (Manus "4/4"). */
    progressChip: boolean;
    /** Attach button label (Lovable "Attach"); empty: icon only. */
    attachLabel: string;
    /** Hero (centred, large) composer on empty state. */
    hero: boolean;
  };

  layout: {
    /** Cofounder puts workspace + breadcrumb in a top bar; others use a sidebar. */
    nav: 'sidebar' | 'topbar';
    /** Session list grouping: recency buckets (Devin) or flat. */
    grouping: 'recency' | 'flat';
    workPanel: WorkPanel;
    /** Tabs of the work panel, in order (meaningful for 'tabs' / 'computer'). */
    workTabs: Array<'plan' | 'terminal' | 'preview' | 'files' | 'browser' | 'changes'>;
  };

  motion: {
    personality: MotionPersonality;
    /** Spring for layout and disclosure animations (motion's spring options). */
    spring: { stiffness: number; damping: number };
  };

  /** Ambient (WebGPU) colours for the hero/working backdrop, darkest first; null: no ambience. */
  ambient: [string, string, string] | null;
}

const tokens = (p: ThemePresetName): ThemeTokens => THEME_PRESETS[p].tokens;

export const KITS: Record<KitId, ProviderKit> = {
  aicl: {
    id: 'aicl',
    label: 'AICL',
    tagline: 'The library default: neutral, one card per tool call.',
    preset: 'default',
    tokens: tokens('default'),
    vocabulary: { sessions: 'Chats', newSession: 'New chat', agent: 'Agent', placeholder: 'Ask the agent anything…', heroTitle: 'What should we build?' },
    transcript: { user: 'bubble', timestamps: 'none', assistantHeader: false, actions: ['copy', 'thumbs', 'retry'], reasoning: 'inline', toolCalls: 'cards', streaming: 'words', thinking: 'shimmer' },
    composer: { modes: [], contextChips: false, integrations: [], progressChip: false, attachLabel: '', hero: true },
    layout: { nav: 'sidebar', grouping: 'recency', workPanel: 'tabs', workTabs: ['plan', 'terminal', 'changes', 'files', 'browser'] },
    motion: { personality: 'crisp', spring: { stiffness: 420, damping: 34 } },
    ambient: ['#18181b', '#6366f1', '#ec4899'],
  },
  devin: {
    id: 'devin',
    label: 'Devin-like',
    tagline: 'Dense engineering sessions: full-width rows, work summaries, editor/terminal/preview tabs.',
    preset: 'devin',
    tokens: tokens('devin'),
    // navigation.md: sidebar "Sessions"; composer.md: "Normal ▾" mode chip, context chips "12 repositories · Ubuntu".
    vocabulary: { sessions: 'Sessions', newSession: 'New session', agent: 'Devin', placeholder: 'Ask Devin to build features, fix bugs, or work on your code…', heroTitle: 'What do you want to get done?' },
    // transcript.md: full-width rows for both roles, "2:23 PM" in a header bar, thumbs/copy/share; "Worked for 11s".
    transcript: { user: 'row', timestamps: 'header', assistantHeader: false, actions: ['thumbs', 'copy', 'share'], reasoning: 'in-work', toolCalls: 'work-summary', streaming: 'none', thinking: 'bars' },
    composer: { modes: ['Normal', 'Fast', 'Deep'], contextChips: true, integrations: [], progressChip: false, attachLabel: '', hero: true },
    // agent-execution.md: editor/terminal/preview tabs; terminal_output is mostly Devin.
    layout: { nav: 'sidebar', grouping: 'recency', workPanel: 'tabs', workTabs: ['terminal', 'changes', 'files', 'browser', 'preview', 'plan'] },
    motion: { personality: 'crisp', spring: { stiffness: 520, damping: 40 } },
    ambient: null,
  },
  manus: {
    id: 'manus',
    label: 'Manus-like',
    tagline: 'Delegated tasks: "is working" disclosures, quiet step rows, a live computer panel.',
    preset: 'manus',
    tokens: tokens('manus'),
    // navigation.md: "New task", tasks list; composer.md: "+" with Gmail/Calendar/Drive chips, progress "4/4".
    vocabulary: { sessions: 'Tasks', newSession: 'New task', agent: 'Manus', placeholder: 'Send message to Manus', heroTitle: 'What can I do for you?' },
    // transcript.md: avatar/name line "manus"; "Manus is working" disclosure with status dot; "Loading skill …" rows.
    transcript: { user: 'bubble', timestamps: 'none', assistantHeader: true, actions: ['copy', 'share'], reasoning: 'in-work', toolCalls: 'step-rows', streaming: 'blur', thinking: 'dots' },
    composer: { modes: [], contextChips: false, integrations: ['Gmail', 'Calendar', 'Drive'], progressChip: true, attachLabel: '', hero: true },
    // agent-execution.md: Manus side panel; "Accepted" banner.
    layout: { nav: 'sidebar', grouping: 'flat', workPanel: 'computer', workTabs: ['terminal', 'browser', 'files'] },
    motion: { personality: 'soft', spring: { stiffness: 260, damping: 30 } },
    ambient: ['#2a2622', '#c9b8a6', '#f2e9df'],
  },
  lovable: {
    id: 'lovable',
    label: 'Lovable-like',
    tagline: 'Build-and-preview: "Thought for 24s", collapsed tool chips, a live preview beside the chat.',
    preset: 'lovable',
    tokens: tokens('lovable'),
    // composer.md: "Ask Lovable…", "+ Attach  Theme ▾"; navigation.md: projects, template gallery.
    vocabulary: { sessions: 'Projects', newSession: 'New project', agent: 'Lovable', placeholder: 'Ask Lovable to create…', heroTitle: 'Build something lovable' },
    // transcript.md: "Thought for 24s" reasoning, revert/copy/more actions; agent-execution.md: tool_call_collapsed.
    transcript: { user: 'bubble', timestamps: 'none', assistantHeader: false, actions: ['revert', 'copy', 'more'], reasoning: 'thought-for', toolCalls: 'collapsed', streaming: 'words', thinking: 'shimmer' },
    composer: { modes: [], contextChips: false, integrations: [], progressChip: false, attachLabel: 'Attach', hero: true },
    layout: { nav: 'sidebar', grouping: 'flat', workPanel: 'preview', workTabs: ['preview', 'browser', 'changes', 'files', 'terminal'] },
    motion: { personality: 'expressive', spring: { stiffness: 300, damping: 22 } },
    ambient: ['#151515', '#e14a8b', '#7c3aed'],
  },
  cofounder: {
    id: 'cofounder',
    label: 'Cofounder-like',
    tagline: 'Calm operations: step timelines, "Ran 2 actions" aggregates, approvals as badges, top-bar navigation.',
    preset: 'cofounder',
    tokens: tokens('cofounder'),
    // navigation.md: workspace switcher + breadcrumb in a top bar; tasks with "READY" badges.
    vocabulary: { sessions: 'Tasks', newSession: 'New task', agent: 'Cofounder', placeholder: 'Ask Cofounder…', heroTitle: 'What should we work on today?' },
    // agent-execution.md: step_timeline (Cofounder 9/10), aggregate "Ran 2 actions", "Requires Approval" badges.
    transcript: { user: 'bubble', timestamps: 'none', assistantHeader: true, actions: ['copy'], reasoning: 'inline', toolCalls: 'timeline', streaming: 'blur', thinking: 'shimmer' },
    composer: { modes: [], contextChips: false, integrations: [], progressChip: false, attachLabel: '', hero: true },
    layout: { nav: 'topbar', grouping: 'flat', workPanel: 'board', workTabs: ['plan', 'changes', 'files'] },
    motion: { personality: 'calm', spring: { stiffness: 180, damping: 28 } },
    ambient: ['#e9e8e3', '#cfc8b8', '#f7f4ee'],
  },
};

export const KIT_IDS = Object.keys(KITS) as KitId[];

/** The kit a screen preset implies (screens choose presets; presets map 1:1 to kits). */
export function kitForPreset(preset: ThemePresetName): ProviderKit {
  return Object.values(KITS).find((k) => k.preset === preset) ?? KITS.aicl;
}
