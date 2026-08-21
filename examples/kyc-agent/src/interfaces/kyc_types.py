"""KYC agent type interfaces.

> **Scope note (from ../README.md):** `RiskAssessment` is a minimal stub that
> matches the fields referenced in the interface published on issue #441. It
> will be replaced by the canonical type produced by sub-issue #440.
>
> `ExtractedIdentity` is **canonical** as of sub-issue #438 (document
> extraction) and `SanctionsResult` as of #439 (sanctions screening); both
> match the interfaces published on those issues. `KYCDecision` is canonical
> per #441 and is the return type of `make_decision`.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Literal, Optional


# ---------- CANONICAL (owned by #438) ----------


@dataclass(frozen=True)
class ExtractedIdentity:
    """Structured identity extracted from a customer document (#438).

    Produced by ``agents.document_extractor.extract_identity``. Field names
    and order match the interface published on issue #438.

    ``confidence`` is the extractor's own confidence in [0.0, 1.0]. The
    Decision Agent (#441) treats a confidence below its policy floor as an
    escalation trigger, so extractors must not report 1.0 for a partially
    recovered document.
    """

    first_name: str
    last_name: str
    date_of_birth: str      # ISO 8601 date, e.g. "1985-03-15"
    nationality: str        # ISO 3166-1 alpha-2, e.g. "ZA"
    document_type: str      # e.g. "passport", "national_id", "drivers_license"
    document_number: str
    document_expiry: str    # ISO 8601 date, e.g. "2029-01-01"
    address: Optional[str] = None
    confidence: float = 0.0

    @property
    def full_name(self) -> str:
        """Convenience join. Not a dataclass field — excluded from hashing."""
        return " ".join(part for part in (self.first_name, self.last_name) if part)

    def to_dict(self) -> dict[str, Any]:
        """Canonical serialisable form (declaration order)."""
        return asdict(self)


# ---------- CANONICAL (owned by #439) ----------


@dataclass(frozen=True)
class SanctionsResult:
    """Output of the Sanctions Screening Agent (sub-issue #439).

    ``status`` is the load-bearing field for the Decision Agent's hard
    overrides: ``exact_match`` is a veto, ``near_match`` forbids auto
    approval. ``confidence`` is confidence in *that verdict* — for ``clear``
    it is the distance from the closest entry on the list, not a name
    similarity score.
    """

    status: Literal["clear", "near_match", "exact_match"]
    confidence: float
    matched_entity: Optional[str] = None
    list_source: Optional[str] = None  # "OFAC_SDN", "EU_SANCTIONS", "UN_SANCTIONS"


# ---------- STUBS (to be deleted when upstream types land) ----------


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
