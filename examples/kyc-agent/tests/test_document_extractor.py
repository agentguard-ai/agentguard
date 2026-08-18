"""Tests for the KYC Document Extraction Agent (sub-issue #438).

Every test is offline, deterministic, and free of external dependencies.
No API key is used or required; the LLM path is exercised through its
fallback and its pure merge/parse helpers only.

The suite covers:

  - Field extraction from every fixture shape (flat document, alias-heavy
    document, customer profile with a nested ``id_document``).
  - Normalisation: document type slug, alpha-2 country, ISO 8601 dates,
    flattened address mappings, full-name splitting.
  - The confidence scoring table, including the declared-confidence cap.
  - "Never invent a value" — absent fields stay empty.
  - Determinism (same document in → identical dataclass out).
  - LLM mode gating, fallback, and the pure merge/parse helpers.
  - Hand-off into the Decision Agent (#441).
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from agents.decision_agent import make_decision
from agents.document_extractor import (
    DocumentExtractionError,
    EXTRACTOR_VERSION,
    REQUIRED_FIELDS,
    _merge_llm_payload,
    _parse_llm_json,
    extract_identity,
    extract_identity_mock,
    llm_enabled,
    load_document,
)
from interfaces import ExtractedIdentity, RiskAssessment, SanctionsResult

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "documents"


# ---------- helpers ----------


def _run(coro):
    return asyncio.run(coro)


def _fixture(name: str) -> dict:
    with (FIXTURES / f"{name}.json").open(encoding="utf-8") as handle:
        return json.load(handle)


def _extract(name: str) -> ExtractedIdentity:
    return _run(extract_identity(_fixture(name)))


# ---------- happy path ----------


def test_complete_passport_extracts_every_field():
    identity = _extract("passport-complete")
    assert identity.first_name == "Jane"
    assert identity.last_name == "Testcase"
    assert identity.date_of_birth == "1985-03-15"
    assert identity.nationality == "ZZ"
    assert identity.document_type == "passport"
    assert identity.document_number == "ZZ-TEST-000001"
    assert identity.document_expiry == "2029-01-01"
    assert identity.address == "1 Synthetic Way, Testville, ZZ 00001"
    assert identity.confidence == 1.0


def test_returns_extracted_identity_dataclass():
    identity = _extract("passport-complete")
    assert isinstance(identity, ExtractedIdentity)
    assert set(identity.to_dict()) == set(REQUIRED_FIELDS) | {"address", "confidence"}


def test_full_name_property_joins_parts():
    assert _extract("passport-complete").full_name == "Jane Testcase"


# ---------- alias + normalisation ----------


def test_aliases_and_normalisation():
    identity = _extract("drivers-license-aliases")
    assert identity.first_name == "Karim"
    assert identity.last_name == "Fixture"
    assert identity.document_type == "drivers_license"  # "Driver's License"
    assert identity.nationality == "ZZ"                 # "zz" upper-cased
    assert identity.date_of_birth == "1990-11-02"       # "1990/11/02"
    assert identity.document_expiry == "2031-11-02"     # "02 Nov 2031"
    assert identity.document_number == "DL-TEST-000002"


def test_address_mapping_is_flattened_in_order():
    identity = _extract("drivers-license-aliases")
    assert identity.address == "22 Mock Street, Sampletown, 00002, ZZ"


def test_full_name_is_split_and_costs_confidence():
    identity = _extract("national-id-fullname")
    assert identity.first_name == "Ada Q."
    assert identity.last_name == "Synthetic"
    assert identity.confidence == 0.95  # complete, minus the derived-name penalty


def test_customer_profile_shape_resolves_nested_document():
    identity = _extract("customer-profile")
    assert identity.first_name == "Profile"
    assert identity.document_type == "passport"
    assert identity.document_number == "ZZ-TEST-000006"
    assert identity.document_expiry == "2032-09-09"
    assert identity.address == "6 Fixture Avenue, Sampletown, ZZ 00006"
    assert identity.confidence == 1.0


def test_ambiguous_numeric_date_is_never_guessed():
    identity = _extract("passport-ambiguous-date")
    assert identity.date_of_birth == "03/04/1985"  # kept verbatim, not transposed
    assert identity.confidence == 0.95             # one unparsed date


# ---------- confidence scoring ----------


def test_missing_fields_lower_confidence_and_stay_empty():
    identity = _extract("passport-partial")
    # dob, document_number and document_expiry are absent from the fixture.
    assert identity.date_of_birth == ""
    assert identity.document_number == ""
    assert identity.document_expiry == ""
    assert identity.address is None
    assert identity.confidence == pytest.approx(0.55)  # 1.0 - 3 * 0.15


def test_declared_confidence_caps_the_computed_score():
    identity = _extract("passport-low-declared-confidence")
    assert identity.confidence == 0.42  # complete document, blurry scan


def test_declared_confidence_can_only_lower_never_raise():
    document = _fixture("passport-partial")
    document["extraction_confidence"] = 0.99
    identity = _run(extract_identity(document))
    assert identity.confidence == pytest.approx(0.55)


def test_confidence_always_within_unit_interval():
    for path in sorted(FIXTURES.glob("*.json")):
        identity = _run(extract_identity(load_document(path)))
        assert 0.0 <= identity.confidence <= 1.0, path.name


def test_empty_document_body_floors_confidence_at_zero():
    identity = extract_identity_mock({"document_id": "DOC-EMPTY"})
    assert identity.confidence == 0.0
    assert all(getattr(identity, name) == "" for name in REQUIRED_FIELDS)


# ---------- determinism ----------


def test_same_document_gives_identical_identity():
    document = _fixture("passport-complete")
    assert _run(extract_identity(document)) == _run(extract_identity(document))


def test_extraction_does_not_mutate_the_document():
    document = _fixture("drivers-license-aliases")
    snapshot = json.dumps(document, sort_keys=True)
    _run(extract_identity(document))
    assert json.dumps(document, sort_keys=True) == snapshot


def test_extractor_version_is_stamped():
    assert EXTRACTOR_VERSION.startswith("kyc-document-extractor/")


# ---------- input validation ----------


@pytest.mark.parametrize("bad", [None, "passport", 42, ["passport"]])
def test_non_mapping_document_raises(bad):
    with pytest.raises(DocumentExtractionError):
        _run(extract_identity(bad))


def test_empty_document_raises():
    with pytest.raises(DocumentExtractionError):
        _run(extract_identity({}))


# ---------- fixture loading ----------


def test_load_document_by_path():
    assert load_document(FIXTURES / "passport-complete.json")["document_id"] == "DOC-T001"


def test_load_document_missing_raises():
    with pytest.raises(DocumentExtractionError):
        load_document(FIXTURES / "does-not-exist.json")


# ---------- LLM mode (no API key, no network) ----------


def test_llm_disabled_by_default(monkeypatch):
    monkeypatch.delenv("USE_LLM", raising=False)
    assert llm_enabled() is False


@pytest.mark.parametrize("value", ["true", "TRUE", "1", "yes", "on"])
def test_use_llm_env_enables_llm_mode(monkeypatch, value):
    monkeypatch.setenv("USE_LLM", value)
    assert llm_enabled() is True


@pytest.mark.parametrize("value", ["false", "0", "no", ""])
def test_falsy_use_llm_env_keeps_mock_mode(monkeypatch, value):
    monkeypatch.setenv("USE_LLM", value)
    assert llm_enabled() is False


def test_llm_mode_without_api_key_falls_back_to_mock(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    document = _fixture("passport-complete")
    assert _run(extract_identity(document, use_llm=True)) == extract_identity_mock(document)


def test_llm_failure_falls_back_to_mock(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-not-a-real-key")

    async def _boom(document, baseline):
        raise RuntimeError("provider unreachable")

    monkeypatch.setattr("agents.document_extractor._extract_with_llm", _boom)
    document = _fixture("passport-complete")
    assert _run(extract_identity(document, use_llm=True)) == extract_identity_mock(document)


def test_parse_llm_json_handles_code_fences():
    payload = _parse_llm_json('```json\n{"first_name": "Jane"}\n```')
    assert payload == {"first_name": "Jane"}


def test_parse_llm_json_rejects_non_json():
    with pytest.raises(ValueError):
        _parse_llm_json("I could not read the document.")


def test_llm_payload_fills_gaps_but_never_overwrites():
    baseline = extract_identity_mock(_fixture("passport-partial"))
    merged = _merge_llm_payload(
        {
            "first_name": "Overwritten",       # ignored — mapper already read it
            "date_of_birth": "1988-02-29",     # accepted — mapper found nothing
            "document_number": "ZZ-TEST-LLM",
            "document_expiry": "2033-02-28",
            "confidence": 0.9,
        },
        baseline,
    )
    assert merged.first_name == "Partial"
    assert merged.date_of_birth == "1988-02-29"
    assert merged.document_number == "ZZ-TEST-LLM"
    assert merged.confidence == 0.9  # declared value caps the complete-document 1.0


def test_llm_confidence_cannot_raise_the_score():
    baseline = extract_identity_mock(_fixture("passport-partial"))
    merged = _merge_llm_payload({"confidence": 1.0}, baseline)
    assert merged.confidence == pytest.approx(0.55)


# ---------- hand-off to the Decision Agent (#441) ----------


def test_extracted_identity_feeds_make_decision():
    identity = _extract("passport-complete")
    decision = _run(
        make_decision(
            identity,
            SanctionsResult(status="clear", confidence=0.94),
            RiskAssessment(risk_score=0.1, risk_band="low"),
        )
    )
    assert decision.decision == "approve"


def test_low_confidence_extraction_forces_escalation():
    identity = _extract("passport-partial")  # confidence 0.55 → above the floor
    low = ExtractedIdentity(**{**identity.to_dict(), "confidence": 0.3})
    decision = _run(
        make_decision(
            low,
            SanctionsResult(status="clear", confidence=0.94),
            RiskAssessment(risk_score=0.1, risk_band="low"),
        )
    )
    assert decision.decision == "escalate"
    assert decision.requires_human_review is True
