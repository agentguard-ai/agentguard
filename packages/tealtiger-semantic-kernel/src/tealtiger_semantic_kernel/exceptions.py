"""Exceptions for tealtiger-semantic-kernel governance."""

from typing import Any, Dict


class GovernanceDenyError(Exception):
    """Raised when a function invocation is denied by governance policy.

    Contains the full decision record for audit purposes.
    """

    def __init__(self, decision: Dict[str, Any]):
        self.decision = decision
        reason = decision.get("reason", "Policy violation")
        super().__init__(f"Governance DENY: {reason}")


class GovernanceConfigError(Exception):
    """Raised when governance configuration is invalid."""

    pass
