# `@aicl/cli`

Discover, document, and install AICL components.

```bash
npx aicl list
npx aicl add button tabs tooltip
npx aicl docs button
npx aicl doctor
```

A **catalog item** is a directory of source plus a manifest: its files, its
dependencies, the CSS it needs, and the slots and states it publishes. The
manifest is generated from the component contract, so the two cannot
disagree.

Systems (`@aicl/core`, `@aicl/styles`, `@aicl/motion`) still install as
versioned packages. Components install as **source** (D17): `aicl add`
copies the files into your repo and prints the one import you still owe.

The same items are published in the [shadcn registry format](https://ui.shadcn.com/docs/registry),
so a team already on shadcn can install them with the CLI they know:

```bash
npx shadcn@latest add ./registry/r/button.json
```

## Incorporating a component

A component is not incorporated until all of these exist. A drift test
fails the build otherwise.

1. Source in `packages/react` or `packages/fx` (or a system package).
2. A contract entry — slots and states — for a primitive; a catalog entry
   for everything.
3. Catalog extras: files, registry dependencies, a usage snippet.
4. Styles in `packages/styles/src/components.css` if it is headless.
5. A test in the same package.
6. A gallery or tour stop, so a person can see it.
7. `node packages/cli/scripts/build-registry.mjs` — writes the item JSON,
   the doc page, and the `llms.txt` line.

## Commands

| | |
|---|---|
| `list` | the catalog. `--type ui\|lib\|hook\|theme`, `--json` |
| `add <item…>` | copy source, resolve registry dependencies. `--dry-run`, `--force`, `--cwd` |
| `docs <item>` | print the generated brief |
| `doctor` | read this directory's `package.json`; never caches a verdict |

Copied files keep the relative imports they have in this repo: a primitive
lands in `components/aicl/` next to `icons.tsx` and `useReadable.ts`; an
`@aicl/fx` item lands under `components/aicl/fx/` next to `lib/cn.ts`.
`aicl add` also prints the npm import, which is still how protocol and
system packages (`@aicl/core`, `@aicl/styles`, `@aicl/motion`) install.

The CLI reads `registry.json` from the AICL checkout it lives in. The
packages are unpublished, so that is the only source.
