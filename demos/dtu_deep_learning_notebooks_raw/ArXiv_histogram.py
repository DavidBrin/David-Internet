import warnings
warnings.filterwarnings('ignore')

import os
import json
import random
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

import tensorflow as tf
import tensorflow_hub as hub
from tensorflow.keras.losses import cosine_similarity
from sklearn.decomposition import PCA
from sklearn.neighbors import NearestNeighbors

plt.rcParams['figure.figsize'] = (8,5)
plt.rcParams['font.size'] = 14

FILE = 'arxiv-metadata-oai-snapshot.json'

def get_data():
    with open(FILE) as f:
        for line in f:
            yield line

dataframe = {
    'title': [],
    'year': [],
    'abstract': []
}

data = get_data()
for i, paper in enumerate(data):
    paper = json.loads(paper)
    try:
        date = int(paper['update_date'].split('-')[0])
        if date > 2019:
            dataframe['title'].append(paper['title'])
            dataframe['year'].append(date)
            dataframe['abstract'].append(paper['abstract'])
    except: pass

df = pd.DataFrame(dataframe)
df.head(10)

del dataframe
print(f"Samples: {df.shape[0]}\nFeatures: {df.shape[1]}")

any(df.isna().sum())
df.info()
sns.countplot(data=df, x='year')
plt.title("Papers Released across Years")
plt.show()

df['length'] = df['abstract'].str.len()
df.head(10)
sns.boxplot(data=df, y='length')
plt.title("Length of Abstracts")
plt.show()

def word_count(x):
    return len(x.split())

df['word_count'] = df['abstract'].apply(word_count)
df.head()

sns.boxplot(data=df, y='word_count')
plt.title("Word Count in Abstracts")
plt.show()

print(f"Mean of Word Count: {df['word_count'].mean():.2f}\nMedian of Word Count: {df['word_count'].median()}")

# Tensorflow Hub URL for Universal Sentence Encoder
MODEL_URL = "https://tfhub.dev/google/universal-sentence-encoder/4"

# KerasLayer
sentence_encoder_layer = hub.KerasLayer(MODEL_URL,
                                        input_shape=[],
                                        dtype=tf.string,
                                        trainable=False,
                                        name="use")

abstracts = df["abstract"].to_list()

# Setup for embeddings computation
embeddings = []
batch_size = 3000
num_batches = len(abstracts) // batch_size

# Compute Embeddings in batches
for i in range(num_batches):
    batch_abstracts = abstracts[i*batch_size : (i+1)*batch_size]
    batch_embeddings = sentence_encoder_layer(batch_abstracts)
    embeddings.extend(batch_embeddings.numpy())
    print(f"Processed batch {i+1}/{num_batches}")

# Embeddings for remaining abstracts
remaining_abstracts = abstracts[num_batches*batch_size:]
if len(remaining_abstracts) > 0:
    remaining_embeddings = sentence_encoder_layer(remaining_abstracts)
    embeddings.extend(remaining_embeddings.numpy())

embeddings = np.array(embeddings)
print(f"Embeddings shape: {embeddings.shape}")

# Use NearestNeighbors instead of KNeighborsClassifier
# n_neighbors=6 gives us 5 nearest neighbors (excluding the point itself)
nn = NearestNeighbors(n_neighbors=6, metric='cosine')
nn.fit(embeddings)

# Compute distances for all papers
print("Computing nearest neighbor distances for all papers...")
distances, indices = nn.kneighbors(embeddings)

# distances shape: (n_samples, 6)
# First column is distance to itself (0), so we use columns 1-5
neighbor_distances = distances[:, 1:]  # Exclude self-distance

# Flatten all distances for histogram
all_distances = neighbor_distances.flatten()

print(f"Total distances computed: {len(all_distances)}")
print(f"Distance statistics:")
print(f"  Mean: {all_distances.mean():.4f}")
print(f"  Median: {np.median(all_distances):.4f}")
print(f"  Std: {all_distances.std():.4f}")
print(f"  Min: {all_distances.min():.4f}")
print(f"  Max: {all_distances.max():.4f}")

# Create histogram
plt.figure(figsize=(12, 6))
plt.hist(all_distances, bins=100, edgecolor='black', alpha=0.7)
plt.xlabel('Cosine Distance to Nearest Neighbors')
plt.ylabel('Frequency')
plt.title('Distribution of Distances to 5 Nearest Neighbors (All Papers)')
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.show()

# Create separate histograms for each neighbor rank
fig, axes = plt.subplots(2, 3, figsize=(15, 10))
axes = axes.flatten()

for i in range(5):
    axes[i].hist(neighbor_distances[:, i], bins=50, edgecolor='black', alpha=0.7, color=f'C{i}')
    axes[i].set_xlabel('Cosine Distance')
    axes[i].set_ylabel('Frequency')
    axes[i].set_title(f'Distance to {i+1}th Nearest Neighbor')
    axes[i].grid(True, alpha=0.3)

# Remove the 6th subplot
fig.delaxes(axes[5])
plt.tight_layout()
plt.show()

# Show some example recommendations
print("\n" + "="*80)
print("Example Recommendations:")
print("="*80 + "\n")

for _ in range(5):
    idx = random.randint(0, len(df)-1)
    sample = df["title"].iloc[idx]
    dist, index = nn.kneighbors(X=embeddings[idx,:].reshape(1,-1))
    print(f"Sample:\n{sample}\n")
    for i in range(1, 6):
        print(f"Recommendation {i} (distance: {dist[0][i]:.4f}):\n{df['title'].iloc[index[0][i]]}\n")
    print("="*80 + "\n")