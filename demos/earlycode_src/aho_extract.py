# aho_corasick_string_matching.ipynb (CSE 100, 2024) - code cells extracted.
# The notebook builds its automaton with the pyahocorasick LIBRARY and counts
# 106 nodes; the page implements the algorithm from scratch to show what the
# library call hides (src/demos/earlycode/core/aho.ts).

%pip install pyahocorasick

import ahocorasick

# List of words
words = [
    "TheFastAndTheFurious",
    "2Fast2Furious",
    "TheFastAndTheFuriousTokyoDpift",
    "FastAndFurious",
    "FastFive",
    "FastAndFurious6",
    "Furious7",
    "TheFateOfTheFurious",
    "FastAndFuriousPresentshobbsAndShaw",
    "F9",
    "FastX"
]

# Initialize the automaton
automaton = ahocorasick.Automaton()

# Add words to the automaton
for idx, word in enumerate(words):
    automaton.add_word(word, (idx, word))

# Finalize the automaton
automaton.make_automaton()

# Count the number of nodes
node_count = automaton.get_stats()['nodes_count']
print(f"Number of nodes: {node_count}")
