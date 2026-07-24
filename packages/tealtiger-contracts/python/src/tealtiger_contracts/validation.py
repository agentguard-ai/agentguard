from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Literal, TypeVar, cast

from pydantic import ValidationError

from .models import Action, Approval, Contract, Decision, ExecutionReceipt, TargetCapability


CONTRACT_VERSION = "1.0.0"
ContractName = Literal[
    "Action",
    "Decision",
    "Approval",
    "ExecutionReceipt",
    "TargetCapability",
]
ModelT = TypeVar("ModelT", bound=Contract)


class ContractValidationError(ValueError):
    """Descriptive validation failure shared by every contract parser."""

    def __init__(self, contract: ContractName, errors: tuple[str, ...]) -> None:
        self.contract = contract
        self.errors = errors
        super().__init__(f"{contract} validation failed: {'; '.join(errors)}")


def _error_path(location: tuple[str | int, ...]) -> str:
    if not location:
        return "/"
    return "/" + "/".join(str(part) for part in location if part != "root")


def _describe_errors(error: ValidationError) -> tuple[str, ...]:
    return tuple(
        f"{_error_path(item['loc'])}: {item['msg']}"
        for item in error.errors(include_url=False, include_context=False)
    )


def _validate(
    contract: ContractName,
    model_type: type[ModelT],
    value: Mapping[str, Any] | ModelT,
) -> ModelT:
    if isinstance(value, model_type):
        payload: Mapping[str, Any] = value.model_dump(mode="python", exclude_unset=True)
    elif isinstance(value, Mapping):
        payload = value
    else:
        raise ContractValidationError(contract, ("/: Input should be an object",))

    try:
        return cast(ModelT, model_type.model_validate(dict(payload)))
    except ValidationError as error:
        raise ContractValidationError(contract, _describe_errors(error)) from error


def serialize_contract(contract: Contract) -> dict[str, Any]:
    """Revalidate and return JSON without adding omitted optional fields."""

    validated: Contract
    if isinstance(contract, Action):
        validated = validate_action(contract)
    elif isinstance(contract, Decision):
        validated = validate_decision(contract)
    elif isinstance(contract, Approval):
        validated = validate_approval(contract)
    elif isinstance(contract, ExecutionReceipt):
        validated = validate_execution_receipt(contract)
    elif isinstance(contract, TargetCapability):
        validated = validate_target_capability(contract)
    else:
        raise TypeError(f"Unsupported contract model: {type(contract).__name__}")

    return cast(dict[str, Any], validated.model_dump(mode="json", exclude_unset=True))


def validate_action(value: Mapping[str, Any] | Action) -> Action:
    return _validate("Action", Action, value)


def validate_decision(value: Mapping[str, Any] | Decision) -> Decision:
    return _validate("Decision", Decision, value)


def validate_approval(value: Mapping[str, Any] | Approval) -> Approval:
    return _validate("Approval", Approval, value)


def validate_execution_receipt(
    value: Mapping[str, Any] | ExecutionReceipt,
) -> ExecutionReceipt:
    return _validate("ExecutionReceipt", ExecutionReceipt, value)


def validate_target_capability(
    value: Mapping[str, Any] | TargetCapability,
) -> TargetCapability:
    return _validate("TargetCapability", TargetCapability, value)
