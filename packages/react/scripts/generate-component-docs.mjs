/**
 * Writes the component pages, the component index, the catalog index and
 * llms.txt.
 *
 * The contract and the incorporation records are the source of truth for
 * primitives. The discovered registry (`docs/catalog/items.json`) is the
 * source of truth for the sample repos. These files are their rendering.
 * They are committed so they can be read without running anything, and a
 * test fails when they drift.
 *
 *   node packages/react/scripts/generate-component-docs.mjs
 *
 * Build `@aicl/react` first. The script reads the compiled contract.
 */

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { disposition } from '../dist/catalog.js';
import { PLAYGROUND_INPUTS, STARTER_PROMPT } from '../dist/compose.js';
import { allSlots, iconRoles, primitives, sharedSlots } from '../dist/contract.js';
import { iconDefaults } from '../dist/icons.js';
import { SHAPES, incorporations } from '../dist/incorporation.js';
import { usages } from '../dist/usage.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const pagesDir = join(repo, 'docs', 'components');

const sources = JSON.parse(await readFile(join(repo, 'docs', 'catalog', 'sources.json'), 'utf8'));
const discovered = JSON.parse(await readFile(join(repo, 'docs', 'catalog', 'items.json'), 'utf8'));

function table(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const rule = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
  return [head, rule, body].join('\n');
}

function cell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function slug(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function repoLink(source, name) {
  const meta = sources[source];
  return `[${name}](${meta.repo}/blob/${meta.commit}/registry.json)`;
}

const byName = new Map(incorporations.map((record) => [record.name, record]));
const usageByName = new Map(usages.map((usage) => [usage.name, usage]));

function usageBlock(name) {
  const usage = usageByName.get(name);
  if (!usage) throw new Error(`${name} has no usage record`);
  const canvas = usage.canvas
    ? usage.canvas
    : 'This primitive is not a canvas input. It needs a conversation, a queue, or a portal the frame does not host. Use the example in the app.';
  return `## Usage

${usage.when}

${usage.not}

\`\`\`tsx
${usage.example.trim()}
\`\`\`

${canvas}
`;
}

function pageFor(primitive) {
  const record = byName.get(primitive.name);
  if (!record) throw new Error(`${primitive.name} has no incorporation record`);

  const shapes = record.shapes.map((id) => `**${id}** ${SHAPES[id]}`).join(', ');
  const motion =
    record.motion.tier === 'none'
      ? 'Still. This component does not animate.'
      : `**${record.motion.tier}** — ${record.motion.behaviors.map((behavior) => `\`${behavior}\``).join(', ')}`;
  const looseleaf = record.aligns.looseleaf.length
    ? record.aligns.looseleaf.map((name) => repoLink('looseleaf', name)).join(', ')
    : '— none. This one is AICL\'s.';
  const fluid = record.aligns.fluid.length
    ? record.aligns.fluid.map((name) => repoLink('fluid', name)).join(', ')
    : '— none. This one is AICL\'s.';
  const states = primitive.states
    ? table(
        ['Attribute', 'Values'],
        Object.entries(primitive.states).map(([attribute, values]) => [
          `\`${attribute}\``,
          values.map((value) => `\`${value}\``).join(' '),
        ]),
      )
    : 'This primitive publishes no state attributes.';

  return `# ${primitive.name}

${primitive.summary}

## Incorporation

${record.taken}

| | |
| --- | --- |
| Shapes | ${shapes} |
| Motion | ${motion} |
| LooseLeaf | ${looseleaf} |
| Fluid Functionalism | ${fluid} |
| Gallery | ${record.gallery ? `\`examples/slice-1\` section \`${record.gallery}\`` : '—'} |
| Tour | ${record.tour ? `stop \`${record.tour}\`` : '—'} |
| See it | ${record.see} |
| Source | ${record ? primitive.source.map((file) => `\`packages/react/src/${file}\``).join(', ') : ''} |

${usageBlock(primitive.name)}
## Slots

${primitive.slots.map((slot) => `- \`${slot}\``).join('\n')}

## States

