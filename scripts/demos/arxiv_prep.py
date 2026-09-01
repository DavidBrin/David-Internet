"""arXiv Semantic Graph demo prep (DTU 02807 Group 36, fall 2025).

Run via  pnpm sync-demos arxiv  (scripts/demos/arxiv.ts spawns this with py -3.12).

    py -3.12 scripts/demos/arxiv_prep.py <rawDir> <outDir> <repoRoot>

Mirrors the group pipeline (github.com/loayzapre/arxiv-semantic-graph) on a
2,500-paper stratified subsample of the same corpus:

  arXiv metadata snapshot (Kaggle, CC0)  ->  filter update_date year >= 2024,
  abstract >= 200 words (the project's embedding filters)  ->  stratified sample
  by top-level category  ->  USE v4 abstract embeddings (float16, like the
  project's shards)  ->  k-NN cosine distances  ->  k=6 distance histogram +
  choose_tau_from_percentile  ->  per-tau graphs + Louvain (networkx, seed 42,
  exactly the group's graph_clustering.run_louvain settings)  ->  t-SNE layout.

Honest deviations, disclosed on the page:
  * The project ran hnswlib (approximate k-NN) over 148,477 papers; at 2,500
    papers this prep uses EXACT brute-force cosine k-NN (hnswlib has no wheel
    for this machine). Same metric, no approximation error.
  * Node layout is t-SNE at build; the original had no 2-D layout.

Also builds the from-scratch algorithm card data (groceries baskets, karate
club graph) and fixtures computed with David's own course functions.

Env: ARXIV_SNAPSHOT (path to arxiv-metadata-oai-snapshot.json),
     ARXIV_PREP_ONLY (sample|graph|cards|assets), ARXIV_CACHE (embedding cache dir).
ASCII-only prints (cp1252 console).
"""
import csv
import json
import os
import sys
from collections import defaultdict
from itertools import combinations
from pathlib import Path

import numpy as np

RAW = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("demos/arxiv_semantic_graph_raw")
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("public/demos/arxiv")
REPO = Path(sys.argv[3]) if len(sys.argv) > 3 else Path(".")
FIXTURES = REPO / "tests" / "fixtures"
CACHE = Path(os.environ.get("ARXIV_CACHE", REPO / ".cache" / "arxiv_prep"))
SNAPSHOT = Path(
    os.environ.get(
        "ARXIV_SNAPSHOT",
        REPO
        / ".cache"
        / "kagglehub"
        / "datasets"
        / "Cornell-University"
        / "arxiv"
        / "versions"
        / "301"
        / "arxiv-metadata-oai-snapshot.json",
    )
)
OUT.mkdir(parents=True, exist_ok=True)
FIXTURES.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)

N_SAMPLE = 2500
MIN_YEAR = 2024  # the group's embedding run: min_year=2024
MIN_WORDS = 200  # ... min_words=200
K_HIST = 6  # 1 self + 5 neighbours, notebook Section 4
K_SEARCH = 50  # graph construction k, notebook Section 5
TAU_MAX = 0.36  # slider headroom past the report's tau=0.27
PKEEPS = [0.05, 0.10, 0.15, 0.20, 0.25]


def log(msg):
    print(f"[arxiv_prep] {msg}")


def save_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    log(f"wrote {path} ({path.stat().st_size // 1024} KB)")


# --------------------------------------------------------------------------
# 1) Stream + stratified sample
# --------------------------------------------------------------------------
def top_group(primary_cat: str) -> str:
    return primary_cat.split(".")[0]


