"""tealtiger-openhands: Deterministic governance hooks for OpenHands.

Provides pre-tool-use governance for OpenHands agents — file access control,
command allowlisting, secret scanning, cost budgets, and structured audit evidence.

Works with OpenHands' native hook system (compatible with Claude Code hooks).
"""

from tealtiger_openhands.policy import (
    GovernancePolicy,
    FilePolicy,
    CommandPolicy,
    SecretScanPolicy,
    BudgetPolicy,
)
from tealtiger_openhands.engine import GovernanceEngine
from tealtiger_openhands.decision import Decision, DecisionAction
from tealtiger_openhands.exceptions import GovernanceDenyError
from tealtiger_openhands.hooks_config import generate_hooks_json

__all__ = [
    "GovernancePolicy",
    "FilePolicy",
    "CommandPolicy",
    "SecretScanPolicy",
    "BudgetPolicy",
    "GovernanceEngine",
    "Decision",
    "DecisionAction",
    "GovernanceDenyError",
    "generate_hooks_json",
]
__version__ = "0.1.0"
