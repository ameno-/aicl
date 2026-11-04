/**
 * Writes the catalog artifacts:
 *
 *   registry.json              shadcn index (no file contents)
 *   registry/r/<name>.json     one item, with file contents
 *   docs/components/<name>.md  the brief an agent reads
 *   docs/components.md         the contract + the catalog
 *   docs/llms.txt              every item, with the install command
 *
 * The contract (packages/react/src/contract.ts) is the source of truth for
 * slots and states. The catalog extras add files, usage, and dependencies.
 * A test fails when they disagree, or when a generated file drifts.
 *
 *   npm run build -w @aicl/react -w @aicl/cli
 *   node packages/cli/scripts/build-registry.mjs
 */

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { primitives, sharedSlots, allSlots, iconRoles } from '../../react/dist/contract.js';
import { iconDefaults } from '../../react/dist/icons.js';
import { buildCatalog } from '../dist/catalog.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');

const catalog = buildCatalog(primitives);

function table(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const rule = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
  return [head, rule, body].join('\n');
}

function shadcnItem(item, withContent) {
  const files = item.files.map((file) => {
    const out = { path: file.path, type: file.type };
    if (file.target) out.target = file.target;
    if (withContent) out.content = file.content;
    return out;
  });
  return {
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
    dependencies: [...item.dependencies],
    registryDependencies: [...item.registryDependencies],
    files,
    docs: item.docs,
    categories: [...item.categories],
  };
}

async function withContents(item) {
  const files = [];
  for (const file of item.files) {
    const abs = join(repo, file.path);
    const content = await readFile(abs, 'utf8');
    files.push({ ...file, content });
  }
  return { ...item, files };
}

function itemDoc(item) {
  const slots = item.slots?.length
    ? `\n## Slots\n\n${item.slots.map((s) => `- \`${s}\``).join('\n')}\n`
    : '';
  const states = item.states
    ? `\n## States\n\n${table(
        ['Attribute', 'Values'],
        Object.entries(item.states).map(([attr, values]) => [
          `\`${attr}\``,
          values.map((v) => `\`${v}\``).join(' '),
        ]),
      )}\n`
    : '';
  const files = item.files.map((f) => `- \`${f.path}\`${f.target ? ` → \`${f.target}\`` : ''}`).join('\n');
  const deps = item.registryDependencies.length
    ? item.registryDependencies.map((d) => `\`${d}\``).join(', ')
    : '_none_';
  return `# ${item.title}

${item.description}

**Type.** \`${item.type}\` · **Package.** \`${item.package}\` · **Category.** ${item.categories.join(', ')}

## Install

\`\`\`bash
npx aicl add ${item.name}
\`\`\`

The same item, in the shadcn registry format:

\`\`\`bash
npx shadcn@latest add ./registry/r/${item.name}.json
\`\`\`

## npm import

\`\`\`ts
${item.npmImport}
\`\`\`

## Usage

\`\`\`tsx
${item.usage}
\`\`\`
${slots}${states}
## Files

${files}

## Registry dependencies

${deps}

## npm dependencies

${item.dependencies.map((d) => `\`${d}\``).join(', ') || '_none_'}
`;
}

const components = `# The component contract

Every primitive publishes its slots and its states, and
\`packages/react/src/contract.ts\` is the single place that says what they
are. A **slot** is a \`data-aicl\` value: a stable name for a piece of the
DOM that a skin or a consumer's CSS can select on. A **state** is an
attribute and the values it can take.

The names are public API. Changing one is a breaking change.

The **catalog** is how a component is found, read, and installed. Every
item below has a page under \`docs/components/\` and an \`npx aicl add\`
command. A component is not incorporated until it is in this list.

${table(
  ['Item', 'Type', 'What it is for'],
  catalog.map((item) => [
    `[\`${item.name}\`](components/${item.name}.md)`,
    item.type.replace('registry:', ''),
    item.description,
  ]),
)}

## Primitives

${table(
  ['Primitive', 'What it is for', 'Slots'],
  primitives.map((p) => [p.name, p.summary, p.slots.map((s) => `\`${s}\``).join(' ')]),
)}

## Shared slots

${table(
  ['Slot', 'What it is for'],
  sharedSlots.slots.map((s) => [`\`${s}\``, sharedSlots.purpose[s] ?? '']),
)}

## States

