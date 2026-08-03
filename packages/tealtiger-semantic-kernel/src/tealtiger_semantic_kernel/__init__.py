"""tealtiger-semantic-kernel: Deterministic governance filter for Semantic Kernel.

Provides function-call authorization, PII scanning, cost budgets, and structured
audit trail via Semantic Kernel's native Filter system.

Works with both FunctionInvocationFilter and AutoFunctionInvocationFilter.
"""

from tealtiger_semantic_kernel.filter import TealTigerFilter
from tealtiger_semantic_kernel.policy import (
    GovernancePolicy,
    FunctionPolicy,
    PIIScanPolicy,
    SecretScanPolicy,
)
from tealtiger_semantic_kernel.budget import BudgetTracker
from tealtiger_semantic_kernel.decision import Decision, DecisionAction
from tealtiger_semantic_kernel.exceptions import GovernanceDenyError

__all__ = [
    "TealTigerFilter",
    "GovernancePolicy",
    "FunctionPolicy",
    "PIIScanPolicy",
    "SecretScanPolicy",
    "BudgetTracker",
    "Decision",
    "DecisionAction",
    "GovernanceDenyError",
]
__version__ = "0.1.0"
