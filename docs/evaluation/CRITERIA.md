# Evaluation criteria and comparison method

How implementation choices are judged across the four corpus products
(Cofounder, Devin, Lovable, Manus) on the way to `docs/BLUEPRINT.md`, where
each divergent choice gets exactly one target behavior.

This document is the shared method for every analysis in `docs/evaluation/`.
It is written to be repeatable: a second reader applying it to the same
evidence rows should reach the same recommendation.

Related: `docs/domains/` (inventories and contracts), `docs/DECISIONS.md`
(D1-D11), `_corpus/analysis/CAPABILITY_REPORT.md` (product-spread tiers).

## Inputs

| Input | Role |
|---|---|
| `docs/domains/<domain>.md` | Inventory, observed conventions, gaps, reference screenshots |
| `_corpus/labels/*.json` | 1,262 per-screen taxonomy labels |
| `_corpus/analysis/capabilities.json` | Product-spread counts behind the universal/common/niche tiers |
| `_corpus/ocr/*.json` | Deterministic text + geometry, for spot-verification |
| Corpus screenshots | Ground truth for spot-checks; paths in each domain spec |

## Evidence classes

Every claim in a matrix row carries one tag:

- `[observed]` — verified directly in a screenshot; cite the path.
- `[label]` — from VLM labels; cite count and product spread.
- `[label-floor]` — labels are a floor, not a census. The labeler
  under-detects components in narrow right rails and small chrome in dense
  screens. A zero count means "not detected", never "absent"; spot-check
  before ruling.
- `[inferred]` — reasoned from convention or from how the surface must work;
  not visible in the corpus. Keyboard behavior is the canonical case.

## The six criteria

1. **Convention strength** — how many of the four products do it (`[label]`
   from capabilities.json). 4/4 is a solved convention that trains users
   across products; deviating from it needs a clear win elsewhere. 3/4 is
   common. 2/4 or fewer is one product's bet.
2. **UX heuristics** — visibility of system status (streaming, pending,
   progress); user control and freedom (interrupt, edit, undo, dismiss);
   consistency with platform standards; error prevention and recovery;
   cognitive load (progressive disclosure, rollups over raw streams);
   latency perception (optimistic UI, skeletons, staged disclosure).
3. **Accessibility** — keyboard operability, focus management and
   preservation, semantic structure, live-region behavior for streaming,
   reduced motion. The corpus is pixels, so most a11y scoring is `[inferred]`;
   structural choices that make a11y easy (stable DOM order, single
   interactive root, state exposed as data attributes) score strong.
4. **Headless-library fit** — does the choice encode component-level behavior
   (belongs in the library) or app-level opinion (IA, branding, routing; does
   not)? Strong: behavior + `data-*` styling hooks, slots for content, no
   forced visuals. Weak: bakes in layout or one product's IA.
5. **Framework portability** — expressible in the framework-free core as
   state machines, stores, and plain events, with thin adapters. Weak: needs
   DOM measurement or framework-specific primitives in the behavior path;
   those belong in adapters or escape hatches, and portability says so.
6. **API ergonomics** — concept count per surface, sensible defaults with
   overrides, escape hatches over config flags, discriminated unions over
   stringly-typed shapes, forward compatibility with the parts-array model.

Not every criterion applies to every choice. Each matrix states which apply
and why the others do not.

## Reconciliation rule (how criteria combine)

- **Convention strength decides defaults.** A 4/4 convention ships as the
  default behavior. 3/4 ships as default with a clearly documented opt-out.
  2/4 or fewer ships opt-in, via escape hatch, or not at all.
- **UX heuristics and accessibility veto or adjust.** A convention that fails
  them is adjusted (different default, or documented deviation with
  rationale), not adopted blindly.
- **Headless fit, portability, and ergonomics decide the API shape** — how
  the behavior is exposed (props, slots, stores, events) — never whether the
  behavior exists.

## Scoring method

Per divergent choice (products differ):

1. State the choice as a question ("Where do message actions live?").
2. Matrix: one row per product's answer, every row evidence-tagged.
3. Score each option **strong / neutral / weak** on each applicable criterion.
4. Verdict: one paragraph naming the trade-off.
5. Recommendation: exactly **one** target behavior for the library, marked:
   - `[observed-default]` — a corpus convention adopted as the default
   - `[adjusted]` — a convention adopted with changes; name what and why
   - `[extrapolation]` — the corpus is silent; state what would falsify it
6. Named dissent: any product whose approach scores better on a criterion the
   recommendation trades away.

Settled conventions (4/4, no divergence) are recorded in a short table, not
matrixed.

## Output template for every analysis in `docs/evaluation/`

1. Scope and data (screens analysed, counts, caveats)
2. Settled conventions table
3. Divergent choices: one section per choice (matrix, scores, verdict,
   recommendation)
4. Target-behavior summary table (choice → recommendation → deciding criteria)
5. Gaps and extrapolations (what the corpus cannot decide, and what would
   falsify each extrapolation)

## Domain coverage (criteria applicability)

Each domain's central choices, so the criteria demonstrably apply everywhere:

- **transcript** — bubble alignment and identity, action bar placement and
  persistence, reasoning display, feedback shape, follow-up placement, date
  separators, scroll-to-bottom, branch affordance (corpus-silent)
- **composer** — placement slots (docked/hero/rail), send/stop morph,
  attachment lifecycle and progress, slash/mention affordances, suggestion
  chips, disabled/error states, autosize, IME handling (corpus-silent)
- **agent-execution** — plan display, tool-call disclosure and rollups,
  approval surface, interrupt semantics, progress and step surfaces
- **navigation** — list item anatomy, search behavior, grouping, neutral
  vocabulary
- **platform** — settings IA, modality choice, destructive confirmation,
  save modes, toast/banner discipline

## Non-goals

- Not scoring visual design (spacing, color, type): `@aicl/styles` territory.
- Not benchmarking performance: virtualization is a separate open question.
- Not deciding feature scope: the capability tiers (universal/common/niche)
  already did that; this method decides behavior and API for what is in
  scope.
