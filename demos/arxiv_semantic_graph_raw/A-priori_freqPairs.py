#Implementing an A-priori algorithm
from itertools import combinations
from collections import defaultdict
#assume data is given as list of baskets
def get_frequent_itemsets(baskets, min_support):
    '''
    baskets: List of lists, where each inner list is a basket of items
    min_support: Minimum support threshold (integer) 
        which means the minimum number of occurrences for an item or item pair to be considered frequent
    Returns: A tuple of two dictionaries:
    - frequent_items: Dictionary of individual items with their counts
    - frequent_pairs: Dictionary of item pairs with their counts
    '''


    # Count individual items
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
# Example usage
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

# Lift is a measure of how much more likely two items are to be bought together than expected if they were independent.
# It is calculated as: Lift(A, B) = P(A ∩ B) / (P(A) * P(B))
# Where:
# - P(A ∩ B) is the support of the item pair
# - P(A) is the support of item A
# - P(B) is the support of item B
def calculate_lift(baskets, frequent_pairs, total_baskets):
    '''
    baskets: List of lists, where each inner list is a basket of items
    frequent_pairs: Dictionary of item pairs with their counts
    total_baskets: Total number of baskets (integer)
    Returns: Dictionary of item pairs with their lift values
    '''
    # Count individual items
    item_count = defaultdict(int)
    for basket in baskets:
        for item in basket:
            item_count[item] += 1
    frequent_items = {item: count for item, count in item_count.items() if count >= min_support}
    lift_values = {}
    item_support = {item: count / total_baskets for item, count in frequent_items.items()}

    for (item1, item2), pair_count in frequent_pairs.items():
        p_a = item_support[item1]
        p_b = item_support[item2]
        p_ab = pair_count / total_baskets
        lift = p_ab / (p_a * p_b) if (p_a * p_b) > 0 else 0
        lift_values[(item1, item2)] = lift

    return lift_values
lift_values = calculate_lift(baskets, frequent_pairs, len(baskets))
print("Lift Values:", lift_values)

#An A-priori algorithm is used for mining frequent itemsets and relevant association rules.
# It operates on a database of transactions (baskets) and identifies itemsets that appear frequently together.
# The algorithm uses a bottom-up approach, where it first identifies individual items that meet a minimum support threshold,
# then extends them to larger itemsets, pruning those that do not meet the threshold at each step.
# This process continues until no more frequent itemsets can be found.  

#using libraries and applying the algorithm to a grocery dataset
#import pandas, MLxtend and apriori and association rules from mlxtend.frequent patterns.
import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules
# Example grocery dataset
data_file = 'groceries_dataset.csv'
# Load the dataset
df = pd.read_csv(data_file)
# Display the first few rows of the dataframe
print(df.head())


#find frequent pairs of items

#co-pilot code below:
# Convert the dataset into a one-hot encoded format
basket = (df.groupby(['Member_number', 'itemDescription'])['itemDescription']
          .count().unstack().reset_index().fillna(0)
          .set_index('Member_number')) 
# Convert counts to 1 (purchased) and 0 (not purchased)
basket = basket.applymap(lambda x: 1 if x > 0 else 0)
# Apply the Apriori algorithm to find frequent itemsets with a minimum support of 0.01
frequent_itemsets = apriori(basket, min_support=0.01, use_colnames=True)
# Generate association rules from the frequent itemsets
rules = association_rules(frequent_itemsets, metric="lift", min_threshold=1)
# Display the first few association rules
print(rules.head())
