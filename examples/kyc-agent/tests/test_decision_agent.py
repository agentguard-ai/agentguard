"""Tests for the deterministic KYC Decision Agent (sub-issue #441).

Every test is offline, deterministic, and free of external dependencies.
The suite covers:

  - Threshold band correctness (approve / escalate / reject).
  - Hard overrides for sanctions status.
  - Identity confidence floor.
  - Same-input-same-output determinism (idempotency + hash stability).
  - Audit record structure and replay properties.
  - Custom policy plumbing.
"""
from __future__ import annotations

import asyncio
import json

import pytest

from agents.decision_agent import (
    DEFAULT_POLICY,
    DecisionPolicy,
    POLICY_VERSION,
    make_decision,
)
from interfaces import (
    ExtractedIdentity,
    RiskAssessment,
    SanctionsResult,
)


# ---------- fixtures ----------


def _identity(confidence: float = 0.95) -> ExtractedIdentity:
    return ExtractedIdentity(
        first_name="Ada",
        last_name="Lovelace",
        date_of_birth="1980-05-14",
        nationality="ZA",
        document_type="passport",
        document_number="ZZ-TEST-0001",
        document_expiry="2031-01-01",
        address="1 Synthetic Way, Testville, ZZ",
        confidence=confidence,
    )


def _clear() -> SanctionsResult:
    return SanctionsResult(status="clear")


def _near_match() -> SanctionsResult:
    return SanctionsResult(
        status="near_match",
        matched_lists=("OFAC-SDN",),
        matches=({"list": "OFAC-SDN", "score": 0.72},),
    )


def _confirmed() -> SanctionsResult:
    return SanctionsResult(
        status="confirmed",
        matched_lists=("OFAC-SDN", "EU-CFSP"),
        matches=({"list": "OFAC-SDN", "score": 0.99},),
    )


def _risk(score: float, band: str = "low") -> RiskAssessment:
    return RiskAssessment(risk_score=score, risk_band=band)  # type: ignore[arg-type]


def _run(coro):
    return asyncio.run(coro)


# ---------- threshold bands ----------


def test_low_risk_low_sanctions_approves():
    d = _run(make_decision(_identity(), _clear(), _risk(0.1)))
    assert d.decision == "approve"
    assert d.requires_human_review is False
    assert d.escalation_reason is None


def test_near_match_in_mid_composite_escalates():
    # composite = 0.6*0.6 + 0.4*0.5 = 0.36+0.20 = 0.56 -> escalate band
    d = _run(make_decision(_identity(), _near_match(), _risk(0.5)))
    assert d.decision == "escalate"
    assert d.requires_human_review is True
    assert d.escalation_reason


def test_custom_policy_can_produce_pure_threshold_reject():
    # composite = 0.5*0.6 + 0.5*0.9 = 0.75 -> above 0.5 -> reject
    custom = DecisionPolicy(
        approve_below=0.2,
        reject_above=0.5,
        sanctions_weight=0.5,
        risk_weight=0.5,
    )
    d = _run(make_decision(_identity(), _near_match(), _risk(0.9), policy=custom))
    assert d.decision == "reject"


# ---------- hard overrides ----------


def test_confirmed_sanctions_always_rejects():
    # Even with zero risk and high identity confidence, confirmed = reject.
    d = _run(make_decision(_identity(), _confirmed(), _risk(0.0)))
    assert d.decision == "reject"
    assert d.requires_human_review is True
    assert "sanctions_confirmed_hard_reject" in (d.escalation_reason or "")


def test_near_match_forbids_auto_approve():
    # composite would land in approve band, but near_match forces escalate.
    d = _run(make_decision(_identity(), _near_match(), _risk(0.0)))
    # composite = 0.6*0.6 + 0.4*0 = 0.36 -> initial band approve
    assert d.decision == "escalate"
    assert "sanctions_near_match_forbids_auto_approve" in (d.escalation_reason or "")
    assert d.audit_record["initial_band"] == "approve"
    assert d.audit_record["final_band"] == "escalate"


