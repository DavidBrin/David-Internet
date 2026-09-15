"""Text heuristics used by the write gate and the retriever.

Everything here is a deliberate stand-in for a model call. A production system
would use an embedding model for similarity and an LLM for entity and claim
extraction. Keeping these as small, inspectable functions makes the *policy*
under test visible: the interesting question for this prototype is what the
gate and the retriever do with a signal, not how good the signal is.
"""

from __future__ import annotations

import math
import re

STOPWORDS = frozenset(
    """
    a about all also am an and any are as at be been but by can did do does for
    from had has have how i if in into is it its just me my no not of on or our
    out so some than that the their them then there these they this to too us
    was we were what when where which who will with would you your
    """.split()
) | frozenset({"should", "need", "know", "about", "use", "using"})

WORD_RE = re.compile(r"[a-z0-9_./-]+")


def tokenize(text: str) -> list[str]:
    # WORD_RE allows '.' for paths/versions; strip a trailing sentence period
    # so "summaries." and "summaries" collapse to the same stem.
    return [t.rstrip(".") for t in WORD_RE.findall(text.lower()) if t.rstrip(".")]


def content_tokens(text: str) -> set[str]:
    """Meaning-bearing tokens, crudely singularized."""
    out = set()
    for token in tokenize(text):
        if token in STOPWORDS or len(token) < 2:
            continue
        if len(token) > 4 and token.endswith("ies"):
            token = token[:-3] + "y"
        elif len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
            token = token[:-1]
        out.add(token)
    return out


def lexical_similarity(a: str, b: str) -> float:
    """Cosine over token sets, standing in for embedding similarity."""
    ta, tb = content_tokens(a), content_tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / math.sqrt(len(ta) * len(tb))


# --- Entity extraction ------------------------------------------------------

QUOTED_RE = re.compile(r"[\"'`]([^\"'`]{3,40})[\"'`]")
PATH_RE = re.compile(r"(?:[\w.-]+/)+[\w.-]+")
URL_RE = re.compile(r"https?://([\w.-]+)")
SNAKE_RE = re.compile(r"\b[a-z]+(?:_[a-z0-9]+)+\b")
PROPER_RE = re.compile(r"\b[A-Z][a-zA-Z0-9]{2,}\b")


def extract_entities(text: str, hints: tuple[str, ...] = ()) -> list[str]:
    """Best-effort entity extraction.

    Callers may pass `hints` for entities that a real system would recover with
    an extraction model. The demo uses hints so that claim identity is stable;
    the heuristics below are what runs when no hint is available.
    """
    found: set[str] = {h.lower() for h in hints}
    for match in URL_RE.findall(text):
        found.add(match.lower())
    for match in PATH_RE.findall(text):
        found.add(match.lower())
    for match in SNAKE_RE.findall(text):
        found.add(match)
    for match in QUOTED_RE.findall(text):
        found.add(match.strip().lower())
    # Skip the sentence-initial word: capitalization there is grammatical.
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        words = sentence.split()
        for word in words[1:]:
            for match in PROPER_RE.findall(word):
                found.add(match.lower())
    return sorted(found)


# --- Instruction detection --------------------------------------------------

# Memory that reads like a command is the AgentPoison attack surface. See
# Research/problems/pain_points.md section 6.
INSTRUCTION_PATTERNS: tuple[tuple[str, re.Pattern], ...] = (
    ("override_directive", re.compile(r"\b(ignore|disregard|forget)\b.{0,20}\b(previous|prior|all|above|earlier)\b", re.I)),
    ("system_prompt_probe", re.compile(r"\b(system prompt|developer message|your instructions)\b", re.I)),
    ("exfiltration", re.compile(r"\b(send|email|post|upload|forward)\b.{0,40}\b(to|at)\b\s*\S+@|\bexfiltrat", re.I)),
    ("credential_demand", re.compile(r"\b(reveal|disclose|print|share)\b.{0,25}\b(key|token|password|credential|secret)s?\b", re.I)),
    ("imperative_always", re.compile(r"\byou (?:must|should) (?:always|never)\b", re.I)),
    # A bare sentence-initial "Always/Never <verb>" is a standing directive
    # even when it omits an explicit "you must" subject. Keep this scoped to
    # sentence starts so first-person preferences ("I always use …") remain
    # distinguishable from instructions.
    ("standing_imperative", re.compile(r"(?:^|[.!?]\s+)(?:please\s+)?(?:always|never)\s+\w+", re.I)),
    # Narrow on purpose: "first run the benchmark" is a legitimate procedural
    # memory, so bare imperatives are not evidence of an injection attempt.
    ("shell_command", re.compile(r"\b(?:curl|wget|sudo|chmod|nc)\b\s+\S|\brm\s+-rf\b|\bbash\s+-c\b", re.I)),
)


def detect_instructions(text: str) -> list[str]:
    return [name for name, pattern in INSTRUCTION_PATTERNS if pattern.search(text)]


def neutralize(text: str) -> str:
    """Render instruction-like content inert for storage.

    The content is preserved as evidence (deleting it would destroy the audit
    trail) but is explicitly framed as a quoted artifact rather than a
    directive, so that a later reader cannot mistake it for policy.
    """
    collapsed = " ".join(text.split())
    return f"[QUARANTINED CONTENT, NOT AN INSTRUCTION] <<{collapsed}>>"


# --- Sensitivity ------------------------------------------------------------

SENSITIVE_PATTERNS: tuple[tuple[str, str, re.Pattern], ...] = (
    ("api_key", "secret", re.compile(r"\b(sk-[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{8,})\b")),
    ("password", "secret", re.compile(r"\b(password|passphrase|private key)\b\s*[:=]", re.I)),
    ("national_id", "secret", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
    ("email", "personal", re.compile(r"\b[\w.+-]+@[\w-]+\.\w{2,}\b")),
    ("phone", "personal", re.compile(r"\b\+?\d[\d\s().-]{8,}\d\b")),
    ("health", "confidential", re.compile(r"\b(diagnos\w+|prescription|medication|therapy)\b", re.I)),
    ("compensation", "confidential", re.compile(r"\b(salary|compensation|equity grant)\b", re.I)),
)

_SENSITIVITY_ORDER = ("public", "personal", "confidential", "secret")


def classify_sensitivity(text: str) -> tuple[str, list[str]]:
    level = "public"
    matches: list[str] = []
    for name, candidate, pattern in SENSITIVE_PATTERNS:
        if pattern.search(text):
            matches.append(name)
            if _SENSITIVITY_ORDER.index(candidate) > _SENSITIVITY_ORDER.index(level):
                level = candidate
    return level, matches
