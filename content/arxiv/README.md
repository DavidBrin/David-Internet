# arXiv Semantic Graph: demo content

The `/demos/arxiv` page: the DTU 02807 Group 36 recommendation pipeline (fall 2025),
arXiv abstracts → USE embeddings → k-NN distances → threshold τ → semantic graph →
Louvain communities → recommendations, live on a 2,500-paper subsample, plus three
from-scratch course algorithms.

## What is on the page

1. **The graph** (`#graph`): 2,500 real papers (stratified by category from the same
   Kaggle snapshot the project used, filters year ≥ 2024 / abstract ≥ 200 words). Drag τ
   and edges fade in/out; Louvain (TS port) recolors communities live with modularity Q
   shown; a "best τ by modularity" sweep reproduces the project's Section 7 logic, and
   the panel tells the real ending: the report chose τ=0.27 for usability over the
   modularity argmax 0.19.
2. **Click-to-recommend** (`#recommend`): the five nearest neighbours by cosine
   distance with "significant" (same community) tags, `recommend.py` behavior replayed
   from shipped neighbour lists. Every node links to its arxiv.org/abs page.
3. **Algorithm cards**: David's course exercises, live in TS:
   A-priori with support/lift on 14,963 real grocery baskets (`#apriori`);
   Girvan–Newman on Zachary's karate club (`#girvan-newman`); Laplacian spectral view
   with a live Jacobi eigensolver (`#spectral`).

## Honesty notes

- The project's full run: 148,477 abstracts, hnswlib HNSW index, best-modularity τ=0.19
  (Q=0.934), report's final τ=0.27. The page's live numbers come from the 2,500-paper
  subsample and are labeled as such; the full-run numbers are shown alongside from the
  archived notebook outputs.
- Disclosed substitutions at build: **exact brute-force k-NN** instead of hnswlib (no
  wheel for this machine; same cosine metric, zero approximation at this scale) and a
  **build-time t-SNE layout** (the original pipeline had no 2-D layout).
- TS ports (Louvain + modularity, `choose_tau_from_percentile`, A-priori, David's
  betweenness, one-path-per-pair quirk included, Brandes edge betweenness, Jacobi
  eigensolver) were written with AI coding tools (2026-09-01) and fixture-tested against
  the Python/NetworkX pipeline (`tests/arxiv-core.test.ts`).
- Group work: the pipeline and report are by all five members of Group 36; the page does
  not assign individual parts (resolved 2026-08-30). The algorithm cards are David's own
  weekly exercises.

## Building

`pnpm sync-demos arxiv` runs `scripts/demos/arxiv_prep.py` (`py -3.12`; numpy, sklearn,
networkx, tensorflow + tensorflow-hub, Pillow). It streams the Kaggle
`Cornell-University/arxiv` snapshot from `.cache/kagglehub/` (download once with
`kagglehub`), embeds the subsample with USE v4 (cached in `.cache/tfhub/`), mirrors the
pipeline per τ, and writes `public/demos/arxiv/` + `tests/fixtures/arxiv-*.json`.
Outputs are committed; production builds need no Python and no snapshot.

## Attribution

Group 36, 02807 Computational Tools for Data Science, DTU, fall 2025: Kasparas
Marcinskas, S Taimur Hassan, M Abbas Khan, David Brin, Gabriel Loayza. Pipeline code:
github.com/loayzapre/arxiv-semantic-graph (the group's repo). Data: arXiv metadata
snapshot (Kaggle, CC0). Embeddings: Universal Sentence Encoder v4 (Google, TF Hub).
Groceries dataset: the course's `Groceries_dataset.csv`. Karate club: Zachary (1977).