def test_low_identity_confidence_forces_escalate_on_approve_case():
    d = _run(make_decision(_identity(confidence=0.3), _clear(), _risk(0.05)))
    assert d.decision == "escalate"
    assert "identity_confidence_below" in (d.escalation_reason or "")


def test_low_identity_confidence_does_not_override_reject():
    d = _run(make_decision(_identity(confidence=0.1), _confirmed(), _risk(0.0)))
    assert d.decision == "reject"


# ---------- determinism ----------


def test_same_input_same_decision_and_hash():
    identity = _identity()
    sanctions = _clear()
    risk = _risk(0.1)
    a = _run(make_decision(identity, sanctions, risk))
    b = _run(make_decision(identity, sanctions, risk))
    assert a.decision == b.decision
    assert a.risk_score == b.risk_score
    assert a.audit_record["inputs_hash"] == b.audit_record["inputs_hash"]
    assert a.audit_record["policy_version"] == POLICY_VERSION


def test_hash_changes_when_any_input_changes():
    identity = _identity()
    baseline = _run(make_decision(identity, _clear(), _risk(0.1)))
    changed = _run(make_decision(identity, _clear(), _risk(0.11)))
    assert baseline.audit_record["inputs_hash"] != changed.audit_record["inputs_hash"]


def test_audit_record_serialises_to_stable_json():
    d = _run(make_decision(_identity(), _clear(), _risk(0.15)))
    a = json.dumps(d.audit_record, sort_keys=True)
    b = json.dumps(d.audit_record, sort_keys=True)
    assert a == b


# ---------- audit record shape ----------


def test_audit_record_has_all_required_fields():
    d = _run(make_decision(_identity(), _clear(), _risk(0.1)))
    required = {
        "policy_version",
        "policy",
        "inputs_hash",
        "composite_score",
        "initial_band",
        "final_band",
        "overrides_applied",
        "emitted_at",
    }
    assert required.issubset(d.audit_record.keys())
    assert d.audit_record["inputs_hash"].startswith("sha256:")
    assert d.audit_record["policy_version"] == POLICY_VERSION


# ---------- custom policy ----------


def test_custom_policy_shifts_thresholds():
    strict = DecisionPolicy(
        approve_below=0.1,
        reject_above=0.3,
        sanctions_weight=0.5,
        risk_weight=0.5,
    )
    # composite = 0.5*0 + 0.5*0.2 = 0.1 -> NOT below approve_below=0.1 -> escalate
    d = _run(make_decision(_identity(), _clear(), _risk(0.2), policy=strict))
    assert d.decision == "escalate"


def test_invalid_policy_thresholds_rejected():
    with pytest.raises(AssertionError):
        DecisionPolicy(approve_below=0.9, reject_above=0.1)
    with pytest.raises(AssertionError):
        DecisionPolicy(sanctions_weight=0.7, risk_weight=0.7)


# ---------- interface contract ----------


def test_return_type_and_shape():
    d = _run(make_decision(_identity(), _clear(), _risk(0.1)))
    assert d.decision in {"approve", "escalate", "reject"}
    assert isinstance(d.risk_score, float)
    assert isinstance(d.reasoning, str) and d.reasoning
    assert isinstance(d.requires_human_review, bool)
    assert d.escalation_reason is None or isinstance(d.escalation_reason, str)
    assert isinstance(d.audit_record, dict)


def test_all_three_decision_paths_reachable():
    approve = _run(make_decision(_identity(), _clear(), _risk(0.05)))
    escalate = _run(make_decision(_identity(), _near_match(), _risk(0.0)))
    reject = _run(make_decision(_identity(), _confirmed(), _risk(0.0)))
    assert {approve.decision, escalate.decision, reject.decision} == {"approve", "escalate", "reject"}
