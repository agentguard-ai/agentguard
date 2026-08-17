"""Type interfaces for the KYC agent pipeline.

Everything in this package is a **temporary stub** until the canonical
types land from sub-issues #435 (scaffold), #438 (document extraction),
#439 (sanctions), and #440 (risk scoring). See ../README.md for scope.
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
