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


class Decision:
    """Structured governance decision with audit evidence."""

    def __init__(
        self,
        action: DecisionAction,
        reason: str,
        reason_codes: Optional[List[str]] = None,
        risk_score: float = 0.0,
        policy_version: str = "1",
        findings: Optional[List[Dict[str, Any]]] = None,
        evaluation_time_ms: float = 0.0,
        tool_name: Optional[str] = None,
        tool_input: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None,
        cost_tracked: float = 0.0,
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
        self.tool_name = tool_name
        self.tool_input = tool_input
        self.session_id = session_id
        self.cost_tracked = cost_tracked
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
            "tool_name": self.tool_name,
            "tool_input": self.tool_input,
            "session_id": self.session_id,
            "cost_tracked": self.cost_tracked,
            "cumulative_cost": self.cumulative_cost,
        }

    def to_hook_output(self) -> Dict[str, Any]:
        """Convert to OpenHands hook output format."""
        output: Dict[str, Any] = {
            "decision": "allow" if self.action == DecisionAction.ALLOW else "deny",
            "reason": self.reason,
        }
        if self.findings:
            output["additionalContext"] = (
                f"[TealTiger Governance] {self.action.value}: "
                f"{', '.join(self.reason_codes)}. "
                f"Risk score: {self.risk_score:.2f}. "
                f"Findings: {len(self.findings)}"
            )
        elif self.action == DecisionAction.DENY:
            output["additionalContext"] = (
                f"[TealTiger Governance] DENIED: {self.reason}. "
                f"The agent should try an alternative approach."
            )
        return output

    @property
    def is_allowed(self) -> bool:
        return self.action == DecisionAction.ALLOW

    @property
    def exit_code(self) -> int:
        return 0 if self.is_allowed else 2
