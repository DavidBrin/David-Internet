import type { DemoMeta } from "@/lib/demos";

const RAW = "demos/arxiv_semantic_graph_raw";

const meta: DemoMeta = {
  slug: "arxiv",
  theme: { bg: "#f4f1fb", panel: "#e9e3f7" }, // violet — graph-paper night
  what: "a semantic graph of real arXiv papers with one knob: the similarity threshold tau",
  when: "DTU 02807 Computational Tools for Data Science, Group 36, fall 2025",
  story: [
    {
      title: "Recommendations without a citation graph",
      body:
        "For the 02807 group project, five students (Group 36) built a paper-recommendation system that never looks at citations: embed every abstract, connect papers whose embeddings sit close enough together, and let graph communities stand in for research topics. Query time becomes a graph lookup: the report's phrase for it was trading time complexity for memory complexity.",
    },
    {
      title: "The pipeline in one line each",
      body:
        "Stream the arXiv metadata snapshot (Kaggle, CC0) → filter to recent papers with substantial abstracts (year >= 2024, >= 200 words; 148,477 papers) → embed each abstract with Google's Universal Sentence Encoder into 512 dimensions → build an HNSW index for fast approximate nearest neighbours → threshold the k-NN distances at tau to get edges → run Louvain for communities → recommend a clicked paper's nearest neighbours, tagged 'significant' when they share its community.",
      anchor: "#graph",
    },
    {
      title: "The tau decision",
      body:
        "tau came from the k-NN distance histogram: pick candidate percentiles (keep 5-25% of neighbour links), then let modularity judge. The catch the project hit: modularity is highest at tau=0.19 (Q=0.934), but that graph is 133,006 communities, most of them a single paper. The report chose tau=0.27 instead: slightly lower Q, vastly more useful communities. The slider above lets you feel that trade-off on live data.",
      anchor: "#graph",
    },
    {
      title: "Click a paper",
      body:
        "Recommendation is the HNSW lookup replayed: the five nearest neighbours by cosine distance, each tagged with whether it landed in the same Louvain community ('significant', in the project's vocabulary). Every node links to its real paper on arxiv.org.",
      anchor: "#recommend",
    },
    {
      title: "The weekly from-scratch algorithms",
      body:
        "02807's exercises built the same machinery by hand. Three of David's are live here: A-priori frequent-pair mining with support and lift on 14,963 real grocery baskets; Girvan-Newman community detection by repeatedly cutting the highest-betweenness edge of the karate-club graph; and the spectral view of the same graph: Laplacian eigenvalues, the spectral gap, and the Fiedler vector's sign cut.",
      anchor: "#apriori",
    },
    {
      title: "Rebuilt for this page (2026-09-01)",
      body:
        "This page re-runs the group's real pipeline code path at build on a 2,500-paper stratified subsample (the same Kaggle snapshot, grown to 240,061 filtered papers by now), embedded with the same USE v4 model. Two disclosed substitutions: exact brute-force k-NN replaces hnswlib at this scale (same cosine metric, zero approximation), and node positions come from a build-time t-SNE (the original had no 2-D layout). The TS ports (Louvain, modularity, tau-from-percentile, A-priori, betweenness, a Jacobi eigensolver) were written with AI coding tools and are fixture-tested against the Python/NetworkX pipeline. The arxiv_semantic_graph package is the group's shared work; the story here doesn't assign parts.",
    },
  ],
  sources: [
    { name: "project_demo.py", path: "demos/arxiv_src/project_demo.py", lang: "python", note: "The group's demo notebook (code cells extracted): EDA, embeddings, HNSW, tau histogram, per-tau graphs, Louvain, recommendations." },
    { name: "A-priori_freqPairs.py", path: `${RAW}/A-priori_freqPairs.py`, lang: "python", note: "David's course exercise: from-scratch frequent itemsets + lift, then mlxtend on the groceries dataset." },
    { name: "SocialNetworkGraphs.py", path: `${RAW}/SocialNetworkGraphs.py`, lang: "python", note: "David's course exercise: betweenness centrality by hand, Girvan-Newman vs Louvain, Laplacian eigenvalues." },
    { name: "louvain.ts", path: "src/demos/arxiv/core/louvain.ts", lang: "ts", note: "TS Louvain + modularity, fixture-tested against the NetworkX run that built the shipped communities." },
    { name: "apriori.ts", path: "src/demos/arxiv/core/apriori.ts", lang: "ts", note: "TS port of David's A-priori functions, exact-matched on the real baskets." },
    { name: "graphalgos.ts", path: "src/demos/arxiv/core/graphalgos.ts", lang: "ts", note: "Betweenness (David's variant + Brandes edge betweenness), Girvan-Newman steps, Jacobi eigensolver." },
    { name: "prep script", path: "scripts/demos/arxiv_prep.py", lang: "python", note: "Build-time prep: streams the Kaggle snapshot, embeds 2,500 abstracts with USE v4, mirrors the pipeline per tau, writes assets + fixtures." },
  ],
  sourceFooter:
    "Group project, 02807, DTU, fall 2025. Report and pipeline by Group 36: Kasparas Marcinskas, S Taimur Hassan, M Abbas Khan, David Brin, Gabriel Loayza. Data: arXiv metadata snapshot (Kaggle, CC0). Embeddings: Universal Sentence Encoder v4 (Google, TF Hub). The algorithm cards are David's own course exercises.",
};

export default meta;
