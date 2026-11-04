# How a component is incorporated

Four steps, and a test for each one. A component is not incorporated until
all four have happened. The sample libraries are LooseLeaf and Fluid
Functionalism. AICL does not copy their components. It records, for every
item they publish, what it did with that item.

## 1. Discover

The registries are the source of truth. The documentation sites describe a
subset.

`docs/catalog/sources.json` pins each repo to a commit. Discovery reads
`registry.json` at that commit and writes one row per item to
`docs/catalog/items.json`.

```bash
node packages/react/scripts/discover-registries.mjs --fetch
```

Without `--fetch` the script only checks that `items.json` was built from
the current pin. Move the pin and forget to rediscover, and it fails.

## 2. Decide

`disposition()` in `packages/react/src/catalog.ts` gives every discovered
item exactly one status:

| Status | Meaning |
|---|---|
| `incorporated` | An AICL primitive names this item in its incorporation record |
| `candidate` | A chat app will want it, and it is not built yet. It carries a roadmap wave |
| `reference` | A system, a flavour, or a shape we study and do not ship |
| `out-of-scope` | Marketing, auth, paper, and drawn art |

An item that matches no rule is `unclassified`. The catalog test fails, so a
component that appears in a future fetch cannot land silently.

Incorporating a sample component means adding its registry name to a
primitive's `aligns`. The decision follows the record. It is not a second
list to keep in sync.

## 3. Document

Every primitive has an incorporation record in
`packages/react/src/incorporation.ts`:

- the shapes it uses, from the vocabulary in `docs/INVENTORY.md`
- the motion tier and the named behaviors, or an explicit `none`
- the sample components it aligns with
- the gallery section and the tour stop, when it has them
- where a person goes to see it
- what was taken, and what stayed AICL's

How to *use* the primitive — the example, the boundary, the canvas phrase —
is the usage record in `packages/react/src/usage.ts`. The page renders that
too. [`docs/USAGE.md`](../USAGE.md) is the guide.

`packages/react/src/contract.ts` remains the source of truth for slots and
states. The record does not repeat them.

```bash
npm run build -w @aicl/react
node packages/react/scripts/generate-component-docs.mjs
```

That writes three renderings, and they are committed:

- `docs/components/<name>.md` — one page per primitive
- `docs/components.md` — the index, with the motion of each primitive
- `docs/catalog/index.md` — every discovered item and its decision

A test fails when a page drifts from the record, when a record cites a
sample component that was not discovered, or when the catalog index is
stale.

## 4. Incorporate

The primitive itself, in `@aicl/react`:

- a source file that publishes `data-aicl` slots and state attributes
- a contract entry whose slots match the source
- a test
- a surface in `@aicl/styles`, including the motion, with reduced motion
- a gallery section in `examples/slice-1`, and a tour stop when the
  component is one of the motions a person should see

The record's `gallery` and `tour` have to name a section and a stop that
exist. A record that points at a gallery nobody built fails the test.

## What this is not

- It is not a registry installer. `npx aicl add` is still the roadmap's
  wave 4.
- It is not permission to copy a component. The record says what was
  *taken* — a shape, a motion, a slot split — and the implementation is
  AICL's.
- It is not optional for the next component. A primitive without a record
  does not build.
