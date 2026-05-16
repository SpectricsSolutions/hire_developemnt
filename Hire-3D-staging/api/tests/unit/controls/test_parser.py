from __future__ import annotations

from pathlib import Path

import pytest

from controls.seeding.parser import parse_markdown

SOURCES = Path(__file__).resolve().parents[3] / "controls" / "seeding" / "sources"


@pytest.mark.parametrize(
    "filename, expected_count, expected_first_code",
    [
        ("the_check.md", 10, "1"),
        ("hire_3d_core.md", 25, "A1"),
        ("hire_3d_enhanced.md", 34, "A1"),
    ],
)
def test_parses_full_control_set(filename, expected_count, expected_first_code):
    parsed = parse_markdown(SOURCES / filename)
    assert len(parsed) == expected_count
    assert parsed[0].code == expected_first_code
    # Each control has populated prose and at least one bulleted list.
    for control in parsed:
        assert control.title
        assert control.what_testing
        assert control.why_matters
        assert control.primary_question
        assert control.evidence_prompts
        assert control.looking_for
        assert control.if_partial


def test_the_check_has_no_domain():
    parsed = parse_markdown(SOURCES / "the_check.md")
    assert all(c.domain is None for c in parsed)


def test_hire_3d_core_has_domain_letters():
    parsed = parse_markdown(SOURCES / "hire_3d_core.md")
    domains = {c.domain for c in parsed}
    assert domains == {"A", "B", "C"}
