"""Decision types for governance evaluation results."""

from enum import Enum
from typing import Any, Dict, List, Optional
import time
import uuid


class DecisionAction(str, Enum):
    """Governance decision actions."""

    ALLOW = "ALLOW"
    DENY = "DENY"
    REQUIRE_APPROVAL = "REQUIRE_APPROVAL"
    REVISE = "REVISE"


class Decision:
    """Structured governance decision with audit evidence.

    Every filter evaluation produces a Decision that captures:
    - What was decided (ALLOW/DENY/REQUIRE_APPROVAL/REVISE)
    - Why (reason + reason_codes)
    - Risk assessment (risk_score 0.0-1.0)
    - Full context (function name, plugin, arguments)
    - Timing and cost data
    """

    def __init__(
        self,
        action: DecisionAction,
        reason: str,
        reason_codes: Optional[List[str]] = None,
        risk_score: float = 0.0,
        policy_version: str = "1",
        findings: Optional[List[Dict[str, Any]]] = None,
        evaluation_time_ms: float = 0.0,
        function_name: Optional[str] = None,
        plugin_name: Optional[str] = None,
        arguments: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None,
        cost_reserved: float = 0.0,
        cost_actual: float = 0.0,
        cumulative_cost: float = 0.0,
    ):
        self.correlation_id = str(uuid.uuid4())
        self.timestamp_ms = time.time() * 1000
        self.action = action
        self.reason = reason
        self.reason_codes = reason_codes or []
        self.risk_score = risk_score
        self.policy_version = policy_version
        self.findings = findings or []
        self.evaluation_time_ms = evaluation_time_ms
        self.function_name = function_name
        self.plugin_name = plugin_name
        self.arguments = arguments
        self.session_id = session_id
        self.cost_reserved = cost_reserved
        self.cost_actual = cost_actual
        self.cumulative_cost = cumulative_cost

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dict for audit trail."""
        return {
            "correlation_id": self.correlation_id,
            "timestamp_ms": self.timestamp_ms,
            "action": self.action.value,
            "reason": self.reason,
            "reason_codes": self.reason_codes,
            "risk_score": self.risk_score,
            "policy_version": self.policy_version,
            "findings": self.findings,
            "evaluation_time_ms": self.evaluation_time_ms,
            "function_name": self.function_name,
            "plugin_name": self.plugin_name,
            "arguments": self.arguments,
            "session_id": self.session_id,
            "cost_reserved": self.cost_reserved,
            "cost_actual": self.cost_actual,
            "cumulative_cost": self.cumulative_cost,
        }

    @property
    def is_allowed(self) -> bool:
        return self.action == DecisionAction.ALLOW

    def __repr__(self) -> str:
        return (
            f"Decision(action={self.action.value}, "
            f"function={self.plugin_name}-{self.function_name}, "
            f"reason={self.reason!r})"
        )
