/**
 * Writes `docs/components.md` and `docs/llms.txt` from the component
 * contract.
 *
 * The contract is the source of truth; these files are its rendering. They
 * are committed so they can be read without running anything, and a test
 * fails when they drift from the contract — the same discipline the motion
 * stylesheet follows.
 *
 *   node packages/react/scripts/generate-component-docs.mjs
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { allSlots, iconRoles, primitives, sharedSlots } from '../dist/contract.js';
import { iconDefaults } from '../dist/icons.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');

function table(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const rule = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
  return [head, rule, body].join('\n');
}

const components = `# The component contract

Every primitive publishes its slots and its states, and
\`packages/react/src/contract.ts\` is the single place that says what they
are. A **slot** is a \`data-aicl\` value: a stable name for a piece of the
DOM that a skin or a consumer's CSS can select on. A **state** is an
attribute and the values it can take.

The names are public API. Changing one is a breaking change.

${table(
  ['Primitive', 'What it is for', 'Slots'],
  primitives.map((p) => [p.name, p.summary, p.slots.map((s) => `\`${s}\``).join(' ')])
)}

## Shared slots

${table(
  ['Slot', 'What it is for'],
  sharedSlots.slots.map((s) => [`\`${s}\``, sharedSlots.purpose[s] ?? ''])
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
        ])
      )}`
  )
  .join('\n\n')}

## Icon roles

A primitive never imports an icon. It asks for the role it plays, and the
role is resolved through \`IconProvider\`. The default set is Lucide; an app
that wants another set wraps its tree once and every primitive follows.

${table(
  ['Role', 'Default'],
  iconRoles.map((role) => [`\`${role}\``, `\`${iconDefaults[role].displayName ?? role}\``])
)}

## Every slot

${allSlots().map((s) => `- \`${s}\``).join('\n')}
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
  plus the component contract.
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
- [Component contract](./docs/components.md): every slot and every state.
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
the implementation and a test fails when the two drift apart.
`;

await writeFile(join(repo, 'docs', 'components.md'), components, 'utf8');
await writeFile(join(repo, 'docs', 'llms.txt'), llms, 'utf8');

console.log(`wrote docs/components.md (${primitives.length} primitives, ${allSlots().length} slots)`);
console.log('wrote docs/llms.txt');
