'''
Mining Social Network Graphs
'''

#Divisive clustering via Girvan–Newman 
import networkx as nx
import matplotlib.pyplot as plt
from networkx.algorithms.community import girvan_newman
# Create a sample social network graph
G = nx.Graph()
# Add nodes and edges
G.add_edges_from([
    (1, 2), (1, 3), (2, 3), (2, 4),
    (3, 5), (4, 5), (4, 6), (5, 6)
])
# Apply Girvan-Newman algorithm
comp = girvan_newman(G)
# Get the first level of communities
first_level_communities = next(comp)
# Print the communities
print("Communities at the first level:")
for community in first_level_communities:
    print(community)
# Visualize the graph
pos = nx.spring_layout(G)
plt.figure(figsize=(8, 6))
nx.draw(G, pos, with_labels=True, node_color='lightblue', node_size=2000, font_size=16, font_color='black', font_weight='bold', edge_color='gray')
plt.title("Social Network Graph")
plt.show()

# Now without the given algorithm

# calculating betweenness centrality given the graph 
def calculate_betweenness_centrality(graph):
    '''
    graph: A NetworkX graph object

    first counts the number of shortest paths that pass through each node
    then computes the betweenness centrality for each node
    returns: A dictionary with nodes as keys and their betweenness centrality as values
    '''

    # Count the number of shortest paths through each node
    shortest_paths = dict(nx.all_pairs_shortest_path_length(graph))
    betweenness_centrality = {node: 0 for node in graph.nodes()}

    for source in shortest_paths:
        for target in shortest_paths[source]:
            if source != target:
                path = nx.shortest_path(graph, source=source, target=target)
                for node in path[1:-1]:
                    betweenness_centrality[node] += 1

    # Normalize by the number of pairs
    for node in betweenness_centrality:
        betweenness_centrality[node] /= (len(graph.nodes()) - 1) * (len(graph.nodes()) - 2) / 2

    return betweenness_centrality
betweenness = calculate_betweenness_centrality(G)
print("Betweenness Centrality:", betweenness)

#Comparing Girvan–Newman with Louvain Method
import community as community_louvain   
# Apply Louvain method
partition = community_louvain.best_partition(G)
# Print the communities
print("Communities detected by Louvain method:")
communities = {}
for node, comm_id in partition.items():
    if comm_id not in communities:
        communities[comm_id] = []
    communities[comm_id].append(node)
for comm_id, nodes in communities.items():
    print(f"Community {comm_id}: {nodes}")
# Visualize the graph with communities
size = float(len(set(partition.values())))
pos = nx.spring_layout(G)
plt.figure(figsize=(8, 6))
colors = [partition[node] for node in G.nodes()]
nx.draw(G, pos, node_color=colors, with_labels=True, node_size=2000, font_size=16, font_color='black', font_weight='bold', edge_color='gray', cmap=plt.cm.jet)
plt.title("Communities detected by Louvain Method")
plt.show()
from itertools import combinations
from collections import defaultdict
#assume data is given as list of baskets
def calculate_lift(baskets, frequent_pairs, total_baskets):
    '''
    baskets: List of lists, where each inner list is a basket of items
    frequent_pairs: Dictionary of item pairs with their counts
    total_baskets: Total number of baskets (integer)
    Returns: Dictionary of item pairs with their lift values
    '''
    # Count individual item occurrences
    item_count = defaultdict(int)
    for basket in baskets:
        for item in basket:
            item_count[item] += 1

    lift_values = {}
    for (item1, item2), pair_count in frequent_pairs.items():
        p_a_and_b = pair_count / total_baskets
        p_a = item_count[item1] / total_baskets
        p_b = item_count[item2] / total_baskets
        lift = p_a_and_b / (p_a * p_b) if (p_a * p_b) > 0 else 0
        lift_values[(item1, item2)] = lift

    return lift_values