${states}
`;
}

const decisions = discovered.items.map((item) => ({ item, decision: disposition(item) }));

function catalogIndex() {
  const counts = { incorporated: 0, candidate: 0, reference: 0, 'out-of-scope': 0, unclassified: 0 };
  for (const { decision } of decisions) counts[decision.status] += 1;

  const section = (status, title, intro) => {
    const rows = decisions
      .filter(({ decision }) => decision.status === status)
      .map(({ item, decision }) => {
        const where =
          status === 'incorporated'
            ? (decision.as ?? [])
                .map((name) => `[${name}](../components/${slug(name)}.md)`)
                .join(', ')
            : status === 'candidate'
              ? decision.wave
              : '';
        return [
          cell(item.source),
          `\`${item.name}\``,
          cell(item.type.replace('registry:', '')),
          cell(where),
          cell(decision.reason),
        ];
      });
    return `## ${title}\n\n${intro}\n\n${rows.length ? table(['Source', 'Item', 'Type', status === 'candidate' ? 'Wave' : 'AICL', 'Decision'], rows) : '_None._'}`;
  };

  const pins = Object.entries(sources)
    .map(([name, source]) => `- **${name}** [\`${source.commit.slice(0, 12)}\`](${source.repo}/commit/${source.commit})`)
    .join('\n');

  return `# The catalog

Every item in the pinned LooseLeaf and Fluid Functionalism registries, and
the decision AICL made about it. ${discovered.items.length} items.

${pins}

| Incorporated | Candidate | Reference | Out of scope |
| --- | --- | --- | --- |
| ${counts.incorporated} | ${counts.candidate} | ${counts.reference} | ${counts['out-of-scope']} |

An item is **incorporated** when a primitive names it. The primitive's own
page says what was taken. A **candidate** is a component a chat app will
want and AICL has not built. A **reference** is a system or a flavour we
study. **Out of scope** is a page, a drawing, or a paper toy this library
does not ship.

The policy lives in \`packages/react/src/catalog.ts\`. An item with no
decision fails the build.

${section('incorporated', 'Incorporated', 'These sample components have an AICL primitive.')}

${section('candidate', 'Candidates', 'Not built yet. The wave is the coordinate in [the roadmap](../ROADMAP.md).')}

${section('reference', 'Reference', 'Studied, not shipped as that item.')}

${section('out-of-scope', 'Out of scope', 'Named so they are not rediscovered as gaps.')}
`;
}

const components = `# The component contract

Every primitive publishes its slots and its states, and
\`packages/react/src/contract.ts\` is the single place that says what they
are. A **slot** is a \`data-aicl\` value: a stable name for a piece of the
DOM that a skin or a consumer's CSS can select on. A **state** is an
attribute and the values it can take.

Each primitive also has an incorporation record
(\`packages/react/src/incorporation.ts\`): the shapes it uses, the motion it
takes, and the sample components it was built against. The page linked from
the table is that record, rendered.

The names are public API. Changing one is a breaking change.

${table(
  ['Primitive', 'What it is for', 'Motion', 'Page'],
  primitives.map((primitive) => {
    const record = byName.get(primitive.name);
    const motion = record.motion.tier === 'none' ? 'still' : `${record.motion.tier}: ${record.motion.behaviors.join(', ')}`;
    return [primitive.name, primitive.summary, cell(motion), `[${slug(primitive.name)}](components/${slug(primitive.name)}.md)`];
  }),
)}

## Shared slots

${table(
  ['Slot', 'What it is for'],
  sharedSlots.slots.map((slot) => [`\`${slot}\``, sharedSlots.purpose[slot] ?? '']),
)}

## States

${primitives
  .filter((primitive) => primitive.states)
  .map(
    (primitive) =>
      `### ${primitive.name}\n\n${table(
        ['Attribute', 'Values'],
        Object.entries(primitive.states ?? {}).map(([attribute, values]) => [
          `\`${attribute}\``,
          values.map((value) => `\`${value}\``).join(' '),
        ]),
      )}`,
  )
  .join('\n\n')}

## Icon roles

A primitive never imports an icon. It asks for the role it plays, and the
role is resolved through \`IconProvider\`. The default set is Lucide; an app
that wants another set wraps its tree once and every primitive follows.

${table(
  ['Role', 'Default'],
  iconRoles.map((role) => [`\`${role}\``, `\`${iconDefaults[role].displayName ?? role}\``]),
)}

