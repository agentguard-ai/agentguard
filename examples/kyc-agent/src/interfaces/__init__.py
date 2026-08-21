"""Type interfaces for the KYC agent pipeline.

`ExtractedIdentity` (#438), `SanctionsResult` (#439) and `KYCDecision` (#441)
are canonical. `RiskAssessment` remains a **temporary stub** until the
canonical type lands from sub-issue #440 (risk scoring). See ../README.md
for scope.
"""
from .kyc_types import (
    ExtractedIdentity,
    SanctionsResult,
    RiskAssessment,
    KYCDecision,
)

__all__ = [
    "ExtractedIdentity",
    "SanctionsResult",
    "RiskAssessment",
    "KYCDecision",
]
