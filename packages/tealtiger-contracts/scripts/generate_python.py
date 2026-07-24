from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path


PACKAGE_DIRECTORY = Path(__file__).resolve().parents[1]
SCHEMA_DIRECTORY = PACKAGE_DIRECTORY / "schemas"
OUTPUT_DIRECTORY = (
    PACKAGE_DIRECTORY / "python" / "src" / "tealtiger_contracts" / "generated"
)

CONTRACTS = (
    ("action.schema.json", "action.py"),
    ("decision.schema.json", "decision.py"),
    ("approval.schema.json", "approval.py"),
    ("execution-receipt.schema.json", "execution_receipt.py"),
    ("target-capability.schema.json", "target_capability.py"),
)


def generate(schema_path: Path, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    command = [
        sys.executable,
        "-m",
        "datamodel_code_generator",
        "--input",
        str(schema_path),
        "--input-file-type",
        "jsonschema",
        "--output",
        str(output_path),
        "--output-model-type",
        "pydantic_v2.BaseModel",
        "--target-python-version",
        "3.10",
        "--base-class",
        "tealtiger_contracts._base.ContractModel",
        "--extra-fields",
        "allow",
        "--field-constraints",
        "--strict-types",
        "str",
        "bytes",
        "int",
        "float",
        "bool",
        "--use-schema-description",
        "--use-field-description",
        "--disable-timestamp",
        "--use-standard-collections",
        "--use-union-operator",
        "--use-title-as-name",
        "--collapse-root-models",
        "--formatters",
        "builtin",
    ]
    subprocess.run(command, check=True)
    generated = output_path.read_text(encoding="utf-8")
    with output_path.open("w", encoding="utf-8", newline="\n") as output:
        output.write(generated)


def check_generated() -> int:
    stale: list[Path] = []
    with tempfile.TemporaryDirectory(prefix="tealtiger-contracts-") as temporary:
        temporary_directory = Path(temporary)
        for schema_name, output_name in CONTRACTS:
            candidate = temporary_directory / output_name
            generate(SCHEMA_DIRECTORY / schema_name, candidate)
            committed = OUTPUT_DIRECTORY / output_name
            if not committed.exists() or candidate.read_bytes() != committed.read_bytes():
                stale.append(committed)

    for path in stale:
        print(
            f"Generated Python is stale: {path.relative_to(PACKAGE_DIRECTORY)}",
            file=sys.stderr,
        )

    if stale:
        print(
            "Run python scripts/generate_python.py in packages/tealtiger-contracts "
            "and commit the result.",
            file=sys.stderr,
        )
        return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Python models from JSON Schema")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail when checked-in generated models differ from generator output",
    )
    arguments = parser.parse_args()

    if arguments.check:
        return check_generated()

    for schema_name, output_name in CONTRACTS:
        output_path = OUTPUT_DIRECTORY / output_name
        generate(SCHEMA_DIRECTORY / schema_name, output_path)
        print(f"Generated {output_path.relative_to(PACKAGE_DIRECTORY)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
