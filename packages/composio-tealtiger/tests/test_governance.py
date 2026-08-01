"""Tests for composio-tealtiger governance middleware."""

import pytest
import asyncio
from composio_tealtiger import governance_modifiers, GovernanceDenyError


@pytest.fixture
def observe_modifiers():
    return governance_modifiers(agent_id="test-agent")


@pytest.fixture
def enforce_modifiers():
    class MockEngine:
        policies = [
            {"type": "tool_allowlist", "agent": "test-agent", "allowed": ["GITHUB_*", "HACKERNEWS_*"]},
            {"type": "pii_block", "categories": ["ssn", "credit_card"]},
            {"type": "cost_limit", "max_per_session": 0.01},
        ]
    return governance_modifiers(engine=MockEngine(), mode="ENFORCE", agent_id="test-agent")


@pytest.mark.asyncio
async def test_observe_mode_allows_everything(observe_modifiers):
    """Observe mode should allow all tool calls and track them."""
    before = observe_modifiers["beforeExecute"]
    result = await before(tool_slug="GMAIL_SEND_EMAIL", toolkit_slug="gmail", params={"arguments": {"to": "test@example.com"}})
    assert result is not None  # Not blocked

    state = observe_modifiers["_governance_state"]
    assert len(state.decisions) == 1
    assert state.decisions[0]["action"] == "ALLOW"
    assert state.decisions[0]["tool_slug"] == "GMAIL_SEND_EMAIL"


@pytest.mark.asyncio
async def test_enforce_mode_blocks_unauthorized_tool(enforce_modifiers):
    """Enforce mode should block tools not in the allowlist."""
    before = enforce_modifiers["beforeExecute"]

    with pytest.raises(GovernanceDenyError) as exc_info:
        await before(tool_slug="GMAIL_SEND_EMAIL", toolkit_slug="gmail", params={"arguments": {}})

    assert "TOOL_NOT_ALLOWED" in exc_info.value.decision["reason_codes"]


@pytest.mark.asyncio
async def test_enforce_mode_allows_authorized_tool(enforce_modifiers):
    """Enforce mode should allow tools in the allowlist."""
    before = enforce_modifiers["beforeExecute"]
    result = await before(tool_slug="GITHUB_GET_REPOS", toolkit_slug="github", params={"arguments": {"owner": "composio"}})
    assert result is not None


@pytest.mark.asyncio
async def test_pii_detection_blocks_ssn(enforce_modifiers):
    """Enforce mode should block tool calls containing SSN."""
    before = enforce_modifiers["beforeExecute"]

    with pytest.raises(GovernanceDenyError) as exc_info:
        await before(
            tool_slug="GITHUB_CREATE_ISSUE",
            toolkit_slug="github",
            params={"arguments": {"body": "Customer SSN: 000-00-0000"}}
        )

    assert "PII_BLOCKED" in exc_info.value.decision["reason_codes"]


@pytest.mark.asyncio
async def test_observe_mode_detects_pii_without_blocking(observe_modifiers):
    """Observe mode should detect PII but not block."""
    before = observe_modifiers["beforeExecute"]
    result = await before(
        tool_slug="SLACK_SEND_MESSAGE",
        toolkit_slug="slack",
        params={"arguments": {"text": "Customer SSN: 000-00-0000"}}
    )
    assert result is not None  # Not blocked

    state = observe_modifiers["_governance_state"]
    assert len(state.decisions[0]["pii_detected"]) > 0
    assert state.decisions[0]["pii_detected"][0]["type"] == "ssn"


@pytest.mark.asyncio
async def test_cost_limit_enforcement(enforce_modifiers):
    """Should block when cumulative cost exceeds limit."""
    before = enforce_modifiers["beforeExecute"]

    # Make several calls to exhaust the $0.01 budget
    for i in range(5):
        try:
            await before(
                tool_slug="GITHUB_GET_REPOS",
                toolkit_slug="github",
                params={"arguments": {"owner": "test"}}
            )
        except GovernanceDenyError as e:
            assert "COST_LIMIT_EXCEEDED" in e.decision["reason_codes"]
            return

    pytest.fail("Cost limit should have been exceeded")


@pytest.mark.asyncio
async def test_audit_trail_produced(observe_modifiers):
    """Every call should produce an audit entry."""
    before = observe_modifiers["beforeExecute"]

    await before(tool_slug="GITHUB_GET_REPOS", toolkit_slug="github", params={"arguments": {}})
    await before(tool_slug="SLACK_SEND_MESSAGE", toolkit_slug="slack", params={"arguments": {}})

    state = observe_modifiers["_governance_state"]
    assert len(state.decisions) == 2
    assert all("correlation_id" in d for d in state.decisions)
    assert all("timestamp_ms" in d for d in state.decisions)
    assert all("evaluation_time_ms" in d for d in state.decisions)


@pytest.mark.asyncio
async def test_evaluation_time_under_5ms(observe_modifiers):
    """Governance evaluation should complete in under 5ms."""
    before = observe_modifiers["beforeExecute"]

    await before(
        tool_slug="GITHUB_GET_REPOS",
        toolkit_slug="github",
        params={"arguments": {"owner": "composio", "description": "A" * 1000}}
    )

    state = observe_modifiers["_governance_state"]
    assert state.decisions[0]["evaluation_time_ms"] < 5.0
