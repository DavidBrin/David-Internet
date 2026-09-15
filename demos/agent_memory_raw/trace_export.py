"""Export the deterministic Memory OS demonstration as a versioned JSON trace."""

from __future__ import annotations

import argparse
import copy
import json
from datetime import datetime
from pathlib import Path

from .demo import ScenarioCheckpoint, run_scenario
from .schema import UTC, MemoryEvent, MemoryRecord, iso
from .system import MemorySystem
from .write_gate import GateDecision


def _event(event: MemoryEvent) -> dict:
    return event.to_dict()


def _decision(decision: GateDecision) -> dict:
    return {
        "action": decision.action,
        "reasons": list(decision.reasons),
        "memory_type": decision.memory_type,
        "scope": decision.scope,
        "trust_level": decision.trust_level,
        "sensitivity": decision.sensitivity,
        "confidence": decision.confidence,
        "supersedes": list(decision.supersedes),
        "policy_flags": list(decision.policy_flags),
    }


def _record(
    record: MemoryRecord,
    system: MemorySystem,
    at: datetime,
    *,
    session_id: str | None,
) -> dict:
    data = record.to_dict()
    # ``visible`` means eligible for retrieval at this checkpoint before
    # relevance and clearance filtering.  It therefore follows the captured
    # query's session boundary and the store's normal quarantine policy.
    visible_ids = {
        item.memory_id
        for item in system.store.visible(at, session_id=session_id)
    }
    data["visible"] = record.memory_id in visible_ids
    data["deleted"] = system.store.get(record.memory_id) is None
    return data


def _edge(edge, at: datetime) -> dict:
    return {
        "src": edge.src,
        "rel": edge.rel,
        "dst": edge.dst,
        "valid_from": iso(edge.valid_from),
        "valid_until": iso(edge.valid_until),
        "visible": edge.is_valid_at(at),
    }


def _query(packet, *, session_id: str | None, clearance: str) -> dict:
    return {
        "query": packet.query,
        "as_of": iso(packet.as_of),
        "session_id": session_id,
        "clearance": clearance,
        "entries": [
            {
                "memory_id": entry.memory_id,
                "type": entry.type,
                "content": entry.content,
                "score": entry.score,
                "valid_from": iso(entry.valid_from),
                "trust_level": entry.trust_level,
                "confidence": entry.confidence,
                "citations": list(entry.citations),
                "why": list(entry.why),
            }
            for entry in packet.entries
        ],
        "excluded": [
            {"memory_id": memory_id, "reason": reason}
            for memory_id, reason in packet.excluded
        ],
        "abstain": packet.abstain,
        "notes": list(packet.notes),
    }


def _snapshot(system: MemorySystem, checkpoint: ScenarioCheckpoint, records: list[MemoryRecord]) -> dict:
    snapshot = {
        "id": checkpoint.id,
        "at": iso(checkpoint.at),
        "focus": checkpoint.focus,
        "records": [
            _record(
                record,
                system,
                checkpoint.at,
                session_id=checkpoint.query_session_id,
            )
            for record in records
        ],
        "edges": [_edge(edge, checkpoint.at) for edge in system.graph.edges],
    }
    if checkpoint.event is not None:
        snapshot["event"] = _event(checkpoint.event)
    if checkpoint.decision is not None:
        snapshot["decision"] = _decision(checkpoint.decision)
    if checkpoint.contrast_event is not None:
        snapshot["contrastEvent"] = _event(checkpoint.contrast_event)
    if checkpoint.contrast_decision is not None:
        snapshot["contrastDecision"] = _decision(checkpoint.contrast_decision)
    if checkpoint.query is not None:
        snapshot["query"] = _query(
            checkpoint.query,
            session_id=checkpoint.query_session_id,
            clearance=checkpoint.query_clearance,
        )
    if checkpoint.integrity is not None:
        snapshot["integrity"] = dict(checkpoint.integrity)
    # ``MemoryRecord.to_dict`` intentionally makes a shallow copy for normal
    # persistence.  Checkpoints instead need an independent historical state:
    # later corrections mutate relationship lists on the live record.
    return copy.deepcopy(snapshot)


def export_trace() -> dict:
    """Replay the scenario and copy each live checkpoint into a JSON document."""
    snapshots: list[dict] = []

    def capture(system: MemorySystem, checkpoint: ScenarioCheckpoint, records: list[MemoryRecord]) -> None:
        snapshots.append(_snapshot(system, checkpoint, records))

    run_scenario(on_checkpoint=capture)
    return {
        "version": 1,
        "generatedAt": iso(datetime.now(UTC)),
        "snapshots": snapshots,
    }


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, type=Path, help="path for the trace JSON document")
    args = parser.parse_args(argv)
    trace = export_trace()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(trace, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
