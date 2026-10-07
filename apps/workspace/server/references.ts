/**
 * Research corpus of existing chat UIs (screenshots + labels), indexed lazily.
 * Layout: <root>/<folder>/<name>.png and <root>/_corpus/labels/<name>.json.
 * Personal research use: files are served from the corpus, never copied.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Type } from 'typebox';
import { defineTool } from '@earendil-works/pi-coding-agent';
import type { Relay } from './relay.ts';
import { defaultReferencesRoot } from './files.ts';

export interface RefEntry {
  /** Path relative to the references root. */
  ref: string;
  product: string;
  archetype: string;
  components: string[];
  chat: boolean;
  note: string;
}

export interface RefQuery {
  product?: string;
  archetype?: string;
  component?: string;
  text?: string;
  chatOnly?: boolean;
  limit?: number;
}

interface Label {
  screen_archetype?: string;
  components?: string[];
  is_chat_surface?: boolean;
  notes?: string;
  primary_action?: string;
  shell_layout?: string;
}

const productOf = (name: string): string => name.split(/\s+/)[0] ?? name;
const numberOf = (name: string): number => Number(/(\d+)(?:\.\w+)?$/.exec(name)?.[1] ?? 0);

export async function buildIndex(root: string): Promise<RefEntry[]> {
  const entries: RefEntry[] = [];
  let folders: string[] = [];
  try {
    folders = (await readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => d.name);
  } catch {
    return [];
  }
  for (const folder of folders.sort()) {
    const files = (await readdir(path.join(root, folder))).filter((f) => f.toLowerCase().endsWith('.png'));
    for (const file of files.sort((a, b) => numberOf(a) - numberOf(b))) {
      let label: Label = {};
      try {
        label = JSON.parse(await readFile(path.join(root, '_corpus', 'labels', file.replace(/\.png$/i, '.json')), 'utf8'));
      } catch {
        /* unlabeled image: still searchable by product */
      }
      entries.push({
        ref: `${folder}/${file}`,
        product: productOf(folder),
        archetype: label.screen_archetype ?? 'unknown',
        components: label.components ?? [],
        chat: label.is_chat_surface === true,
        note: [label.shell_layout, label.primary_action, label.notes].filter(Boolean).join(' · '),
      });
    }
  }
  return entries;
}

export interface References {
  search(query?: RefQuery): Promise<RefEntry[]>;
  get(ref: string): Promise<RefEntry | undefined>;
}

export function createReferences(root: string = defaultReferencesRoot()): References {
  let index: Promise<RefEntry[]> | null = null;
  const load = () => (index ??= buildIndex(root));
  return {
    async search(q = {}) {
      const all = await load();
      const product = q.product?.toLowerCase();
      const archetype = q.archetype?.toLowerCase();
      const component = q.component?.toLowerCase();
      const words = (q.text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
      const hits = all.filter((e) => {
        if (product && e.product.toLowerCase() !== product) return false;
        if (archetype && !e.archetype.toLowerCase().includes(archetype)) return false;
        if (component && !e.components.some((c) => c.toLowerCase() === component)) return false;
        if (q.chatOnly && !e.chat) return false;
        const hay = `${e.archetype} ${e.components.join(' ')} ${e.note}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      });
      return hits.slice(0, q.limit ?? 12).map((e) => ({ ...e, components: e.components.slice(0, 8) }));
    },
    async get(ref) {
      return (await load()).find((e) => e.ref === ref);
    },
  };
}

const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }], details: {} });

// Common values from the 1,262-screenshot corpus; ref_search also filters on any other value.
const PRODUCTS = 'Devin, Manus, Lovable, Cofounder';
const ARCHETYPES =
  'workspace_home, settings_appearance, onboarding_welcome, marketing_landing, code_editor, agent_tool_output, settings_account, modal_dialog, auth_signin, agent_task_running, agent_task_complete, preview_live';
const COMPONENTS =
  'sidebar_nav, session_list_item, message_list, composer_input, message_actions_bar, file_tree, workspace_switcher, user_menu, modal, text_input, card, table, code_block, plan_checklist, tool_call_card, tab_bar, dropdown, progress_bar, skeleton_loader';

export function createReferenceTools(relay: Relay, references: References = createReferences()) {
  const search = defineTool({
    name: 'ref_search',
    label: 'Search reference UIs',
    description:
      `Search a corpus of ~1,260 screenshots of existing AI/chat products. Returns ref, product, archetype, components, chat flag and a note. Filters (all optional, combinable): product (${PRODUCTS}); archetype (substring, e.g. ${ARCHETYPES}); component (exact, e.g. ${COMPONENTS}); text (words matched against archetype, components and notes); chatOnly. Place a result on the canvas with ref_place, then look at it with scratch_view ids.`,
    parameters: Type.Object({
      product: Type.Optional(Type.String()),
      archetype: Type.Optional(Type.String()),
      component: Type.Optional(Type.String()),
      text: Type.Optional(Type.String()),
      chatOnly: Type.Optional(Type.Boolean()),
      limit: Type.Optional(Type.Number({ description: 'default 12' })),
    }),
    async execute(_id, params) {
      return text(await references.search(params));
    },
  });

  const place = defineTool({
    name: 'ref_place',
    label: 'Place reference UI',
    description:
      'Place a reference screenshot (a `ref` from ref_search) on the canvas as an image. Returns the shape id; use scratch_view with ids=[id] to look at just it.',
    parameters: Type.Object({
      ref: Type.String(),
      x: Type.Optional(Type.Number()),
      y: Type.Optional(Type.Number()),
      w: Type.Optional(Type.Number({ description: 'default 640' })),
    }),
    async execute(_id, params, signal) {
      const entry = await references.get(params.ref);
      const alt = entry ? `${entry.product} ${entry.archetype}` : params.ref;
      const result = await relay.request(
        {
          op: 'add',
          shapes: [
            {
              kind: 'image',
              src: `/api/file?path=${encodeURIComponent(params.ref)}&crop=mobbin`,
              alt,
              x: params.x,
              y: params.y,
              w: params.w ?? 640,
            },
          ],
        },
        signal,
      );
      return text(result);
    },
  });

  return [search, place];
}