def sample_papers():
    """Single streaming pass with per-group reservoirs, then proportional quotas."""
    cache = CACHE / "sample.json"
    if cache.exists():
        data = json.load(open(cache, encoding="utf-8"))
        log(f"sample: cache hit ({len(data['papers'])} papers)")
        return data

    rng = np.random.default_rng(42)
    RESERVOIR = 2600  # >= N_SAMPLE so no group's quota is ever capped
    reservoirs = defaultdict(list)  # group -> [(id, title, year, cat, abstract)]
    counts = defaultdict(int)
    seen = defaultdict(int)
    total = 0

    log(f"sample: streaming {SNAPSHOT.name} (filters: year>={MIN_YEAR}, abstract>={MIN_WORDS} words)")
    with open(SNAPSHOT, "r", encoding="utf-8") as f:
        for line in f:
            try:
                p = json.loads(line)
                y = int((p.get("update_date") or "0-0-0").split("-")[0])
                if y < MIN_YEAR:
                    continue
                a = (p.get("abstract") or "").strip()
                if not a or len(a.split()) < MIN_WORDS:
                    continue
                t = " ".join((p.get("title") or "").split())
                cat = (p.get("categories") or "unknown").split()[0]
            except Exception:
                continue
            g = top_group(cat)
            counts[g] += 1
            seen[g] += 1
            total += 1
            rec = (p.get("id"), t, y, cat, a)
            r = reservoirs[g]
            if len(r) < RESERVOIR:
                r.append(rec)
            else:
                j = int(rng.integers(0, seen[g]))
                if j < RESERVOIR:
                    r[j] = rec
            if total % 100000 == 0:
                log(f"  filtered-in {total} papers so far")

    log(f"sample: corpus after filters = {total} papers in {len(counts)} groups")

    # proportional quotas (largest remainder), capped by reservoir size
    groups = sorted(counts, key=lambda g: -counts[g])
    raw_q = {g: N_SAMPLE * counts[g] / total for g in groups}
    quotas = {g: int(raw_q[g]) for g in groups}
    rem = N_SAMPLE - sum(quotas.values())
    for g in sorted(groups, key=lambda g: raw_q[g] - quotas[g], reverse=True)[:rem]:
        quotas[g] += 1
    papers = []
    for g in groups:
        take = min(quotas[g], len(reservoirs[g]))
        idx = rng.choice(len(reservoirs[g]), size=take, replace=False)
        papers.extend(reservoirs[g][i] for i in idx)
    rng.shuffle(papers)

    data = {
        "corpusTotal": total,
        "groupCounts": {g: counts[g] for g in groups},
        "papers": [
            {"id": pid, "title": t, "year": y, "cat": cat, "abstract": a}
            for pid, t, y, cat, a in papers
        ],
    }
    with open(cache, "w", encoding="utf-8") as f:
        json.dump(data, f)
    log(f"sample: kept {len(papers)} papers ({len([g for g in groups if quotas[g]>0])} groups)")
    return data


