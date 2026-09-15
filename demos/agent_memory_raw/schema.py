"""Memory event and record schemas.

These types implement step 1 of the Implementation Sequence in
`Research/proposed_solutions.md`: "Start with the memory schema and event log.
Without evidence and provenance, later graph and trust work will be brittle."

The central design commitment, taken from `Research/architecture/memory_taxonomy.md`,
is that content is stored separately from trust, source, time, and utility. A
record is not a string; it is a claim with a provenance chain and a validity
window.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone

UTC = timezone.utc


# --- Vocabularies -----------------------------------------------------------

# Typed stores, per Research/proposed_solutions.md section 3. Different memory
# types have different failure modes, so they get different policies.
MEMORY_TYPES = ("episodic", "semantic", "preference", "procedural", "resource", "policy")

# Where a record may be used. Session records never survive their session.
SCOPES = ("session", "durable")

# Trust is a retrieval-time filter, not a label. `quarantined` content is kept
# as evidence but is never assembled into context. See AgentPoison notes in
# Research/papers/recent_papers.md.
TRUST_WEIGHT = {
    "verified": 1.00,   # stated directly by the user
    "private": 0.90,    # user-scoped, system-generated
    "inferred": 0.65,   # derived by the agent from evidence
    "shared": 0.45,     # written by another agent
    "untrusted": 0.15,  # scraped, third-party, or unattributed
    "quarantined": 0.0,  # withheld from retrieval entirely
}

# Sensitivity gates retrieval on caller permissions rather than on trust.
SENSITIVITY_RANK = {"public": 0, "personal": 1, "confidential": 2, "secret": 3}


def now_utc() -> datetime:
    return datetime.now(UTC)


def iso(ts: datetime | None) -> str | None:
    return None if ts is None else ts.astimezone(UTC).isoformat()


def parse_iso(value: str | None) -> datetime | None:
    return None if value is None else datetime.fromisoformat(value)


def stable_id(prefix: str, *parts: object) -> str:
    digest = hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()
    return f"{prefix}_{digest[:12]}"


# --- Events -----------------------------------------------------------------

# Who produced an observation determines its ceiling on trust. A claim relayed
# from a web page cannot become more trustworthy than the page.
ACTOR_TRUST = {
    "user": "verified",
    "system": "private",
    "assistant": "inferred",
    "tool": "inferred",
    "shared_agent": "shared",
    "web": "untrusted",
}


@dataclass(frozen=True)
class MemoryEvent:
    """An immutable observation. Evidence, not yet belief."""

    event_id: str
    ts: datetime
    session_id: str
    actor: str
    kind: str  # message | correction | observation | tool_result | outcome | deletion
    content: str
    entity_hints: tuple[str, ...] = ()
    meta: dict = field(default_factory=dict)

    @property
    def source_trust(self) -> str:
        return ACTOR_TRUST.get(self.actor, "untrusted")

    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "ts": iso(self.ts),
            "session_id": self.session_id,
            "actor": self.actor,
            "kind": self.kind,
            "content": self.content,
            "entity_hints": list(self.entity_hints),
            "meta": self.meta,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "MemoryEvent":
        return cls(
            event_id=data["event_id"],
            ts=parse_iso(data["ts"]),
            session_id=data["session_id"],
            actor=data["actor"],
            kind=data["kind"],
            content=data["content"],
            entity_hints=tuple(data.get("entity_hints", ())),
            meta=data.get("meta", {}),
        )


def make_event(
    ts: datetime,
    session_id: str,
    actor: str,
    kind: str,
    content: str,
    entity_hints: tuple[str, ...] = (),
    **meta: object,
) -> MemoryEvent:
    return MemoryEvent(
        event_id=stable_id("evt", iso(ts), session_id, actor, kind, content),
        ts=ts,
        session_id=session_id,
        actor=actor,
        kind=kind,
        content=content,
        entity_hints=entity_hints,
        meta=dict(meta),
    )


# --- Records ----------------------------------------------------------------


@dataclass
class MemoryRecord:
    """A governed memory. Mirrors the schema in Research/proposed_solutions.md."""

    memory_id: str
    type: str
    content: str
    scope: str
    created_at: datetime
    valid_from: datetime
    session_id: str | None = None
    source_event_ids: list[str] = field(default_factory=list)
    entities: list[str] = field(default_factory=list)
    # Identifies "the same claim over time" so a correction can supersede a
    # prior value instead of competing with it in the retriever.
    claim_key: str | None = None
    valid_until: datetime | None = None
    last_confirmed_at: datetime | None = None
    confidence: float = 0.5
    trust_level: str = "inferred"
    sensitivity: str = "public"
    retrieval_count: int = 0
    helpful_count: int = 0
    harmful_count: int = 0
    supersedes: list[str] = field(default_factory=list)
    superseded_by: str | None = None
    contradicts: list[str] = field(default_factory=list)
    derived_from: list[str] = field(default_factory=list)
    policy_flags: list[str] = field(default_factory=list)
    gate_reasons: list[str] = field(default_factory=list)

    def is_valid_at(self, ts: datetime) -> bool:
        if ts < self.valid_from:
            return False
        return self.valid_until is None or ts < self.valid_until

    @property
    def trust_weight(self) -> float:
        return TRUST_WEIGHT.get(self.trust_level, 0.0)

    @property
    def utility(self) -> float:
        """Net observed usefulness in [-1, 1], from post-retrieval feedback."""
        total = self.helpful_count + self.harmful_count
        if total == 0:
            return 0.0
        return (self.helpful_count - self.harmful_count) / total

    def to_dict(self) -> dict:
        data = dict(self.__dict__)
        for key in ("created_at", "valid_from", "valid_until", "last_confirmed_at"):
            data[key] = iso(data[key])
        return data

    @classmethod
    def from_dict(cls, data: dict) -> "MemoryRecord":
        data = dict(data)
        for key in ("created_at", "valid_from", "valid_until", "last_confirmed_at"):
            data[key] = parse_iso(data.get(key))
        return cls(**data)
