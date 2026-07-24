from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator


class ContractModel(BaseModel):
    """Strict, forward-compatible base for generated contract models."""

    # Primitive fields are generated as Pydantic Strict* types. Keeping model-level
    # strict mode off lets JSON strings populate generated Enum fields normally.
    model_config = ConfigDict(extra="allow", validate_assignment=True)

    @field_validator("*", mode="before")
    @classmethod
    def reject_explicit_null(cls, value: Any) -> Any:
        """Keep optional JSON properties non-nullable when they are present."""

        if value is None:
            raise ValueError("null is not allowed")
        return value
