# 09 — arXiv Semantic Graph: 50k Papers, One Graph (DTU 02807, fall 2025)

Slug: `arxiv` · Fake domain: `arxiv.davids.net` · Archetype: **A** (interactive graph) + algorithm cards + Story rail
Status: spec agreed 2026-08-29; **built 2026-09-01**. CORRECTIONS found at build time:
the group repo (loayzapre/arxiv-semantic-graph) exists with the full package src (no
embedding shards; snapshot re-downloaded via kagglehub, now 240,061 papers post-filter).
The embedding run's real filters were min_year=2024 / min_words=200 -> 148,477 papers
(the spec's "50k / >=2010" was only the EDA cell); histogram k=6 but graph construction
k=50; and the REPORT chose tau=0.27 for usability over the modularity argmax 0.19
(Q=0.934, 133k singleton-ish communities) - the demo makes that tension the story.
hnswlib has no wheel for this machine -> exact brute-force k-NN on the 2,500 subsample
(same cosine metric, disclosed); t-SNE layout added at build; USE embeds abstracts only
(as embeddings.py did), so no abstracts ship.

## Summary

The Group 36 recommendation-system pipeline, live on a subsample: arXiv abstracts →
Universal Sentence Encoder embeddings → HNSW k-NN → distance threshold τ → semantic graph
→ Louvain communities → click-a-paper recommendations. Embeddings are precomputed; the
graph, τ thresholding, Louvain, and recommendations run in the browser so the reader can
feel the pipeline's one real knob (τ). Below the graph, three from-scratch algorithm cards
from the same course (A-priori, Girvan–Newman, Laplacian spectral) run live on tiny data.

## Source material

`demos/arxiv_semantic_graph_raw/`:

| File | Role | Notes |
|---|---|---|
| `project_demo.ipynb` (24 cells: EDA → USE embeddings (shards) → HNSW → k-NN distance histogram + `choose_tau_from_percentile` (`p_keep` 0.05–0.25) → graph per τ → Louvain (modularity table) → best τ → `recommend_random` / by id) | Pipeline definition; the build script mirrors it | Imports the group's `arxiv_semantic_graph` package (not in raw — build script reimplements the needed pieces) |
| `semantic_graph_project.pdf` (report, Group 36: Kasparas Marcinskas, S Taimur Hassan, M Abbas Khan, David Brin, Gabriel Loayza), `Project_Flowchart.pdf`, `Diagram.png` | Story + pipeline diagram + PDF link | Group project |
| `A-priori_freqPairs.py` (`get_frequent_itemsets`, `calculate_lift`) + `Groceries_dataset.csv` (38,765 rows) | Card A | David's |
| `SocialNetworkGraphs.py` (`calculate_betweenness_centrality` → Girvan–Newman, `compute_laplacian_eigenvalues`) | Cards B, C | David's |
| `Word Frequency.py` | Not shown (trivial) | — |

Data: arXiv metadata is public (Kaggle `arxiv-metadata-oai-snapshot`, CC0). The subsample
ships with titles, year, primary category, and 2-D layout coordinates — **not** abstracts.

## Stage

### 1. The graph (headline)
- Subsample: **2,500 papers** (stratified by primary category from the 50k/≥2010 set used
  in the notebook), USE embeddings computed at build, k = 6 nearest neighbours per node
  with cosine distances stored → `graph.json` (nodes + candidate edges, ≈ 15k edges,
  ~300 KB gz). Node positions pre-laid-out (UMAP or a long force run at build) so the
  page opens settled; a light force sim keeps it alive.
- **τ slider** (range = the notebook's histogram bins; ticks at the five `p_keep`
  candidates): edges with distance ≤ τ appear/disappear with a fade; edge count and
  isolated-node count update; a mini k-NN distance histogram above the slider shows where
  τ sits (Section 4 of the notebook, folded into this panel).
- **Louvain** runs in a Web Worker on the current edge set (TS port; 2.5k nodes is
  instant) → communities recolor with a smooth palette transition; modularity Q shown;
  a "best τ by modularity" button sweeps τ and animates to the argmax (Section 7 logic).
- Node hover: title, year, category; community label = top TF-IDF words from the
  titles in that community (computed at build per τ candidate; nearest candidate used).

### 2. Click-to-recommend
- Click a node → its k nearest neighbours pulse and connect with highlighted edges (the
  HNSW lookup, replayed from the stored neighbour list); a side list shows the
  recommendations with distance bars and a "same community?" tag (`recommend.py`
  behavior). "Random paper" button = `recommend_random`.
- Search box over titles to find a starting paper.

### 3. From-scratch algorithm cards (course topics)
- **A-priori (groceries):** min-support slider; baskets stream in, item counts fill,
  candidate pairs get pruned live (animated table); frequent pairs and their **lift**
  appear as a small bipartite chart. Runs on the real `Groceries_dataset.csv`
  (aggregated at build to baskets → ~50 KB).
- **Girvan–Newman:** a 30-node toy social graph; each step computes betweenness (edge
  widths animate to their score), removes the max edge (snaps), communities split with a
  color change; dendrogram grows on the right.
- **Laplacian spectral:** the same graph's Laplacian eigenvalues plotted; the spectral
  gap highlighted; eigenvector-2 sign coloring shows the cut. (Small symmetric eigensolver
  in TS — Jacobi is fine at n = 30.)

## Story rail

1. 02807 Computational Tools for Data Science; the group; the goal (paper
   recommendations without a citation graph).
2. Pipeline in one line each: USE → HNSW → τ → graph → Louvain → recommend (with
   `Diagram.png`).
3. The τ decision: percentile of the k-NN distance histogram, then modularity to pick.
4. What the communities looked like (2–3 examples from the report).
5. The weekly from-scratch algorithms and what they taught (support/lift; betweenness;
   spectra).
6. Report PDF link.

## Build pipeline (`scripts/build-arxiv.py`, run once; outputs committed)

- Pull the arXiv metadata snapshot (or use David's local copy), filter ≥ 2010, sample
  2,500 stratified by category; embed titles+abstracts with USE (TF Hub) → k-NN via
  `hnswlib` (k = 6) → distances; layout; per-τ-candidate Louvain labels + TF-IDF
  community words; write `graph.json`, `layout.json`, `communities.json`.
- Groceries → `baskets.json`; toy social graph → `social.json`.

## Source drawer

- Tabs: `project_demo.ipynb` (as .py extract), `A-priori_freqPairs.py`,
  `SocialNetworkGraphs.py`, the TS ports (`arxiv/louvain.ts`, `arxiv/apriori.ts`,
  `arxiv/girvan_newman.ts`), the build script.
- Footer: Group 36 members; arXiv metadata (Kaggle, CC0); USE (Google, TF Hub); hnswlib.

## Manifest (`content/arxiv/site.ts`)

- displayName "arXiv Semantic Graph", favicon "🕸️", accent `#8B5CF6`.
- deepLinks: `/demos/arxiv#graph`, `#recommend`, `#apriori`, `#girvan-newman`, `#spectral`.
- techStack: Python, TensorFlow Hub (USE), hnswlib, NetworkX/python-louvain, pandas,
  TypeScript, Web Workers.
- knowledgePanel facts: Course · Group (5) · Corpus (50k abstracts; 2.5k shown) ·
  Method (USE → HNSW → τ-graph → Louvain) · Algorithms from scratch (3).
- keywords: arxiv, semantic graph, recommendation, louvain, hnsw, universal sentence
  encoder, a-priori, girvan-newman, dtu.

## Attribution

- Group project; report names all five members. The `arxiv_semantic_graph` package was
  group code — the build script reimplements only what the demo needs and says so.
- Algorithm cards are David's course exercises.

## Out of scope

- Embedding in the browser (no USE in JS), the full 50k graph, abstracts text.

## Resolved questions (2026-08-30)

1. **Snapshot / embeddings:** check the group repo `loayzapre/arxiv-semantic-graph` first;
   if the shards aren't there, fetch the metadata from the arXiv website / the Kaggle
   arXiv dataset and embed a 2,500-paper subset at build (David, 2026-08-30).
2. David's part of the pipeline: not specified → the Story says "group project (Group 36,
   five members)" and describes the pipeline without assigning parts.
