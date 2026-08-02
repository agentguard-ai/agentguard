from pydantic import field_validator

from .generated.action import Action
from .generated.approval import Approval
from .generated.decision import Decision as GeneratedDecision
from .generated.decision import ReasonCode
from .generated.execution_receipt import ExecutionReceipt
from .generated.target_capability import TargetCapability


class Decision(GeneratedDecision):
    """Generated Decision model with JSON Schema uniqueness semantics."""

    @field_validator("reason_codes")
    @classmethod
    def reason_codes_must_be_unique(
        cls, reason_codes: list[ReasonCode]
    ) -> list[ReasonCode]:
        values = [reason_code.root for reason_code in reason_codes]
        if len(values) != len(set(values)):
            raise ValueError("reason_codes must contain unique items")
        return reason_codes

Contract = Action | Decision | Approval | ExecutionReceipt | TargetCapability

__all__ = [
    "Action",
    "Approval",
    "Contract",
    "Decision",
    "ExecutionReceipt",
    "TargetCapability",
]
