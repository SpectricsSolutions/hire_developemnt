"""Parse HIRE Partnerships' control source markdown into structured records.

Each source file is a sequence of `## **Code — Title**` headings, followed by
labelled prose sections (`**What You Are Testing:**`, `**Why This Matters:**`,
etc.) and bulleted lists prefixed with `•`. The parser is whitespace- and
emphasis-tolerant — the source files use unicode bullets, em dashes, and
italic emphasis.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

# Heading like: `## **A1 — Contract Enforceability and Recorded Variations**`
# or:           `## **1 — Employee Contracts and Written Particulars**`
_HEADING = re.compile(
    r"^##\s+\*\*\s*(?P<code>[A-Z]?\d+)\s+[—-]+\s+(?P<title>.+?)\s*\*\*\s*$"
)
# Section label like: `**What You Are Testing:**`
_SECTION = re.compile(r"^\*\*\s*(?P<label>[^*]+?)\s*:\*\*\s*$")
# Bullet items begin with `•` (or `*`/`-` as a fallback).
_BULLET = re.compile(r"^\s*[••*\-]\s+(?P<text>.+?)\s*$")


@dataclass
class ParsedControl:
    code: str
    title: str
    domain: str | None
    what_testing: str = ""
    why_matters: str = ""
    primary_question: str = ""
    evidence_prompts: list[str] = field(default_factory=list)
    looking_for: list[str] = field(default_factory=list)
    sampling: str | None = None
    if_partial: list[str] = field(default_factory=list)


# Map a normalised section label to the parsed-control field.
_LABEL_TO_FIELD: dict[str, str] = {
    "what you are testing": "what_testing",
    "why this matters": "why_matters",
    "primary question (ask verbatim)": "primary_question",
    "follow-up evidence prompts (what you want them to show you)": "evidence_prompts",
    "what you are looking for": "looking_for",
    "sampling": "sampling",
    "if evidence is partial": "if_partial",
}

_LIST_FIELDS = {"evidence_prompts", "looking_for", "if_partial"}
_PROSE_FIELDS = {"what_testing", "why_matters", "primary_question", "sampling"}


def _strip_emphasis(text: str) -> str:
    """Remove leading/trailing markdown emphasis (``_`` or ``*``)."""

    cleaned = text.strip()
    while cleaned and cleaned[0] in "_*" and cleaned[-1] in "_*":
        # Only strip if the wrapping is symmetrical and on both ends.
        cleaned = cleaned[1:-1].strip()
    return cleaned


def parse_markdown(path: Path) -> list[ParsedControl]:
    controls: list[ParsedControl] = []
    current: ParsedControl | None = None
    current_field: str | None = None
    prose_buffer: list[str] = []

    def flush_prose() -> None:
        nonlocal prose_buffer
        if current is None or current_field is None:
            prose_buffer = []
            return
        if current_field in _PROSE_FIELDS and prose_buffer:
            joined = " ".join(line.strip() for line in prose_buffer if line.strip())
            joined = _strip_emphasis(joined)
            existing = getattr(current, current_field) or ""
            combined = f"{existing} {joined}".strip() if existing else joined
            setattr(current, current_field, combined)
        prose_buffer = []

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()

        heading = _HEADING.match(line)
        if heading:
            flush_prose()
            if current is not None:
                controls.append(current)
            code = heading.group("code")
            title = heading.group("title")
            domain = code[0] if code[0].isalpha() else None
            current = ParsedControl(code=code, title=title, domain=domain)
            current_field = None
            continue

        if current is None:
            continue

        section = _SECTION.match(line)
        if section:
            flush_prose()
            label = section.group("label").strip().lower()
            current_field = _LABEL_TO_FIELD.get(label)
            continue

        if current_field is None:
            continue

        if current_field in _LIST_FIELDS:
            bullet = _BULLET.match(line)
            if bullet:
                getattr(current, current_field).append(bullet.group("text").strip())
            continue

        # Prose accumulation; skip blank lines.
        if line.strip():
            prose_buffer.append(line)

    flush_prose()
    if current is not None:
        controls.append(current)

    return controls
