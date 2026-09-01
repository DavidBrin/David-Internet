import type { SiteManifest } from "@/lib/types";

const site: SiteManifest = {
  project: "arxiv",
  kind: "demo",
  displayName: "arXiv Semantic Graph",
  fakeDomain: "arxiv.davids.net",
  liveUrl: "/demos/arxiv",
  tagline: "148k arXiv abstracts became one semantic graph: feel the pipeline's one real knob, live on 2,500 of them.",
  description:
    "Interactive demo of the DTU 02807 Group 36 recommendation system: arXiv abstracts embedded with Google's Universal Sentence Encoder, k-nearest-neighbour cosine distances, a global threshold τ that decides when two papers are 'semantically similar', Louvain communities, and click-a-paper recommendations. The page runs the real pipeline on a 2,500-paper stratified subsample embedded at build time. Drag τ and watch edges appear, communities merge, and modularity fall exactly the way the full 148,477-paper run did, including the project's real tension: modularity says τ=0.19, usability said τ=0.27. Below the graph, three from-scratch course algorithms (A-priori on 15k real grocery baskets, Girvan–Newman, Laplacian spectral clustering) run live in TypeScript.",
  accentColor: "#8B5CF6",
  favicon: "🕸️",
  techStack: [
    "Python", "TensorFlow Hub (USE)", "hnswlib", "NetworkX", "pandas",
    "TypeScript", "Web Workers", "Canvas/SVG",
  ],
  needsDatabase: false,
  deepLinks: [
    {
      path: "#graph",
      title: "The τ slider",
      snippet:
        "2,500 real papers as a force graph: drag the distance threshold τ and edges fade in, Louvain recolors the communities live, and the modularity readout shows why the argmax isn't the answer.",
      keywords: ["semantic graph", "tau threshold", "louvain", "modularity", "communities", "knn histogram"],
    },
    {
      path: "#recommend",
      title: "Click-to-recommend",
      snippet:
        "Click any paper and its five nearest neighbours pulse in, ranked by cosine distance with a 'same community' significance tag, the project's recommend.py behavior, replayed.",
      keywords: ["recommendation", "nearest neighbours", "cosine distance", "significant", "arxiv paper"],
    },
    {
      path: "#apriori",
      title: "A-priori on real groceries",
      snippet:
        "14,963 real shopping baskets stream through David's from-scratch A-priori: counts fill, candidate pairs get pruned by min-support, and surviving pairs rank by lift.",
      keywords: ["a-priori", "frequent itemsets", "market basket", "support", "lift", "association rules"],
    },
    {
      path: "#girvan-newman",
      title: "Girvan–Newman",
      snippet:
        "Zachary's karate club splits live: edge betweenness animates onto the edges, the max edge snaps, and the dendrogram grows until the famous two factions appear.",
      keywords: ["girvan-newman", "betweenness centrality", "community detection", "karate club", "dendrogram"],
    },
    {
      path: "#spectral",
      title: "Laplacian spectral",
      snippet:
        "The same graph's Laplacian eigenvalues from a live Jacobi eigensolver, the spectral gap highlighted, and the Fiedler vector's signs coloring the cut.",
      keywords: ["laplacian", "eigenvalues", "spectral clustering", "fiedler vector", "spectral gap"],
    },
  ],
  images: [],
  videos: [],
  keywords: [
    "arxiv", "semantic graph", "recommendation system", "louvain", "hnsw",
    "universal sentence encoder", "a-priori", "girvan-newman", "spectral", "dtu",
  ],
  knowledgePanel: {
    type: "Group project demo",
    facts: {
      Course: "02807 Computational Tools for Data Science, DTU, fall 2025",
      Group: "Group 36, five members (report names all)",
      Corpus: "arXiv metadata (Kaggle, CC0): 148,477 abstracts in the project run; 2,500 shown live",
      Method: "USE embeddings → HNSW k-NN → τ threshold → semantic graph → Louvain → recommend",
      "From scratch": "A-priori (real groceries), Girvan–Newman, Laplacian spectral: course exercises",
    },
  },
  docs: { readme: true, spec: false, decisions: false },
};

export default site;
