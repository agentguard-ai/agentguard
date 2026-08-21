"""Deterministic KYC Decision Agent (sub-issue #441 / KYC #6).

Quesen-shaped ``make_decision`` implementation. The decision function is a
pure, deterministic mapping from ``(ExtractedIdentity, SanctionsResult,
RiskAssessment)`` to ``KYCDecision``. Same inputs plus same policy version
→ same output. The audit record produced by every call is a *replay proof*,
not a log.

Design invariants (see ../../README.md for full rationale):

1. No LLM in the scoring loop.
2. Every input is canonicalised and SHA-256 hashed; hash lives on the audit
   record.
3. Policy version is stamped on every decision; threshold changes require a
   version bump.
4. Sanctions is a veto: ``exact_match`` → reject; ``near_match`` → escalate
   minimum.
5. Identity confidence < 0.5 forces escalation.
6. All escalations name their trigger in ``escalation_reason``.

Boundary: this file produces a stable decision surface. Wrap it with
TealTiger governance at the caller (PII scan on inputs, receipt on
outputs). Do not embed governance inside the pure decision policy.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any

try:  # relative import when used as a package (e.g. from #435 scaffold)
    from ..interfaces import (
        ExtractedIdentity,
        SanctionsResult,
        RiskAssessment,
        KYCDecision,
    )
except ImportError:  # fallback for direct src/ sys.path usage in tests
    from interfaces import (  # type: ignore[no-redef]
        ExtractedIdentity,
        SanctionsResult,
        RiskAssessment,
        KYCDecision,
    )

POLICY_VERSION = "kyc-decision/v1.0.0"


@dataclass(frozen=True)
class DecisionPolicy:
    """Every knob in the policy lives here. Change one → bump version."""

    # Threshold bands per issue #441 body.
    approve_below: float = 0.4
    reject_above: float = 0.8
    # Composite weighting: sanctions dominates risk (regulatory bias).
    sanctions_weight: float = 0.6
    risk_weight: float = 0.4
    # Identity confidence floor for auto-approval.
    identity_confidence_floor: float = 0.5

    def __post_init__(self) -> None:  # defensive validation
        assert 0.0 <= self.approve_below <= self.reject_above <= 1.0, (
            "policy thresholds must satisfy 0 <= approve_below <= reject_above <= 1"
        )
        assert abs((self.sanctions_weight + self.risk_weight) - 1.0) < 1e-9, (
            "weights must sum to 1.0"
        )


DEFAULT_POLICY = DecisionPolicy()


# Sanctions status → numeric signal in [0, 1]. Deterministic table.
# "confirmed" is the pre-#439 spelling of "exact_match"; both are honoured so
# an in-flight caller cannot silently fall through to the unknown-status path.
_SANCTIONS_SIGNAL: dict[str, float] = {
    "clear": 0.0,
    "near_match": 0.6,
    "exact_match": 1.0,
    "confirmed": 1.0,
}

#: Statuses that reject regardless of the composite score.
_HARD_REJECT_STATUSES = frozenset({"exact_match", "confirmed"})


def _canonicalise(obj: Any) -> Any:
    """Recursively coerce dataclasses / tuples / dicts to a JSON-safe shape.

    Keys are sorted at every level of the returned structure by
    ``json.dumps(..., sort_keys=True)``; there is no further work needed here.
    """
    if hasattr(obj, "__dataclass_fields__"):
        return {k: _canonicalise(v) for k, v in asdict(obj).items()}
    if isinstance(obj, dict):
        return {k: _canonicalise(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_canonicalise(v) for v in obj]
    return obj


def _inputs_hash(
    identity: ExtractedIdentity,
    sanctions: SanctionsResult,
    risk: RiskAssessment,
) -> str:
    payload = {
        "identity": _canonicalise(identity),
        "sanctions": _canonicalise(sanctions),
        "risk": _canonicalise(risk),
    }
    material = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return "sha256:" + hashlib.sha256(material).hexdigest()


def _composite_score(sanctions: SanctionsResult, risk: RiskAssessment, policy: DecisionPolicy) -> float:
    sanctions_signal = _SANCTIONS_SIGNAL.get(sanctions.status, 1.0)  # unknown → conservative
    risk_signal = min(1.0, max(0.0, float(risk.risk_score)))
    return (policy.sanctions_weight * sanctions_signal) + (policy.risk_weight * risk_signal)


def _band(score: float, policy: DecisionPolicy) -> str:
    if score < policy.approve_below:
        return "approve"
    if score > policy.reject_above:
        return "reject"
    return "escalate"


async def make_decision(
    identity: ExtractedIdentity,
    sanctions: SanctionsResult,
    risk: RiskAssessment,
    *,
    policy: DecisionPolicy = DEFAULT_POLICY,
) -> KYCDecision:
    """Return a deterministic KYC decision for the given inputs.

    Async signature matches the published interface on issue #441. The
    function performs no I/O; ``await``-ing it is instantaneous.
    """
    composite = _composite_score(sanctions, risk, policy)
    initial_band = _band(composite, policy)

    # ----- Hard overrides (applied AFTER threshold; escalation reasons named) -----
    escalation_reasons: list[str] = []
    final_band = initial_band

    if sanctions.status in _HARD_REJECT_STATUSES:
        # An exact sanctions match is a hard reject regardless of composite.
        final_band = "reject"
        escalation_reasons.append("sanctions_exact_match_hard_reject")
    elif sanctions.status == "near_match":
        # A near-match cannot be auto-approved. Escalate minimum.
        if final_band == "approve":
            final_band = "escalate"
            escalation_reasons.append("sanctions_near_match_forbids_auto_approve")

    if identity.confidence < policy.identity_confidence_floor and final_band == "approve":
        final_band = "escalate"
        escalation_reasons.append(
            f"identity_confidence_below_{policy.identity_confidence_floor}"
        )

    requires_human = final_band != "approve"
    escalation_reason: str | None
    if escalation_reasons:
        escalation_reason = "; ".join(escalation_reasons)
    elif final_band == "escalate":
        escalation_reason = "composite_score_in_escalate_band"
    elif final_band == "reject":
        escalation_reason = "composite_score_above_reject_threshold"
    else:
        escalation_reason = None

    reasoning = (
        f"composite={composite:.4f} band_initial={initial_band} band_final={final_band} "
        f"sanctions={sanctions.status} risk_band={risk.risk_band} "
        f"identity_confidence={identity.confidence:.2f} policy={POLICY_VERSION}"
    )

    audit_record: dict[str, Any] = {
        "policy_version": POLICY_VERSION,
        "policy": asdict(policy),
        "inputs_hash": _inputs_hash(identity, sanctions, risk),
        "composite_score": round(composite, 6),
        "initial_band": initial_band,
        "final_band": final_band,
        "overrides_applied": escalation_reasons,
        "emitted_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }

    return KYCDecision(
        decision=final_band,  # type: ignore[arg-type]
        risk_score=round(composite, 6),
        reasoning=reasoning,
        requires_human_review=requires_human,
        escalation_reason=escalation_reason,
        audit_record=audit_record,
    )