## Every slot

${allSlots().map((slot) => `- \`${slot}\``).join('\n')}
`;

const llms = `# AICL — an open-source UI component library for AI chat applications

> An open-source, framework-agnostic UI component library for AI chat
> applications. Derived from a survey of 1,262 screens of four shipping
> agentic-chat products.

## Packages

- [@aicl/core](./packages/core/README.md): the message model, the part union,
  the ChatController state machine, the SSE transport. No DOM, no framework,
  no dependencies.
- [@aicl/react](./packages/react/README.md): the React adapter. Accessible,
  unstyled primitives that publish their state as \`data-aicl\` attributes,
  plus the component contract and the incorporation records.
- [@aicl/server](./packages/server/README.md): \`createChatHandler\`. Turns an
  async iterable of StreamEvents into SSE frames.
- [@aicl/styles](./packages/styles/README.md): the token contract and the
  component surfaces. Optional. Skins live in \`themes/\`.
- [@aicl/motion](./packages/motion/README.md): the motion system. Three spring
  tiers, fluid hover, weight without reflow.

## Docs

- [Design system](./docs/DESIGN-SYSTEM.md): the four layers, the token
  contract, the motion system, the skin model, the shipping model.
- [Library](./docs/LIBRARY.md): how the library is organised, and what is
  planned.
- [How a component is incorporated](./docs/catalog/README.md): discover,
  decide, document, incorporate. Read this before adding a component.
- [Catalog](./docs/catalog/index.md): every LooseLeaf and Fluid Functionalism
  registry item, and the decision AICL made about it.
- [Inventory](./docs/INVENTORY.md): the deep inventory of LooseLeaf and
  Fluid Functionalism, and the shape vocabulary the plan is written in.
- [Roadmap](./docs/ROADMAP.md): what to create, expose and refactor, and
  in what order.
- [Component contract](./docs/components.md): every primitive, with its
  motion. One page per primitive lives in \`docs/components/\`.
- [Decisions](./docs/DECISIONS.md): the binding decisions, D1–D18.
- [Adoption](./docs/ADOPTION.md): wiring AICL into an app, with every known
  sharp edge.
- [Usage](./docs/USAGE.md): how to use a primitive, and how to prompt a
  screen on the canvas. Read this before composing UI.
- [Architecture](./docs/ARCHITECTURE.md): the layer split and why.
- [Wire contract](./docs/api/README.md): the wire format and handler
  conventions.

## Prompting a screen

The canvas playground is \`examples/slice-1\` at \`?view=canvas\`. A prompt
places only the inputs below, in the order it names them. A component the
library does not export is refused, not invented. A first visit opens
\`${STARTER_PROMPT}\`.

${PLAYGROUND_INPUTS.map((input) => `- \`${input.phrases.join('`, `')}\` places ${input.primitive}`).join('\n')}

## The contract in one paragraph

A primitive publishes slots (\`data-aicl="composer"\`) and states
(\`data-state="streaming"\`). Those names are public API. A skin is a
stylesheet that overrides the \`--aicl-*\` token contract and nothing else, so
it cannot change behaviour. The motion system replaces the contract's
easings with real springs. Every primitive has an incorporation record —
shapes, motion, and the sample components it aligns with — and a test fails
when a discovered sample component has no decision.
`;

await mkdir(pagesDir, { recursive: true });
const expected = new Set();
for (const primitive of primitives) {
  const name = `${slug(primitive.name)}.md`;
  expected.add(name);
  await writeFile(join(pagesDir, name), pageFor(primitive), 'utf8');
}
for (const file of await readdir(pagesDir)) {
  if (file.endsWith('.md') && !expected.has(file)) await rm(join(pagesDir, file));
}

await writeFile(join(repo, 'docs', 'components.md'), components, 'utf8');
await writeFile(join(repo, 'docs', 'catalog', 'index.md'), catalogIndex(), 'utf8');
await writeFile(join(repo, 'docs', 'llms.txt'), llms, 'utf8');

console.log(`wrote docs/components.md and ${expected.size} component pages`);
console.log(`wrote docs/catalog/index.md (${discovered.items.length} items)`);
console.log('wrote docs/llms.txt');
