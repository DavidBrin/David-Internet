"""The write gate: step 2 of the Implementation Sequence.

`Research/proposed_solutions.md` section 2 lists what the gate must decide for
every candidate write: whether it is worth storing, which type it belongs to,
whether it is sensitive, whether it contains instructions to strip, whether it
conflicts with existing memory, and whether it stays session-local or becomes
durable.

The gate is deliberately heuristic and deliberately verbose about its reasons.
Every decision records why it was made, because the stated plan is to replace
these rules with a learned policy later (the AgeMem direction), and that
replacement needs labelled decisions to learn from.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .schema import MemoryEvent, MemoryRecord, stable_id
from .store import MemoryStore
from .textutil import (
    classify_sensitivity,
    content_tokens,
    detect_instructions,
    extract_entities,
    neutralize,
)

# Acknowledgements and pleasantries. Storing these is how memory bloat starts.
CHATTER_RE = re.compile(
    r"^\s*(thanks?|thank you|ok(ay)?|got it|sure|yes|no|hi|hello|hey|cool|nice|perfect)[\s!.?]*$",
    re.I,
)

# "For this task" is the boundary between a preference and an instruction.
# Missing it is the "transient constraint becomes permanent assumption" failure
# in Research/problems/pain_points.md section 1.
SESSION_MARKERS = (
    "for this task",
    "for this report",
    "for this one",
    "just this once",
    "for now",
    "today only",
    "in this thread",
    "this time",
)

PREFERENCE_MARKERS = (
    "i prefer",
    "i like",
    "i want",
    "i always",
    "i never",
    "from now on",
    "going forward",
    "please always",
    "please never",
    "stop ",
    "instead of",
)

PROCEDURAL_MARKERS = (
    "workflow",
    "runbook",
    "steps",
    "first ",
    "then ",
    "before ",
    "procedure",
    "recipe",
    "checklist",
)

RESOURCE_MARKERS = ("lives at", "located at", "file", "path", "spreadsheet", "document", "url")

ACTIONS = ("store", "session_only", "quarantine", "reject")


@dataclass
class GateDecision:
    action: str
    reasons: list[str] = field(default_factory=list)
    memory_type: str | None = None
    scope: str = "durable"
    trust_level: str = "inferred"
    sensitivity: str = "public"
    confidence: float = 0.5
    content: str = ""
    entities: list[str] = field(default_factory=list)
    claim_key: str | None = None
    supersedes: list[str] = field(default_factory=list)
    policy_flags: list[str] = field(default_factory=list)
    # Set when the event restates a memory we already hold: no new record, but
    # the existing one gains a confirmation.
    reconfirms: str | None = None

    @property
    def stored(self) -> bool:
        return self.action != "reject"

    def explain(self) -> str:
        return f"{self.action}: " + "; ".join(self.reasons)


def _contains(text: str, markers: tuple[str, ...]) -> str | None:
    lowered = text.lower()
    for marker in markers:
        if marker in lowered:
            return marker
    return None


def _claim_key(
    memory_type: str, entities: list[str], entity_hints: tuple[str, ...] = ()
) -> str | None:
    """Identity of a claim across time.

    Episodic records never get a claim key: two events at different times are
    two facts, not two versions of one fact. Everything else is a statement
    about some entity that a later statement can revise.
    """
    identity_entities = sorted({hint.lower() for hint in entity_hints}) or entities
    if memory_type == "episodic" or not identity_entities:
        return None
    return f"{memory_type}:{'|'.join(sorted(identity_entities))}"


class WriteGate:
    def __init__(self, store: MemoryStore) -> None:
        self.store = store

    # -- policy -------------------------------------------------------------

    def evaluate(self, event: MemoryEvent) -> GateDecision:
        reasons: list[str] = []
        content = event.content
        trust = event.source_trust
        flags: list[str] = []

        if CHATTER_RE.match(content) or len(content_tokens(content)) < 2:
            return GateDecision(
                action="reject",
                reasons=["no durable content: acknowledgement or fewer than two content words"],
                content=content,
            )

        entities = extract_entities(content, event.entity_hints)

        # 1. Instruction stripping. Trusted actors may set policy; untrusted
        #    sources issuing directives are quarantined, not obeyed.
        instructions = detect_instructions(content)
        if instructions:
            if trust in ("verified", "private") and event.kind == "policy":
                flags.append("policy_authorized")
                reasons.append(f"instruction-like content accepted as policy from {event.actor}")
            else:
                content = neutralize(content)
                flags.append("instruction_stripped")
                reasons.append(
                    f"instruction patterns {instructions} from {event.actor} "
                    f"({trust}): neutralized and quarantined"
                )
                return GateDecision(
                    action="quarantine",
                    reasons=reasons,
                    memory_type="episodic",
                    scope="durable",
                    trust_level="quarantined",
                    sensitivity=classify_sensitivity(content)[0],
                    confidence=0.2,
                    content=content,
                    entities=entities,
                    policy_flags=flags,
                )

        # 2. Sensitivity. Not a reason to refuse storage; a reason to gate reads.
        sensitivity, matches = classify_sensitivity(content)
        if sensitivity != "public":
            reasons.append(f"sensitivity={sensitivity} from markers {matches}")
            if sensitivity in ("confidential", "secret"):
                flags.append("requires_consent")

        # 3. Type routing.
        memory_type, type_reason = self._route(event, content, entities)
        reasons.append(type_reason)

        # 4. Scope. Session markers block promotion to durable memory.
        scope = "durable"
        marker = _contains(content, SESSION_MARKERS)
        if marker:
            scope = "session"
            reasons.append(f"session marker '{marker}': held session-local, not promoted")
        elif memory_type == "episodic" and event.kind == "message":
            scope = "session"
            reasons.append("ordinary chat message: episodic and session-local until consolidation")

        # 5. Confidence.
        confidence = self._confidence(event, memory_type, scope)

        # 6. Contradiction against currently valid memory of the same claim.
        claim_key = (
            _claim_key(memory_type, entities, event.entity_hints)
            if scope == "durable"
            else None
        )
        supersedes: list[str] = []
        if claim_key:
            for existing in self.store.by_claim_key(claim_key, as_of=event.ts):
                if existing.content.strip() == content.strip():
                    return GateDecision(
                        action="reject",
                        reasons=[f"restates {existing.memory_id}: reconfirmed instead of rewritten"],
                        content=content,
                        entities=entities,
                        claim_key=claim_key,
                        reconfirms=existing.memory_id,
                    )
                supersedes.append(existing.memory_id)
                reasons.append(
                    f"conflicts with {existing.memory_id} on claim '{claim_key}': supersedes it"
                )

        return GateDecision(
            action="session_only" if scope == "session" else "store",
            reasons=reasons,
            memory_type=memory_type,
            scope=scope,
            trust_level=trust,
            sensitivity=sensitivity,
            confidence=confidence,
            content=content,
            entities=entities,
            claim_key=claim_key,
            supersedes=supersedes,
            policy_flags=flags,
        )

    def _route(
        self, event: MemoryEvent, content: str, entities: list[str]
    ) -> tuple[str, str]:
        if event.kind == "policy":
            return "policy", "kind=policy: routed to policy memory"
        if event.kind == "correction":
            # Corrections retain the type of the fact they revise. Entity
            marker = _contains(content, RESOURCE_MARKERS)
            if marker and any(
                record.type == "resource"
                for hint in event.entity_hints
                for record in self.store.by_entity(hint.lower())
            ):
                return "resource", (
                    f"kind=correction: resource marker '{marker.strip()}' "
                    "with matching resource identity"
                )
            return "preference", "kind=correction: routed to preference memory"
        marker = _contains(content, PREFERENCE_MARKERS)
        if marker and event.actor == "user":
            return "preference", f"preference marker '{marker.strip()}' from user"
        marker = _contains(content, PROCEDURAL_MARKERS)
        if marker:
            return "procedural", f"procedural marker '{marker.strip()}'"
        marker = _contains(content, RESOURCE_MARKERS)
        if marker:
            return "resource", f"resource marker '{marker.strip()}'"
        if event.kind in ("observation", "tool_result", "outcome"):
            return "episodic", f"kind={event.kind}: routed to episodic memory"
        return "episodic", "no type signal: defaulting to episodic evidence"

    def _confidence(self, event: MemoryEvent, memory_type: str, scope: str) -> float:
        base = {"verified": 0.9, "private": 0.8, "inferred": 0.55, "shared": 0.4, "untrusted": 0.2}
        score = base.get(event.source_trust, 0.3)
        if event.kind == "correction":
            score = min(1.0, score + 0.05)  # an explicit correction is strong signal
        if memory_type == "episodic":
            score = min(score, 0.7)  # an event happened; what it means is not yet known
        if scope == "session":
            score = min(score, 0.6)
        return round(score, 2)

    # -- application --------------------------------------------------------

    def apply(self, event: MemoryEvent, decision: GateDecision | None = None) -> MemoryRecord | None:
        """Run the gate and commit the result to the store."""
        decision = decision or self.evaluate(event)
        if decision.reconfirms:
            existing = self.store.get(decision.reconfirms)
            if existing is not None:
                existing.last_confirmed_at = event.ts
                existing.confidence = min(1.0, existing.confidence + 0.1)
                existing.source_event_ids.append(event.event_id)
        if not decision.stored:
            return None

        record = MemoryRecord(
            memory_id=stable_id("mem", event.event_id, decision.memory_type, decision.content),
            type=decision.memory_type,
            content=decision.content,
            scope=decision.scope,
            created_at=event.ts,
            valid_from=event.ts,
            session_id=event.session_id,
            source_event_ids=[event.event_id],
            entities=decision.entities,
            claim_key=decision.claim_key,
            confidence=decision.confidence,
            trust_level=decision.trust_level,
            sensitivity=decision.sensitivity,
            supersedes=list(decision.supersedes),
            policy_flags=list(decision.policy_flags),
            gate_reasons=list(decision.reasons),
        )
        return self.store.write(record)
