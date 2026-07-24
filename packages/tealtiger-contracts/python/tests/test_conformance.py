from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from tealtiger_contracts import (
    Contract,
    ContractValidationError,
    serialize_contract,
    validate_action,
    validate_approval,
    validate_decision,
    validate_execution_receipt,
    validate_target_capability,
)


PACKAGE_DIRECTORY = Path(__file__).resolve().parents[2]
VECTOR_DOCUMENT = json.loads(
    (PACKAGE_DIRECTORY / "vectors" / "conformance.json").read_text(encoding="utf-8")
)

VALIDATORS: dict[str, Callable[[dict[str, Any]], Contract]] = {
    "Action": validate_action,
    "Decision": validate_decision,
    "Approval": validate_approval,
    "ExecutionReceipt": validate_execution_receipt,
    "TargetCapability": validate_target_capability,
}


def test_vector_corpus_covers_every_contract() -> None:
    assert VECTOR_DOCUMENT["contract_package_version"] == "1.0.0"

    for contract in VALIDATORS:
        vectors = [
            vector
            for vector in VECTOR_DOCUMENT["vectors"]
            if vector["contract"] == contract
        ]
        assert any(vector["expected"] == "valid" for vector in vectors)
        assert any(vector["expected"] == "invalid" for vector in vectors)
        assert any(
            vector["instance"]["contract_version"] != "1.0.0"
            for vector in vectors
        )


@pytest.mark.parametrize(
    "vector",
    VECTOR_DOCUMENT["vectors"],
    ids=lambda vector: f"{vector['contract']}-{vector['id']}",
)
def test_shared_conformance_vector(vector: dict[str, Any]) -> None:
    validate = VALIDATORS[vector["contract"]]
    instance = json.loads(json.dumps(vector["instance"]))

    if vector["expected"] == "valid":
        parsed = validate(instance)
        serialized = serialize_contract(parsed)
        assert serialized == vector["instance"]
        assert json.loads(json.dumps(serialized)) == vector["instance"]
        return

    with pytest.raises(ContractValidationError) as captured:
        validate(instance)

    expected_path = vector.get("expected_error_path", "validation failed")
    assert expected_path in str(captured.value)


def test_mutated_models_cannot_bypass_validation() -> None:
    source = next(
        vector["instance"]
        for vector in VECTOR_DOCUMENT["vectors"]
        if vector["id"] == "decision-allow-valid"
    )
    decision = validate_decision(json.loads(json.dumps(source)))

    with pytest.raises(ValidationError):
        decision.risk_score = 101

    decision.reason_codes.append(decision.reason_codes[0])
    with pytest.raises(ContractValidationError, match="reason_codes"):
        serialize_contract(decision)