${primitives
  .filter((p) => p.states)
  .map(
    (p) =>
      `### ${p.name}\n\n${table(
        ['Attribute', 'Values'],
        Object.entries(p.states ?? {}).map(([attr, values]) => [
          `\`${attr}\``,
          values.map((v) => `\`${v}\``).join(' '),
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

${allSlots()
  .map((s) => `- \`${s}\``)
  .join('\n')}
`;

const llms = `# AICL — an open-source UI component library for AI chat applications

> An open-source, framework-agnostic UI component library for AI chat
> applications. Derived from a survey of 1,262 screens of four shipping
> agentic-chat products.

## Install a component

\`\`\`bash
npx aicl add button
npx aicl add transcript composer
npx aicl list
npx aicl docs button
npx aicl doctor
\`\`\`

Or, in the shadcn registry format:

\`\`\`bash
npx shadcn@latest add ./registry/r/button.json
\`\`\`

Systems (\`@aicl/core\`, \`@aicl/styles\`, \`@aicl/motion\`) install as versioned
packages. Components install as source. The catalog is \`registry.json\`.

## Packages

- [@aicl/core](./packages/core/README.md): the message model, the part union,
  the ChatController state machine, the SSE transport. No DOM, no framework,
  no dependencies.
- [@aicl/react](./packages/react/README.md): the React adapter. Accessible,
  unstyled primitives that publish their state as \`data-aicl\` attributes,
  plus the component contract.
- [@aicl/server](./packages/server/README.md): \`createChatHandler\`. Turns an
  async iterable of StreamEvents into SSE frames.
- [@aicl/styles](./packages/styles/README.md): the token contract and the
  component surfaces. Optional. Skins live in \`themes/\`.
- [@aicl/motion](./packages/motion/README.md): the motion system. Three spring
  tiers, fluid hover, weight without reflow.
- [@aicl/fx](./packages/fx/README.md): optional animated, styled components.
- [@aicl/cli](./packages/cli/README.md): \`npx aicl\` — list, add, docs, doctor.

## Catalog

${catalog
  .map(
    (item) =>
      `- [${item.title}](./${item.docs}): ${item.description} \`npx aicl add ${item.name}\``,
  )
  .join('\n')}

## Docs

- [Design system](./docs/DESIGN-SYSTEM.md): the four layers, the token
  contract, the motion system, the skin model, the shipping model.
- [Library](./docs/LIBRARY.md): how the library is organised, and what is
  planned.
- [Inventory](./docs/INVENTORY.md): the deep inventory of LooseLeaf and
  Fluid Functionalism, and the shape vocabulary the plan is written in.
- [Roadmap](./docs/ROADMAP.md): what to create, expose and refactor, and
  in what order.
- [Component contract](./docs/components.md): every slot, every state, and
  every catalog item.
- [Decisions](./docs/DECISIONS.md): the binding decisions, D1–D18.
- [Adoption](./docs/ADOPTION.md): wiring AICL into an app, with every known
  sharp edge.
- [Architecture](./docs/ARCHITECTURE.md): the layer split and why.
- [Wire contract](./docs/api/README.md): the wire format and handler
  conventions.

## The contract in one paragraph

A primitive publishes slots (\`data-aicl="composer"\`) and states
(\`data-state="streaming"\`). Those names are public API. A skin is a
stylesheet that overrides the \`--aicl-*\` token contract and nothing else, so
it cannot change behaviour. The motion system replaces the contract's
easings with real springs. The component contract above is generated from
the implementation and a test fails when the two drift apart. The catalog
is how a component is found, documented, and installed; a component is not
incorporated until it is in the catalog.
`;

const outDir = join(repo, 'registry', 'r');
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await mkdir(join(repo, 'docs', 'components'), { recursive: true });

const indexItems = [];
for (const item of catalog) {
  const filled = await withContents(item);
  const json = shadcnItem(filled, true);
  // Keep AICL extras on the per-item file so `aicl docs` / `aicl add` can
  // print usage and the npm import without reading the markdown.
  json.package = item.package;
  json.usage = item.usage;
  json.npmImport = item.npmImport;
  if (item.slots) json.slots = [...item.slots];
  if (item.states) json.states = item.states;
  await writeFile(join(outDir, `${item.name}.json`), `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  await writeFile(join(repo, item.docs), itemDoc(item), 'utf8');
  indexItems.push(shadcnItem(item, false));
}

const registry = {
  $schema: 'https://ui.shadcn.com/schema/registry.json',
  name: 'aicl',
  homepage: 'https://github.com/ameno-/aicl',
  items: indexItems,
};

await writeFile(join(repo, 'registry.json'), `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
await writeFile(join(repo, 'docs', 'components.md'), components, 'utf8');
await writeFile(join(repo, 'docs', 'llms.txt'), llms, 'utf8');

const pages = (await readdir(join(repo, 'docs', 'components'))).filter((f) => f.endsWith('.md'));
console.log(
  `wrote ${catalog.length} items (${primitives.length} primitives, ${allSlots().length} slots, ${pages.length} docs)`,
);
