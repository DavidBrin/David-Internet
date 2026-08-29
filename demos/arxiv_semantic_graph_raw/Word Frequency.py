#Computational Tools For Data Science

# Implementing the Word Frequency method using the python map and reduce functions
from functools import reduce

def word_frequency(text):
    # Split the text into words
    words = text.split()
    # Map each word to a tuple (word, 1)
    word_tuples = map(lambda w: (w, 1), words)
    # Reduce the list of tuples to a dictionary
    word_count = reduce(lambda acc, pair: acc.update({pair[0]: acc.get(pair[0], 0) + pair[1]}) or acc, word_tuples, {})
    return word_count

text = "hello world hello"
frequency = word_frequency(text)
print(frequency)  # Output: {'hello': 2, 'world': 1}
