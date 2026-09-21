# Corpus method

How the component inventory was derived, and why it is built this way. The goal is
that anyone can re-run it and get the same answer.

## Source material

1,262 screenshots (1920×1325 PNG, ~744 MB) exported from Mobbin, covering four
shipping agentic-chat products:

| Product | Capture | Screens |
|---|---|---|
| Cofounder | Aug 2026 | 385 |
| Lovable | Jan 2026 | 339 |
| Manus | Mar 2026 | 288 |
| Devin | Aug 2026 | 250 |

The screenshots carry no metadata, no ordering guarantees, and no categories.
Building a component library from them required inferring all of that.

## What did not work, and why it matters

Two plausible approaches were tested and rejected. Both failures shaped the design.

### Sequential numbering does not encode flows

The files are numbered `0..N` per product, which invites treating consecutive
screens as steps in a journey. They are not. Measuring Jaccard similarity between
the OCR token sets of adjacent frames gives a mean of **0.36**, with only 1–2% of
adjacent pairs above 0.85:

| Product | mean adjacent similarity | near-duplicate pairs | hard cuts |
|---|---:|---:|---:|
| Lovable | 0.436 | 27 | 137 |
| Devin | 0.385 | 24 | 124 |
| Cofounder | 0.364 | 16 | 209 |
| Manus | 0.312 | 9 | 175 |

These are independent screens, not ordered captures. Two consequences: flows must be
reconstructed semantically rather than read off the filenames, and there is almost no
redundancy to strip, so every screen needs labelling.

### Lexical clustering cannot unify across products

TF-IDF clustering over OCR text produced 270 clusters that were almost entirely
**single-product**. The clusters keyed on demo content ("Elegant Portfolio",
"calendar-todo") rather than interface function.

Restricting features to interface chrome — short nav and button labels, positional
zone, layout regions — and reweighting toward capability signals still put only
**3% of screens** into cross-product clusters.

The reason is not a tuning problem. The products use different words for identical
concepts:

| Concept | Devin | Manus | Lovable | Cofounder |
|---|---|---|---|---|
| Past conversations | Sessions | Tasks | Projects | Tasks |
| Knowledge store | Wiki | Knowledge | — | Library |

No lexical method bridges that. **Only semantic labelling against a closed
vocabulary does**, which is what fixed the pipeline design: a model must map each
screen onto controlled terms, rather than terms being extracted from screens.

## Pipeline

Three stages, deliberately separated by cost and by whether judgement is required.

```
PNG ──(1) OCR──> text + boxes ──(2) VLM──> labels ──(3) aggregate──> report
     free, 5 min              ~50 min, local          instant
```

### Stage 1 — deterministic OCR

Apple's Vision framework (`VNRecognizeTextRequest`, accurate mode) over all 1,262
images: **5 min 24 s**, no GPU, no cost, no network. Emits text plus normalised
bounding boxes per block.

This stage also derives, with no model involved:
- **Layout regions** — left sidebar, top bar, right rail, bottom bar, from where
  text physically sits.
- **A capability census** — 35 regex probes over the OCR text.

Both feed stage 2 as prompt context. This measurably improved accuracy: unaided, the
VLM classified a three-region screen as `sidebar_main` and missed a chat composer
docked in the right rail. Geometry read from bounding boxes is far more reliable than
geometry inferred from pixels, so it is supplied rather than asked for.

### Stage 2 — VLM labelling against a closed taxonomy

Qwen2.5-VL-32B-Instruct-AWQ on 2× RTX 3090 (tensor-parallel), served by vLLM, with
guided JSON decoding against a fixed schema. Roughly 0.4 screens/sec, ~50 minutes for
the corpus, entirely local.

Every field is a closed enum. Free text is limited to three short fields
(`primary_action`, `flow_name`, `notes`) that are treated as hints, never as data to
aggregate. An open vocabulary would reintroduce exactly the synonym problem that
sank lexical clustering.

Three defects surfaced during validation and were fixed:

1. **Array padding.** The model filled arrays to `maxItems` by repeating the last
   value (`text_input` 18 times). Fixed by tightening limits, instructing against
   repetition, and de-duplicating client-side. `uniqueItems` is not usable —
   xgrammar rejects the schema outright with `Unimplemented keys: ["uniqueItems"]`.
2. **Incoherent state.** `ui_states` as an array reliably produced
   `["loading", "error", "success"]` for one screen. Replaced with a single-valued
   `dominant_state`.
3. **Crashes under concurrency.** vLLM's multimodal IPC cache raised
   `AssertionError: Expected a cached item for mm_hash=...` and returned HTTP 500.
   Fixed with `--mm-processor-cache-gb 0`.

The Mobbin watermark occupying the bottom ~8% of every export is cropped before
inference and filtered from OCR, or it would dominate term statistics across 1,262
identical occurrences.

### Stage 3 — aggregation

Counts each taxonomy term and, critically, **how many products it appears in**. That
spread drives the roadmap:

- **4/4 — universal.** A solved convention. Ships in v1.
- **3/4 — common.** Ships in v1 with clear defaults.
- **1/4 — niche.** One product's bet. Deferred.

## Accuracy

Spot-checked against ground truth. Structural fields (`shell_layout`,
`screen_archetype`, `dominant_state`) land around 75–85% after region hints were
added. Component lists are high-precision but under-complete: the model reports what
it is confident about and misses small chrome.

This is adequate because the output drives **tiering, not truth**. A component seen on
180 screens instead of 210 lands in the same tier. Conclusions that depend on exact
counts are not drawn, and the `notes` field is never aggregated.

Known residual error: a chat composer docked in a narrow right rail is still
sometimes missed, so `is_chat_surface` under-counts.

## Reproducing

```bash
# Stage 1 — OCR (macOS, no GPU)
swiftc -O tools/ocrbatch.swift -o tools/ocrbatch
find corpus -name '*.png' | sort > analysis/manifest.txt
tools/ocrbatch analysis/manifest.txt ocr/

# Stage 1b — structure and capability census
python3 tools/structure.py ocr analysis

# Stage 2 — VLM labels (needs the vLLM service in infra/)
docker compose -f infra/docker-compose.vllm.yml up -d
python3 tools/label.py --corpus corpus --ocr ocr --analysis analysis \
                       --out labels --concurrency 16

# Stage 3 — report
python3 tools/synthesize.py labels analysis
```

Stage 2 is the only stage needing a GPU, and it is resumable: each screen writes its
own file and existing results are skipped, so an interrupted run costs nothing.

## Licensing note

The screenshots are third-party product UIs collected via Mobbin and are **not**
redistributed with this repository. What ships is the derived, non-reproducing
analysis: taxonomy terms, counts, and structural observations. Anyone re-running the
pipeline supplies their own corpus.
