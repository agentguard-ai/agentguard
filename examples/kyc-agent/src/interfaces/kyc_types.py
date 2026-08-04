"""KYC agent type interfaces.

> **Scope note (from ../README.md):** `ExtractedIdentity`, `SanctionsResult`,
> and `RiskAssessment` are minimal stubs that match the fields referenced
> in the interface published on issue #441. They will be replaced by the
> canonical types produced by sub-issues #438 / #439 / #440.
>
> `KYCDecision` is authored here per the #441 deliverables list and is the
> canonical return type of `make_decision`.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Literal, Optional


# ---------- STUBS (to be deleted when upstream types land) ----------


@dataclass(frozen=True)
class ExtractedIdentity:
    """Output of the Document Extraction Agent (sub-issue #438).

    Only the fields the Decision Agent needs to reason about are modelled
    here. The real type will carry additional evidence and provenance.
    """

    full_name: str
    date_of_birth: str  # ISO 8601 date, e.g. "1980-05-14"
    country: str        # ISO 3166-1 alpha-2, e.g. "ZA"
    document_type: str  # e.g. "passport", "national_id", "drivers_license"
    confidence: float   # extractor confidence in [0.0, 1.0]


@dataclass(frozen=True)
class SanctionsResult:
    """Output of the Sanctions Screening Agent (sub-issue #439).

    ``status`` is the load-bearing field for the Decision Agent's hard
    overrides. ``matches`` is preserved so the audit record can be replayed.
    """

    status: Literal["clear", "near_match", "confirmed"]
    matched_lists: tuple[str, ...] = ()  # e.g. ("OFAC-SDN", "EU-CFSP")
    matches: tuple[dict, ...] = ()       # opaque evidence blobs
    confidence: float = 1.0


@dataclass(frozen=True)
class RiskAssessment:
    """Output of the Risk Scoring Agent (sub-issue #440).

    ``risk_score`` in [0.0, 1.0] is the primary numeric input for the
    composite score computed by the Decision Agent.
    """

    risk_score: float
    risk_band: Literal["low", "medium", "high"]
    factors: tuple[str, ...] = ()  # human-readable factor labels, e.g. ("high_risk_country", "pep")


# ---------- CANONICAL (owned by #441) ----------


@dataclass
class KYCDecision:
    """Return type of ``make_decision`` — canonical to sub-issue #441.

    ``audit_record`` is a self-contained replay proof: given
    ``(audit_record['inputs_hash'], audit_record['policy_version'])`` the
    exact same ``KYCDecision`` can be reconstructed by re-running
    ``make_decision`` against the same policy. This is what makes the
    audit trail *evidence* rather than a *log*.
    """

    decision: Literal["approve", "escalate", "reject"]
    risk_score: float
    reasoning: str
    requires_human_review: bool
    escalation_reason: Optional[str]
    audit_record: dict = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Canonical serialisable form (stable ordering)."""
        return asdict(self)
