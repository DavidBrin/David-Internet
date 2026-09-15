"""A minimal temporal index over memories: step 3 of the Implementation Sequence.

This is not a knowledge graph engine. It is the smallest structure that makes
the argument in `Research/architecture/vector_vs_graph_memory.md` testable:
*use vectors to find candidates, use structure to decide what to do with them.*

Edges carry validity windows so that traversal can be run "as of" a past time,
which is what distinguishes a temporal graph from a graph with timestamps on it.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from .schema import MemoryRecord

MENTIONS = "mentions"
EVIDENCED_BY = "evidenced_by"
SUPERSEDES = "supersedes"
CONTRADICTS = "contradicts"
DERIVED_FROM = "derived_from"


@dataclass(frozen=True)
class Edge:
    src: str
    rel: str
    dst: str
    valid_from: datetime
    valid_until: datetime | None = None

    def is_valid_at(self, ts: datetime) -> bool:
        if ts < self.valid_from:
            return False
        return self.valid_until is None or ts < self.valid_until


def entity_node(name: str) -> str:
    return f"entity:{name}"


def record_node(memory_id: str) -> str:
    return f"mem:{memory_id}"


def event_node(event_id: str) -> str:
    return f"evt:{event_id}"


class TemporalGraph:
    def __init__(self) -> None:
        self.edges: list[Edge] = []

    def index(self, record: MemoryRecord) -> None:
        """Add or refresh all edges for a record."""
        src = record_node(record.memory_id)
        # Refresh only this record's outgoing edges.  A correction points from
        # the newer record to the older one, so reindexing that older record
        # after its validity changes must retain the incoming supersedes edge.
        self.edges = [edge for edge in self.edges if edge.src != src]
        for entity in record.entities:
            self.edges.append(
                Edge(src, MENTIONS, entity_node(entity), record.valid_from, record.valid_until)
            )
        for event_id in record.source_event_ids:
            self.edges.append(Edge(src, EVIDENCED_BY, event_node(event_id), record.created_at))
        for other in record.supersedes:
            self.edges.append(Edge(src, SUPERSEDES, record_node(other), record.valid_from))
        for other in record.contradicts:
            self.edges.append(Edge(src, CONTRADICTS, record_node(other), record.valid_from))
        for other in record.derived_from:
            self.edges.append(Edge(src, DERIVED_FROM, record_node(other), record.created_at))

    def reindex(self, records: list[MemoryRecord]) -> None:
        self.edges = []
        for record in records:
            self.index(record)

    def drop(self, memory_id: str) -> None:
        node = record_node(memory_id)
        self.edges = [e for e in self.edges if e.src != node and e.dst != node]

    # -- traversal ----------------------------------------------------------

    def records_mentioning(self, entity: str, as_of: datetime) -> set[str]:
        target = entity_node(entity)
        return {
            e.src.removeprefix("mem:")
            for e in self.edges
            if e.rel == MENTIONS and e.dst == target and e.is_valid_at(as_of)
        }

    def entities_of(self, memory_id: str, as_of: datetime) -> set[str]:
        src = record_node(memory_id)
        return {
            e.dst.removeprefix("entity:")
            for e in self.edges
            if e.rel == MENTIONS and e.src == src and e.is_valid_at(as_of)
        }

    def expand(self, seeds: set[str], as_of: datetime, hops: int = 1) -> set[str]:
        """Pull in records sharing an entity with the seed set.

        This is the step a pure vector store cannot do: a memory that shares no
        wording with the query but concerns the same entity still surfaces.
        """
        reached = set(seeds)
        frontier = set(seeds)
        for _ in range(hops):
            neighbours: set[str] = set()
            for memory_id in frontier:
                for entity in self.entities_of(memory_id, as_of):
                    neighbours |= self.records_mentioning(entity, as_of)
            frontier = neighbours - reached
            reached |= neighbours
            if not frontier:
                break
        return reached

    def summary(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for edge in self.edges:
            counts[edge.rel] = counts.get(edge.rel, 0) + 1
        return counts