# --------------------------------------------------------------------------
# 2) USE embeddings (float16, like the project's shards)
# --------------------------------------------------------------------------
def embed(papers):
    cache = CACHE / "emb.npy"
    if cache.exists():
        emb = np.load(cache)
        if emb.shape[0] == len(papers):
            log(f"embed: cache hit {emb.shape}")
            return emb
    os.environ.setdefault("TFHUB_CACHE_DIR", str(REPO / ".cache" / "tfhub"))
    os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
    import tensorflow_hub as hub

    log("embed: loading Universal Sentence Encoder v4...")
    use = hub.load("https://tfhub.dev/google/universal-sentence-encoder/4")
    out = []
    texts = [p["abstract"] for p in papers]
    for i in range(0, len(texts), 64):
        out.append(use(texts[i : i + 64]).numpy())
        if (i // 64) % 10 == 0:
            log(f"  embedded {i}/{len(texts)}")
    emb = np.vstack(out).astype(np.float16)  # project stored shards as float16
    np.save(cache, emb)
    log(f"embed: {emb.shape} float16")
    return emb


# --------------------------------------------------------------------------
# 3) Exact k-NN + histogram + tau + graphs + Louvain + layout
# --------------------------------------------------------------------------
def choose_tau_from_percentile(bins, global_hist, pkeep):
    """Exact port of the group's graph.py."""
    cdf = np.cumsum(global_hist) / max(global_hist.sum(), 1)
    idx = int(np.searchsorted(cdf, pkeep))
    return float(bins[min(idx + 1, len(bins) - 1)])


def prep_graph(sample, emb):
    import networkx as nx
    from networkx.algorithms.community import louvain_communities
    from networkx.algorithms.community.quality import modularity

    papers = sample["papers"]
    n = len(papers)
    X = emb.astype(np.float32)
    X /= np.linalg.norm(X, axis=1, keepdims=True)
    D = 1.0 - X @ X.T
    np.fill_diagonal(D, 0.0)
    order = np.argsort(D, axis=1)

    # k=6 histogram (self + 5 neighbours, skip self), the notebook's Section 4
    nd = np.take_along_axis(D, order[:, 1:K_HIST], axis=1)
    bins = np.linspace(0.0, 1.2, 121)
    global_hist, _ = np.histogram(nd.ravel(), bins=bins)
    taus = [(p, choose_tau_from_percentile(bins, global_hist, p)) for p in PKEEPS]
    log(f"tau candidates: {taus}")

    # k=50 candidate edges with dist <= TAU_MAX (src < dst dedupe, as graph.py).
    # Distances are rounded to 4dp FIRST - the page ships and thresholds the
    # rounded values, so fixtures must be built from the same numbers
    # (quantize-then-fixture).
    edges = {}
    for i in range(n):
        for j_idx in range(1, K_SEARCH + 1):
            j = int(order[i, j_idx])
            d = round(float(D[i, j]), 4)
            if d <= TAU_MAX:
                a, b = (i, j) if i < j else (j, i)
                if a != b and (a, b) not in edges:
                    edges[(a, b)] = d
    edge_list = sorted((a, b, d) for (a, b), d in edges.items())
    log(f"candidate edges (d<={TAU_MAX}): {len(edge_list)}")

    # Louvain per tau (exact settings of the group's run_louvain: weight, seed=42)
    tau_eval = sorted(set([round(t, 3) for _, t in taus] + [0.27]))
    table = []
    labels_by_tau = {}
    for tau in tau_eval:
        G = nx.Graph()
        G.add_nodes_from(range(n))
        for a, b, d in edge_list:
            if d <= tau:
                G.add_edge(a, b, weight=1.0 - d)
        if G.number_of_edges() == 0:
            continue
        comms = louvain_communities(G, weight="weight", seed=42)
        mod = modularity(G, comms, weight="weight")
        labels = np.zeros(n, int)
        for ci, nodes in enumerate(comms):
            for node in nodes:
                labels[node] = ci
        labels_by_tau[tau] = labels
        deg = dict(G.degree())
        iso = sum(1 for v in deg.values() if v == 0)
        table.append(
            {
                "tau": tau,
                "pkeep": next((p for p, t in taus if round(t, 3) == tau), None),
                "edges": G.number_of_edges(),
                "avgDegree": round(2 * G.number_of_edges() / n, 3),
                "isolated": iso,
                "modularity": round(float(mod), 4),
                "communities": len(comms),
            }
        )
        log(f"  tau={tau}: edges={G.number_of_edges()} Q={mod:.4f} comms={len(comms)}")

    # TF-IDF community words at the report's tau=0.27 (titles, like the spec)
    from sklearn.feature_extraction.text import TfidfVectorizer

    lab27 = labels_by_tau[0.27]
    docs, comm_ids = [], []
    for c in np.unique(lab27):
        members = np.where(lab27 == c)[0]
        if len(members) >= 8:
            docs.append(" ".join(papers[m]["title"] for m in members))
            comm_ids.append(int(c))
    words = {}
    if docs:
        tv = TfidfVectorizer(stop_words="english", max_features=6000, token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z-]+\b")
        M = tv.fit_transform(docs)
        vocab = np.array(tv.get_feature_names_out())
        for row, c in enumerate(comm_ids):
            arr = M[row].toarray().ravel()
            top = arr.argsort()[::-1][:4]
            words[str(c)] = [vocab[t] for t in top if arr[t] > 0]

    # t-SNE layout (build-time only; the original project had no 2-D layout)
    from sklearn.manifold import TSNE

    xy = TSNE(n_components=2, init="pca", random_state=42, perplexity=30).fit_transform(
        X.astype(np.float64)
    )
    xy -= xy.min(axis=0)
    xy /= xy.max(axis=0)

    groups = sorted({top_group(p["cat"]) for p in papers})
    save_json(  # noqa: distances already rounded above
        OUT / "graph.json",
        {
            "nodes": [
                {
                    "id": p["id"],
                    "t": p["title"][:160],
                    "y": p["year"],
                    "c": p["cat"],
                    "g": groups.index(top_group(p["cat"])),
                    "x": round(float(xy[i, 0]), 4),
                    "z": round(float(xy[i, 1]), 4),
                }
                for i, p in enumerate(papers)
            ],
            "groups": groups,
            "edges": [[a, b, d] for a, b, d in edge_list],
            "kSearch": K_SEARCH,
            "tauMax": TAU_MAX,
        },
    )
    # neighbour lists for the recommend panel (k=5 like recommend.py's default)
    save_json(
        OUT / "neighbors.json",
        {
            "k": 5,
            "list": [
                [[int(order[i, j]), round(float(D[i, order[i, j]]), 4)] for j in range(1, 6)]
                for i in range(n)
            ],
        },
    )
    save_json(
        OUT / "hist.json",
        {
            "bins": np.round(bins, 3).tolist(),
            "counts": global_hist.tolist(),
            "tauCandidates": [{"pkeep": p, "tau": round(t, 3)} for p, t in taus],
            "tauTable": table,
            "sample": {
                "n": n,
                "corpusTotal": sample["corpusTotal"],
                "filters": {"minYear": MIN_YEAR, "minWords": MIN_WORDS},
            },
            "fullRun": {
                "papers": 148477,
                "tauCandidates": [
                    {"pkeep": 0.05, "tau": 0.19},
                    {"pkeep": 0.10, "tau": 0.21},
                    {"pkeep": 0.15, "tau": 0.22},
                    {"pkeep": 0.20, "tau": 0.22},
                    {"pkeep": 0.25, "tau": 0.23},
                ],
                "louvain": [
                    {"tau": 0.19, "modularity": 0.9343, "communities": 133006},
                    {"tau": 0.21, "modularity": 0.8682, "communities": 110964},
                    {"tau": 0.22, "modularity": 0.8331, "communities": 96650},
                    {"tau": 0.23, "modularity": 0.8049, "communities": 81225},
                ],
                "reportTau": 0.27,
                "note": (
                    "Numbers from the group's archived 148,477-paper run (project_demo.ipynb); "
                    "the report chose tau=0.27 for usability over the modularity argmax 0.19."
                ),
            },
        },
    )
    save_json(
        OUT / "communities.json",
        {
            "taus": [float(t) for t in labels_by_tau],
            "labels": {str(t): labels_by_tau[t].tolist() for t in labels_by_tau},
            "words27": words,
        },
    )

    # fixtures ---------------------------------------------------------------
    save_json(
        FIXTURES / "arxiv-tau.json",
        {
            "bins": np.round(bins, 3).tolist(),
            "counts": global_hist.tolist(),
            "expected": [{"pkeep": p, "tau": round(t, 3)} for p, t in taus],
        },
    )
    # modularity of the shipped tau=0.27 partition, recomputable in TS from graph.json
    row27 = next(r for r in table if r["tau"] == 0.27)
    save_json(
        FIXTURES / "arxiv-louvain.json",
        {
            "tau": 0.27,
            "modularity": row27["modularity"],
            "communities": row27["communities"],
            "edges": row27["edges"],
            "note": "TS modularity(labels from communities.json, edges from graph.json at tau) must match; TS louvain must reach within 0.02 of this Q on the same graph.",
        },
    )
    log("graph step done")


# --------------------------------------------------------------------------
# 4) Algorithm cards: groceries + karate, with David's-course-code fixtures
# --------------------------------------------------------------------------
def get_frequent_itemsets(baskets, min_support):
    """David's A-priori_freqPairs.py, verbatim logic."""
    item_count = defaultdict(int)
    for basket in baskets:
        for item in basket:
            item_count[item] += 1
    frequent_items = {i for i, c in item_count.items() if c >= min_support}
    pair_count = defaultdict(int)
    for basket in baskets:
        filtered = [i for i in basket if i in frequent_items]
        for a, b in combinations(filtered, 2):
            pair = tuple(sorted((a, b)))
            pair_count[pair] += 1
    frequent_pairs = {p: c for p, c in pair_count.items() if c >= min_support}
    return frequent_items, frequent_pairs, dict(item_count)


def calculate_lift(item_count, frequent_pairs, total_baskets):
    lift = {}
    for (a, b), pc in frequent_pairs.items():
        pa = item_count[a] / total_baskets
        pb = item_count[b] / total_baskets
        pab = pc / total_baskets
        lift[(a, b)] = pab / (pa * pb) if pa * pb > 0 else 0
    return lift


def calculate_node_betweenness(G):
    """David's SocialNetworkGraphs.py calculate_betweenness_centrality, verbatim logic."""
    import networkx as nx

    shortest_paths = dict(nx.all_pairs_shortest_path_length(G))
    bc = {node: 0 for node in G.nodes()}
    for source in shortest_paths:
        for target in shortest_paths[source]:
            if source != target:
                path = nx.shortest_path(G, source=source, target=target)
                for node in path[1:-1]:
                    bc[node] += 1
    nn = len(G.nodes())
    for node in bc:
        bc[node] /= (nn - 1) * (nn - 2) / 2
    return bc


def prep_cards():
    import networkx as nx

    # ---- groceries: aggregate to (member, date) baskets --------------------
    baskets_map = defaultdict(set)
    with open(RAW / "Groceries_dataset.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            baskets_map[(row["Member_number"], row["Date"])].add(row["itemDescription"])
    baskets = [sorted(b) for b in baskets_map.values()]
    baskets.sort()  # deterministic order
    items = sorted({i for b in baskets for i in b})
    idx = {it: k for k, it in enumerate(items)}
    save_json(
        OUT / "baskets.json",
        {
            "items": items,
            "baskets": [[idx[i] for i in b] for b in baskets],
            "note": "Groceries_dataset.csv aggregated to one basket per (member, date); 38,765 rows.",
        },
    )
    log(f"cards: {len(baskets)} baskets, {len(items)} distinct items")

    fi, fp, item_count = get_frequent_itemsets(baskets, 25)
    lifts = calculate_lift(item_count, fp, len(baskets))
    top = sorted(fp.items(), key=lambda kv: -kv[1])[:12]
    save_json(
        FIXTURES / "arxiv-apriori.json",
        {
            "minSupport": 25,
            "totalBaskets": len(baskets),
            "frequentItems": len(fi),
            "frequentPairs": len(fp),
            "topPairs": [
                {"a": a, "b": b, "count": c, "lift": round(lifts[(a, b)], 6)} for (a, b), c in top
            ],
        },
    )

    # ---- karate club graph for Girvan-Newman + spectral cards --------------
    # Rebuild the graph from the exact edge list we ship, so the adjacency
    # *insertion order* (which decides nx.shortest_path's choice among equal
    # shortest paths) is identical to what the TS side reconstructs.
    kc_edges = [[int(a), int(b)] for a, b in nx.karate_club_graph().edges()]
    G = nx.Graph()
    G.add_nodes_from(range(34))
    G.add_edges_from(kc_edges)
    pos = nx.spring_layout(G, seed=7)
    save_json(
        OUT / "social.json",
        {
            "n": G.number_of_nodes(),
            "edges": [[int(a), int(b)] for a, b in G.edges()],
            "pos": {str(v): [round(float(x), 4), round(float(y), 4)] for v, (x, y) in pos.items()},
            "note": "Zachary's karate club - the graph David's course script ran betweenness and Laplacian eigenvalues on.",
        },
    )

    node_bc = calculate_node_betweenness(G)
    edge_bc = nx.edge_betweenness_centrality(G)
    # first Girvan-Newman split: remove max-edge-betweenness edges until the graph splits
    H = G.copy()
    removed = []
    while nx.number_connected_components(H) == 1:
        eb = nx.edge_betweenness_centrality(H)
        # deterministic tie-break: max value, then lexicographically smallest edge
        mx = max(eb.values())
        e = min(tuple(sorted(k)) for k, v in eb.items() if v >= mx - 1e-12)
        removed.append([int(e[0]), int(e[1]), round(float(mx), 6)])
        H.remove_edge(*e)
    first_split = [sorted(int(v) for v in c) for c in nx.connected_components(H)]
    first_split.sort(key=len, reverse=True)

    L = nx.laplacian_matrix(G).todense()
    evals, evecs = np.linalg.eigh(L)
    fiedler = np.asarray(evecs[:, 1]).ravel()
    save_json(
        FIXTURES / "arxiv-graphalgos.json",
        {
            "nodeBetweenness": {str(k): round(float(v), 6) for k, v in node_bc.items()},
            "edgeBetweennessTop": [
                {"e": [int(a), int(b)], "v": round(float(v), 6)}
                for (a, b), v in sorted(edge_bc.items(), key=lambda kv: -kv[1])[:8]
            ],
            "gnRemoved": removed,
            "gnFirstSplit": first_split,
            "laplacianEigenvalues": [round(float(v), 6) for v in evals],
            "fiedlerSigns": [int(s) for s in np.sign(np.round(fiedler, 12))],
            "note": (
                "nodeBetweenness uses David's own normalization from SocialNetworkGraphs.py "
                "(counts one shortest path per pair); edge betweenness / eigenvalues via networkx+numpy."
            ),
        },
    )
    log("cards + fixtures done")


# --------------------------------------------------------------------------
# 5) Static assets: diagram, report, source extract
# --------------------------------------------------------------------------
def prep_assets():
    from PIL import Image

    img = Image.open(RAW / "Diagram.png")
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    img.save(OUT / "diagram.webp", quality=85)
    import shutil

    shutil.copyfile(RAW / "semantic_graph_project.pdf", OUT / "report.pdf")
    log("assets: diagram.webp + report.pdf")

    # code-cell extract of project_demo.ipynb for the Source drawer
    src_dir = REPO / "demos" / "arxiv_src"
    src_dir.mkdir(exist_ok=True)
    nb = json.load(open(RAW / "project_demo.ipynb", encoding="utf-8"))
    lines = [
        "# project_demo.ipynb - code cells extracted for the Source drawer.",
        "# Group 36 (DTU 02807, fall 2025); outputs and machine paths stripped.",
        "",
    ]
    for c in nb["cells"]:
        src = "".join(c["source"]).rstrip()
        if c["cell_type"] == "markdown":
            for ln in src.splitlines():
                lines.append(("# " + ln).rstrip())
            lines.append("")
        elif src:
            lines.append(src)
            lines.append("")
    (src_dir / "project_demo.py").write_text("\n".join(lines), encoding="utf-8")
    log(f"assets: demos/arxiv_src/project_demo.py ({len(lines)} lines)")


def main():
    only = os.environ.get("ARXIV_PREP_ONLY", "")
    if only in ("", "sample", "graph"):
        if not SNAPSHOT.exists():
            raise RuntimeError(f"snapshot not found: {SNAPSHOT} (set ARXIV_SNAPSHOT)")
        sample = sample_papers()
        if only != "sample":
            emb = embed(sample["papers"])
            prep_graph(sample, emb)
    if only in ("", "cards"):
        prep_cards()
    if only in ("", "assets"):
        prep_assets()
    log("all done")


if __name__ == "__main__":
    main()
