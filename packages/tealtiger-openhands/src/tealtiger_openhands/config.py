"""Configuration loader for governance policies."""

import json
import os
from typing import Any, Dict

from tealtiger_openhands.policy import (
    GovernancePolicy, FilePolicy, CommandPolicy, SecretScanPolicy, BudgetPolicy,
)
from tealtiger_openhands.exceptions import GovernanceConfigError


def load_config(path: str) -> GovernancePolicy:
    if not path or not os.path.exists(path):
        return GovernancePolicy(mode="OBSERVE")
    try:
        with open(path, "r") as f:
            raw = f.read()
    except OSError as e:
        raise GovernanceConfigError(f"Cannot read config file: {e}")

    if path.endswith((".yml", ".yaml")):
        data = _parse_yaml(raw)
    elif path.endswith(".json"):
        data = _parse_json(raw)
    else:
        try:
            data = _parse_json(raw)
        except GovernanceConfigError:
            data = _parse_yaml(raw)
    return _build_policy(data)


def _parse_yaml(raw: str) -> Dict[str, Any]:
    try:
        import yaml
        data = yaml.safe_load(raw)
        if not isinstance(data, dict):
            raise GovernanceConfigError("YAML config must be a mapping")
        return data
    except ImportError:
        raise GovernanceConfigError("PyYAML required for YAML config. Install: pip install pyyaml")
    except Exception as e:
        raise GovernanceConfigError(f"Invalid YAML: {e}")


def _parse_json(raw: str) -> Dict[str, Any]:
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise GovernanceConfigError("JSON config must be an object")
        return data
    except json.JSONDecodeError as e:
        raise GovernanceConfigError(f"Invalid JSON: {e}")


def _build_policy(data: Dict[str, Any]) -> GovernancePolicy:
    mode = data.get("mode", "ENFORCE").upper()
    file_policy = None
    file_data = data.get("file_policy") or data.get("files")
    if file_data:
        file_policy = FilePolicy(
            read_allowlist=file_data.get("read_allowlist", []),
            read_denylist=file_data.get("read_denylist", []),
            write_allowlist=file_data.get("write_allowlist", []),
            write_denylist=file_data.get("write_denylist", []),
        )
    command_policy = None
    cmd_data = data.get("command_policy") or data.get("commands")
    if cmd_data:
        command_policy = CommandPolicy(
            allowlist=cmd_data.get("allowlist", []),
            denylist=cmd_data.get("denylist", []),
            block_network_access=cmd_data.get("block_network_access", False),
        )
    secret_scan = None
    secret_data = data.get("secret_scan") or data.get("secrets")
    if secret_data:
        if isinstance(secret_data, bool):
            secret_scan = SecretScanPolicy(enabled=secret_data)
        else:
            secret_scan = SecretScanPolicy(
                enabled=secret_data.get("enabled", True),
                action=secret_data.get("action", "block"),
                categories=secret_data.get("categories", [
                    "api_key", "password", "token", "private_key", "aws_key", "connection_string"
                ]),
            )
    budget = None
    budget_data = data.get("budget")
    if budget_data:
        budget = BudgetPolicy(
            per_session_usd=budget_data.get("per_session_usd", float("inf")),
            max_iterations=budget_data.get("max_iterations", 0),
        )
    return GovernancePolicy(
        mode=mode, file_policy=file_policy, command_policy=command_policy,
        secret_scan=secret_scan, budget=budget,
    )
