"""CLI entry point for tealtiger-openhands governance hook."""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from tealtiger_openhands.config import load_config
from tealtiger_openhands.engine import GovernanceEngine


def main() -> None:
    config_path = _get_config_path()
    event = _read_event()
    if event is None:
        sys.exit(0)

    try:
        policy = load_config(config_path)
    except Exception as e:
        sys.stderr.write(f"[tealtiger-openhands] Config error: {e}\n")
        sys.exit(1)

    engine = GovernanceEngine(policy)
    session_id = event.get("session_id", "unknown")
    _load_session_state(engine, session_id)
    decision = engine.evaluate(event)
    _save_session_state(engine, session_id)
    _append_audit_log(decision, session_id)

    print(json.dumps(decision.to_hook_output()))
    sys.exit(decision.exit_code)


def _get_config_path() -> str:
    args = sys.argv[1:]
    for i, arg in enumerate(args):
        if arg == "--config" and i + 1 < len(args):
            return args[i + 1]
        if arg.startswith("--config="):
            return arg.split("=", 1)[1]
    env_config = os.environ.get("TEALTIGER_OPENHANDS_CONFIG")
    if env_config:
        return env_config
    project_dir = os.environ.get("OPENHANDS_PROJECT_DIR", ".")
    candidates = [
        os.path.join(project_dir, ".openhands", "governance.yml"),
        os.path.join(project_dir, ".openhands", "governance.yaml"),
        os.path.join(project_dir, ".openhands", "governance.json"),
    ]
    for candidate in candidates:
        if os.path.exists(candidate):
            return candidate
    return ""


def _read_event() -> Optional[Dict[str, Any]]:
    if sys.stdin.isatty():
        return None
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            return None
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def _get_state_dir(session_id: str) -> Path:
    project_dir = os.environ.get("OPENHANDS_PROJECT_DIR", ".")
    state_dir = Path(project_dir) / ".openhands" / ".tealtiger-state"
    state_dir.mkdir(parents=True, exist_ok=True)
    return state_dir


def _load_session_state(engine: GovernanceEngine, session_id: str) -> None:
    if not engine.policy.budget:
        return
    state_dir = _get_state_dir(session_id)
    state_file = state_dir / f"{session_id}.json"
    if state_file.exists():
        try:
            state = json.loads(state_file.read_text())
            engine.policy.budget._current_cost = state.get("current_cost", 0.0)
            engine.policy.budget._current_iterations = state.get("current_iterations", 0)
        except (json.JSONDecodeError, OSError):
            pass


def _save_session_state(engine: GovernanceEngine, session_id: str) -> None:
    if not engine.policy.budget:
        return
    state_dir = _get_state_dir(session_id)
    state_file = state_dir / f"{session_id}.json"
    state = {
        "current_cost": engine.policy.budget._current_cost,
        "current_iterations": engine.policy.budget._current_iterations,
    }
    try:
        state_file.write_text(json.dumps(state))
    except OSError:
        pass


def _append_audit_log(decision, session_id: str) -> None:
    state_dir = _get_state_dir(session_id)
    audit_file = state_dir / "audit.jsonl"
    try:
        with open(audit_file, "a") as f:
            f.write(json.dumps(decision.to_dict()) + "\n")
    except OSError:
        pass


if __name__ == "__main__":
    main()
