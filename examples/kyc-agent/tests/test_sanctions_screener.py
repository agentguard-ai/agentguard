"""Tests for the KYC Sanctions Screening Agent (sub-issue #439).

Every test is offline and deterministic: fuzzy matching runs locally against
the synthetic fixture in ``tests/fixtures/sanctions_list.json``. No API, no
network, no key.

The suite covers:

  - The three verdicts: clear, near_match, exact_match.
  - Alias matching, order-insensitive names, accents and honorifics.
  - Threshold configuration (default 0.85) and its boundary behaviour.
  - Corroboration rules: a name alone never confirms; unknown DOB or
    nationality neither confirms nor clears.
  - Confidence semantics for every verdict.
  - Fixture loading across the schema spellings #437 may ship.
  - Hand-off into the Decision Agent (#441).
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from agents.decision_agent import make_decision
from agents.sanctions_screener import (
    BUNDLED_SANCTIONS_FIXTURE,
    DEFAULT_EXACT_THRESHOLD,
    DEFAULT_MATCH_THRESHOLD,
    SCREENER_VERSION,
    SanctionsScreeningError,
    load_sanctions_list,
    name_similarity,
    normalise_name,
    screen_sanctions,
)
from interfaces import ExtractedIdentity, RiskAssessment, SanctionsResult

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "sanctions_list.json"

# The first entry of the bundled fixture, spelled out so the tests read as
# specifications rather than as lookups.
TARGET_NAME = "Ivan Testovich Fixture"
TARGET_DOB = "1961-02-02"
TARGET_NATIONALITY = "ZZ"


# ---------- helpers ----------


def _run(coro):
    return asyncio.run(coro)


def _screen(name, dob="", nationality="", **kwargs) -> SanctionsResult:
    return _run(screen_sanctions(name, dob, nationality, **kwargs))


# ---------- clear ----------


def test_unrelated_name_is_clear():
    result = _screen("Jane Testcase", "1985-03-15", "ZZ")
    assert result.status == "clear"
    assert result.matched_entity is None
    assert result.list_source is None


def test_clear_confidence_is_distance_from_closest_entry():
    far = _screen("Zzzz Qqqq")
    near_miss = _screen("Ivan Testov Fixt")  # resembles the target, below threshold
    assert far.status == near_miss.status == "clear"
    assert far.confidence > near_miss.confidence


def test_empty_list_clears_with_full_confidence():
    result = _screen("Ivan Testovich Fixture", sanctions_list=[])
    assert result.status == "clear"
    assert result.confidence == 1.0


# ---------- exact match ----------


def test_exact_name_and_dob_is_exact_match():
    result = _screen(TARGET_NAME, TARGET_DOB, TARGET_NATIONALITY)
    assert result.status == "exact_match"
    assert result.matched_entity == TARGET_NAME
    assert result.list_source == "OFAC_SDN"
    assert result.confidence == 1.0


def test_exact_match_is_case_and_accent_insensitive():
    result = _screen("ÍVAN TESTÓVICH FIXTURE", TARGET_DOB, TARGET_NATIONALITY)
    assert result.status == "exact_match"


def test_reversed_name_order_still_matches():
    result = _screen("Fixture Testovich Ivan", TARGET_DOB, TARGET_NATIONALITY)
    assert result.status == "exact_match"


def test_honorifics_do_not_affect_the_verdict():
    result = _screen("Mr. Ivan Testovich Fixture", TARGET_DOB, TARGET_NATIONALITY)
    assert result.status == "exact_match"


def test_alias_hit_reports_the_primary_entity_name():
    result = _screen("Testovich, Ivan", TARGET_DOB, TARGET_NATIONALITY)
    assert result.status in {"near_match", "exact_match"}
    assert result.matched_entity == TARGET_NAME  # not the alias


# ---------- near match ----------


def test_name_alone_never_confirms():
    # Same name, no date of birth supplied → a human decides.
    result = _screen(TARGET_NAME)
    assert result.status == "near_match"
    assert result.matched_entity == TARGET_NAME


def test_conflicting_dob_downgrades_to_near_match():
    result = _screen(TARGET_NAME, "1999-12-31", TARGET_NATIONALITY)
    assert result.status == "near_match"


def test_misspelled_name_above_threshold_is_near_match():
    # 0.9091 similarity: past the reporting threshold, short of exact.
    result = _screen("Iwan Testowich Fixture", TARGET_DOB, TARGET_NATIONALITY)
    assert result.status == "near_match"
    assert result.confidence < 1.0


def test_entity_without_dob_can_only_near_match():
    result = _screen("Synthetic Holdings Ltd", "", "QQ")
    assert result.status == "near_match"
    assert result.list_source == "EU_SANCTIONS"


def test_conflicting_nationality_lowers_confidence_but_keeps_the_hit():
    matching = _screen(TARGET_NAME, TARGET_DOB, TARGET_NATIONALITY)
    conflicting = _screen(TARGET_NAME, TARGET_DOB, "XX")
    assert conflicting.status in {"near_match", "exact_match"}
    assert conflicting.confidence < matching.confidence


def test_same_birth_year_is_partial_corroboration():
    same_year = _screen(TARGET_NAME, "1961-07-07", TARGET_NATIONALITY)
    other_year = _screen(TARGET_NAME, "1988-07-07", TARGET_NATIONALITY)
    assert same_year.status == other_year.status == "near_match"
    assert same_year.confidence > other_year.confidence


# ---------- thresholds ----------


def test_default_thresholds_are_the_documented_ones():
    assert DEFAULT_MATCH_THRESHOLD == 0.85
    assert DEFAULT_EXACT_THRESHOLD == 0.95


def test_lower_threshold_surfaces_a_weaker_hit():
    weak = "Ivan T. Fixture"  # 0.7778 against the closest name on the list
    assert _screen(weak).status == "clear"
    assert _screen(weak, threshold=0.6).status == "near_match"


def test_higher_threshold_suppresses_a_borderline_hit():
    borderline = "Iwan Testowich Fixture"  # 0.9091 similarity
    assert _screen(borderline).status == "near_match"
    assert _screen(borderline, threshold=0.95, exact_threshold=0.95).status == "clear"


def test_exact_threshold_can_forbid_exact_matches():
    result = _screen(
        TARGET_NAME, TARGET_DOB, TARGET_NATIONALITY, exact_threshold=1.0
    )
    assert result.status == "exact_match"  # a perfect name still reaches 1.0


def test_invalid_threshold_ordering_raises():
    with pytest.raises(SanctionsScreeningError):
        _screen(TARGET_NAME, threshold=0.9, exact_threshold=0.5)


def test_empty_name_raises():
    with pytest.raises(SanctionsScreeningError):
        _screen("   ")


# ---------- determinism ----------


def test_same_query_gives_identical_result():
    assert _screen(TARGET_NAME, TARGET_DOB, TARGET_NATIONALITY) == _screen(
        TARGET_NAME, TARGET_DOB, TARGET_NATIONALITY
    )


def test_confidence_always_within_unit_interval():
    for entry in load_sanctions_list(FIXTURE):
        result = _screen(entry["name"], entry["date_of_birth"], entry["nationality"])
        assert 0.0 <= result.confidence <= 1.0, entry["id"]


def test_every_fixture_entry_screens_as_a_hit():
    for entry in load_sanctions_list(FIXTURE):
        result = _screen(entry["name"], entry["date_of_birth"], entry["nationality"])
        assert result.status in {"near_match", "exact_match"}, entry["id"]


def test_screener_version_is_stamped():
    assert SCREENER_VERSION.startswith("kyc-sanctions-screener/")


# ---------- normalisation helpers ----------


def test_normalise_name_strips_noise_accents_and_punctuation():
    assert normalise_name("Mr. Ivan  Testóvich-Fixture, Ltd") == "ivan testovich fixture"


def test_name_similarity_is_symmetric_and_bounded():
    left = name_similarity("Ivan Testovich", "Testovich Ivan")
    right = name_similarity("Testovich Ivan", "Ivan Testovich")
    assert left == right == 1.0
    assert name_similarity("Ivan", "") == 0.0


# ---------- fixture loading ----------


def test_bundled_fixture_is_the_documented_size():
    entries = load_sanctions_list(BUNDLED_SANCTIONS_FIXTURE)
    assert len(entries) == 20
    assert {entry["list_source"] for entry in entries} == {
        "OFAC_SDN",
        "EU_SANCTIONS",
        "UN_SANCTIONS",
    }


def test_bundled_fixture_is_entirely_synthetic():
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert all(entry["is_synthetic"] for entry in payload["entries"])
    assert all(entry["nationality"] in {"ZZ", "QQ", "XX"} for entry in payload["entries"])


def test_loader_accepts_a_bare_array(tmp_path):
    # The shape the #437 draft ships: a top-level array with `country`.
    path = tmp_path / "sanctions_list.json"
    path.write_text(
        json.dumps([{"id": "SAN-001", "name": "Placeholder Trading Company", "country": "XX"}]),
        encoding="utf-8",
    )
    entries = load_sanctions_list(path)
    assert entries[0]["nationality"] == "XX"


def test_loader_accepts_alias_spellings(tmp_path):
    path = tmp_path / "sanctions_list.json"
    path.write_text(
        json.dumps(
            {
                "source": "ofac",
                "entities": [
                    {"entity_name": "Ivan Testovich Fixture", "aka": "Testovich, Ivan", "dob": "1961-02-02"}
                ],
            }
        ),
        encoding="utf-8",
    )
    entry = load_sanctions_list(path)[0]
    assert entry["name"] == "Ivan Testovich Fixture"
    assert entry["aliases"] == ("Testovich, Ivan",)
    assert entry["date_of_birth"] == "1961-02-02"
    assert entry["list_source"] == "OFAC_SDN"  # normalised from "ofac"


def test_loader_rejects_missing_and_malformed_files(tmp_path):
    with pytest.raises(SanctionsScreeningError):
        load_sanctions_list(tmp_path / "absent.json")
    broken = tmp_path / "broken.json"
    broken.write_text("{not json", encoding="utf-8")
    with pytest.raises(SanctionsScreeningError):
        load_sanctions_list(broken)


def test_unnamed_entries_are_skipped(tmp_path):
    path = tmp_path / "sanctions_list.json"
    path.write_text(json.dumps([{"id": "SAN-001"}, {"name": "Ivan Testovich Fixture"}]), encoding="utf-8")
    assert len(load_sanctions_list(path)) == 1


def test_injected_list_bypasses_the_fixture():
    result = _screen(
        "Bespoke Synthetic Entity",
        sanctions_list=[{"name": "Bespoke Synthetic Entity", "list_source": "UN"}],
    )
    assert result.status == "near_match"  # no dob to corroborate
    assert result.list_source == "UN_SANCTIONS"


# ---------- hand-off to the Decision Agent (#441) ----------


def _identity(first: str, last: str) -> ExtractedIdentity:
    return ExtractedIdentity(
        first_name=first,
        last_name=last,
        date_of_birth=TARGET_DOB,
        nationality=TARGET_NATIONALITY,
        document_type="passport",
        document_number="ZZ-TEST-000001",
        document_expiry="2031-01-01",
        address=None,
        confidence=1.0,
    )


def test_exact_match_drives_the_decision_agent_to_reject():
    identity = _identity("Ivan", "Testovich Fixture")
    sanctions = _screen(identity.full_name, identity.date_of_birth, identity.nationality)
    assert sanctions.status == "exact_match"
    decision = _run(
        make_decision(identity, sanctions, RiskAssessment(risk_score=0.0, risk_band="low"))
    )
    assert decision.decision == "reject"
    assert "sanctions_exact_match_hard_reject" in (decision.escalation_reason or "")


def test_clear_screening_lets_a_low_risk_customer_through():
    identity = _identity("Jane", "Testcase")
    sanctions = _screen(identity.full_name, "1985-03-15", "ZZ")
    assert sanctions.status == "clear"
    decision = _run(
        make_decision(identity, sanctions, RiskAssessment(risk_score=0.1, risk_band="low"))
    )
    assert decision.decision == "approve"