baskets = [
    ['milk', 'bread', 'eggs'],
    ['bread', 'diapers', 'beer', 'egg'],
    ['milk', 'bread', 'diapers', 'beer'],
    ['milk', 'bread', 'diapers', 'cola'],
    ['milk', 'bread', 'eggs'],
]   
min_support = 2
def get_frequent_itemsets(baskets, min_support):
    '''
    baskets: List of lists, where each inner list is a basket of items
    min_support: Minimum support threshold (integer)
    Returns: Tuple of (frequent_items, frequent_pairs)
    frequent_items: Set of items that meet the min_support
    frequent_pairs: Dictionary of item pairs with their counts that meet the min_support
    '''
    # Count individual item occurrences
    item_count = defaultdict(int)
    for basket in baskets:
        for item in basket:
            item_count[item] += 1

    # Filter items by min_support
    frequent_items = {item for item, count in item_count.items() if count >= min_support}
    # Generate pairs and count their occurrences
    pair_count = defaultdict(int)
    for basket in baskets:
        # Only consider frequent items in the basket
        filtered_basket = [item for item in basket if item in frequent_items]
        for item1, item2 in combinations(filtered_basket, 2):
            pair = tuple(sorted((item1, item2)))
            pair_count[pair] += 1

    # Filter pairs by min_support
    frequent_pairs = {pair: count for pair, count in pair_count.items() if count >= min_support}

    return frequent_items, frequent_pairs
# Example usage # Example usage using the karate club graph
baskets = [
    ['milk', 'bread', 'eggs'],
    ['bread', 'diapers', 'beer', 'egg'],
    ['milk', 'bread', 'diapers', 'beer'],
    ['milk', 'bread', 'diapers', 'cola'],
    ['milk', 'bread', 'eggs'],
]
min_support = 2
frequent_items, frequent_pairs = get_frequent_itemsets(baskets, min_support)
print("Frequent Items:", frequent_items)
print("Frequent Item Pairs:", frequent_pairs)
total_baskets = len(baskets)
lift_values = calculate_lift(baskets, frequent_pairs, total_baskets)
print("Lift Values for Frequent Item Pairs:", lift_values)

# Test clustering and centrality on karate club graph
karate_graph = nx.karate_club_graph()
betweenness_karate = calculate_betweenness_centrality(karate_graph)
print("Betweenness Centrality for Karate Club Graph:", betweenness_karate)
'''
baskets: List of lists, where each inner list is a basket of items
min_support: Minimum support threshold (integer)
Returns: Tuple of (frequent_items, frequent_pairs)
- frequent_items: Set of items that meet the min_support
- frequent_pairs: Dictionary of item pairs with their counts that meet the min_support
'''

#Compute the eigenvalues of the Laplacian matrix L(G) of G
#To compute eigenvalues you could use numpy.linalg.eigvals (you should import numpy).)
# (If you use networkx, you could use networkx.linalg.laplacianmatrix to obtain the Laplacian matrix of G
def compute_laplacian_eigenvalues(graph):
    '''
    graph: A NetworkX graph object
    Returns: A list of eigenvalues of the Laplacian matrix of the graph
    '''
    import numpy as np
    from networkx.linalg.laplacianmatrix import laplacian_matrix

    L = laplacian_matrix(graph).todense()
    eigenvalues = np.linalg.eigvals(L)
    return eigenvalues.tolist()
eigenvalues_karate = compute_laplacian_eigenvalues(karate_graph)
print("Laplacian Eigenvalues for Karate Club Graph:", eigenvalues_karate)
for basket in baskets:
    for item in basket:
        item_count[item] += 1

lift_values = {}
for (item1, item2), pair_count in frequent_pairs.items():
    p_a_and_b = pair_count / total_baskets
    p_a = item_count[item1] / total_baskets
    p_b = item_count[item2] / total_baskets
    lift = p_a_and_b / (p_a * p_b) if (p_a * p_b) > 0 else 0
    lift_values[(item1, item2)] = lift

return lift_values
