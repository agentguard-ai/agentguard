"""Additional tests to improve coverage for TealTiger AG2 Beta middleware.

Target: Cover the uncovered paths in middleware.py (76.70% → 90%+)
Focus areas:
- MONITOR mode (log but allow)
- REQUIRE_APPROVAL and REVISE action paths
- Frozen agent in on_turn (ENFORCE mode raising GovernanceDenyError)
- Secret detection policy
- Cost limit exceeded path
- Tool denylist path
- on_decision and on_receipt callbacks
- _extract_tool_args edge cases
- Multiple policies evaluated together
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from autogen.beta.extensions.tealtiger.middleware import (
    TealTigerMiddleware,
    GovernanceDenyError,
)
from autogen.beta.extensions.tealtiger.types import (
    DecisionAction,
    GovernanceMode,
    GovernancePolicy,
)


@pytest.fixture
def mock_event():
    event = MagicMock()
    event.name = "search"
    event.arguments = {"query": "test"}
    return event


@pytest.fixture
def mock_context():
    return MagicMock()


@pytest.fixture
def mock_call_next():
    return AsyncMock(return_value="tool result")


# =============================================
# MONITOR mode tests
# =============================================


@pytest.mark.asyncio
async def test_monitor_mode_allows_denied_tool(mock_event, mock_context, mock_call_next):
    """MONITOR mode should allow tools that would be denied, but log warning."""
    middleware = TealTigerMiddleware(
        event=MagicMock(),
        context=mock_context,
        mode=GovernanceMode.MONITOR,
        policies=[GovernancePolicy.tool_allowlist(["read_file"])],
        agent_id="test-agent",
    )

    mock_event.name = "send_email"  # Not in allowlist
    result = await middleware.on_tool_execution(mock_call_next, mock_event, mock_context)

    # Should still call the tool (monitor mode allows everything)
    mock_call_next.assert_called_once()
    assert result == "tool result"
    # Decision should show DENY intent
    assert middleware.decisions[-1].action == DecisionAction.DENY


@pytest.mark.asyncio
async def test_monitor_mode_pii_detected_but_allowed(mock_event, mock_context, mock_call_next):
    """MONITOR mode with PII should allow but record detection."""
    middleware = TealTigerMiddleware(
        event=MagicMock(),
        context=mock_context,
        mode=GovernanceMode.MONITOR,
        policies=[GovernancePolicy.pii_block(["ssn"])],
        agent_id="test-agent",
    )

    mock_event.name = "create_ticket"
    mock_event.arguments = {"body": "SSN: 000-00-0000"}
    result = await middleware.on_tool_execution(mock_call_next, mock_event, mock_context)

    mock_call_next.assert_called_once()
    assert "PII_DETECTED:ssn" in middleware.decisions[-1].reason_codes


# =============================================
# ENFORCE mode - REQUIRE_APPROVAL and REVISE
# =============================================


@pytest.mark.asyncio
async def test_enforce_require_approval_path(mock_event, mock_context, mock_call_next):
    """REQUIRE_APPROVAL action should return pending message without executing."""
    middleware = TealTigerMiddleware(
        event=MagicMock(),
        context=mock_context,
        mode=GovernanceMode.ENFORCE,
        policies=[],
        agent_id="test-agent",
    )

    # Manually patch _create_decision to return REQUIRE_APPROVAL
    original_create = middleware._create_decision

    def patched_create(**kwargs):
        kwargs["action"] = DecisionAction.REQUIRE_APPROVAL
        return original_create(**kwargs)

    middleware._create_decision = patched_create

    result = await middleware.on_tool_execution(mock_call_next, mock_event, mock_context)

    mock_call_next.assert_not_called()
    assert "GOVERNANCE PENDING" in result
    assert "requires approval" in result


@pytest.mark.asyncio
async def test_enforce_revise_path(mock_event, mock_context, mock_call_next):
    """REVISE action should return revision request without executing."""
    middleware = TealTigerMiddleware(
        event=MagicMock(),
        context=mock_context,
        mode=GovernanceMode.ENFORCE,
        policies=[],
        agent_id="test-agent",
    )

    original_create = middleware._create_decision

    def patched_create(**kwargs):
        kwargs["action"] = DecisionAction.REVISE
        kwargs["reason_codes"] = ["ARGS_NEED_REVISION"]
        return original_create(**kwargs)

    middleware._create_decision = patched_create

    result = await middleware.on_tool_execution(mock_call_next, mock_event, mock_context)

    mock_call_next.assert_not_called()
    assert "GOVERNANCE REVISE" in result
    assert "needs argument revision" in result


# =============================================
# Frozen agent in on_turn (ENFORCE)
# =============================================


@pytest.mark.asyncio
async def test_frozen_agent_on_turn_enforce_raises(mock_context):
    """Frozen agent in ENFORCE mode on_turn should raise GovernanceDenyError."""
    middleware = TealTigerMiddleware(
        event=MagicMock(),
        context=mock_context,
        mode=GovernanceMode.ENFORCE,
        policies=[],
        agent_id="frozen-bot",
    )
    middleware.freeze("frozen-bot")

    call_next = AsyncMock()

    with pytest.raises(GovernanceDenyError) as exc_info:
        await middleware.on_turn(call_next, MagicMock(), mock_context)

    assert "frozen" in str(exc_info.value).lower()
    call_next.assert_not_called()


@pytest.mark.asyncio
async def test_frozen_agent_on_turn_observe_allows(mock_context):
    """Frozen agent in OBSERVE mode should still execute (just logs)."""
    middleware = TealTigerMiddleware(
        event=MagicMock(),
        context=mock_context,
        mode=GovernanceMode.OBSERVE,
        policies=[],
        agent_id="frozen-bot",
    )
    middleware.freeze("frozen-bot")

    call_next = AsyncMock(return_value=MagicMock())
    result = await middleware.on_turn(call_next, MagicMock(), mock_context)

    # In OBSERVE mode, should still call next even if frozen
    # (decision is recorded but not enforced)
    assert middleware.decisions[-1].action == DecisionAction.DENY


# =============================================
# Secret detection
# =============================================


@pytest.mark.asyncio
async def test_secret_detection_blocks_openai_key(mock_event, mock_context, mock_call_next):
    """Secret detection should block tool calls with API keys."""
    middleware = TealTigerMiddleware(
        event=MagicMock(),
        context=mock_context,
        mode=GovernanceMode.ENFORCE,
        policies=[GovernancePolicy(type="secret_detection", config={})],
        agent_id="test-agent",
    )

    mock_event.name = "write_code"
    mock_event.arguments = {"code": "api_key = 'sk-abcdefghijklmnopqrstuvwxyz1234567890'"}

    result = await middleware.on_tool_execution(mock_call_next, mock_event, mock_context)

    mock_call_next.assert_not_called()
    assert "GOVERNANCE DENIED" in result
    assert "SECRET_DETECTED" in middleware.decisions[-1].reason_codes


# =============================================
# Tool denylist
# =============================================


@pytest.mark.asyncio
async def test_tool_denylist_blocks_tool(mock_event, mock_context, mock_call_next):
    """Tool denylist should block explicitly denied tools."""
    middleware = TealTigerMiddleware(
        event=MagicMock(),
        context=mock_context,
        mode=GovernanceMode.ENFORCE,
        policies=[GovernancePolicy(type="tool_denylist", config={"denied": ["delete_*", "drop_*"]})],
        agent_id="test-agent",
    )

    mock_event.name = "delete_account"
    result = await middleware.on_tool_execution(mock_call_next, mock_event, mock_context)

    mock_call_next.assert_not_called()
    assert "TOOL_DENIED" in middleware.decisions[-1].reason_codes


# =============================================
# Cost limit
# =============================================


@pytest.mark.asyncio
async def test_cost_limit_exceeded_blocks(mock_event, mock_context, mock_call_next):
    """Cost limit exceeded should block execution."""
    middleware = TealTigerMiddleware(
        event=MagicMock(),
        context=mock_context,
        mode=GovernanceMode.ENFORCE,
        policies=[GovernancePolicy.cost_limit(max_per_session=1.0)],
        agent_id="test-agent",
        budget_limit=1.0,
    )
    # Simulate accumulated cost beyond limit
    middleware._cumulative_cost = 1.5

    result = await middleware.on_tool_execution(mock_call_next, mock_event, mock_context)

    mock_call_next.assert_not_called()
    assert "BUDGET_EXCEEDED" in middleware.decisions[-1].reason_codes


# =============================================
# Callbacks (on_decision, on_receipt)
# =============================================


@pytest.mark.asyncio
async def test_on_decision_callback_invoked(mock_event, mock_context, mock_call_next):
    """on_decision callback should fire for every governance evaluation."""
    callback = MagicMock()
    middleware = TealTigerMiddleware(
        event=MagicMock(),
        context=mock_context,
        mode=GovernanceMode.OBSERVE,
        policies=[],
        agent_id="test-agent",
        on_decision=callback,
    )

    await middleware.on_tool_execution(mock_call_next, mock_event, mock_context)

    callback.assert_called_once()
    decision = callback.call_args[0][0]
    assert decision.agent_id == "test-agent"


@pytest.mark.asyncio
async def test_on_receipt_callback_invoked(mock_event, mock_context, mock_call_next):
    """on_receipt callback should fire after execution outcome."""
    callback = MagicMock()
    middleware = TealTigerMiddleware(
        event=MagicMock(),
        context=mock_context,
        mode=GovernanceMode.OBSERVE,
        policies=[],
        agent_id="test-agent",
        on_receipt=callback,
    )

    await middleware.on_tool_execution(mock_call_next, mock_event, mock_context)

    callback.assert_called_once()
    receipt = callback.call_args[0][0]
    assert receipt.execution_outcome == "executed"


# =============================================
# _extract_tool_args edge cases
# =============================================


@pytest.mark.asyncio
async def test_extract_tool_args_no_arguments(mock_context, mock_call_next):
    """Should handle events with no arguments attribute."""
    middleware = TealTigerMiddleware(
        event=MagicMock(),
        context=mock_context,
        mode=GovernanceMode.OBSERVE,
        policies=[],
        agent_id="test-agent",
    )

    event = MagicMock(spec=[])  # No 'arguments' or 'args' attributes
    event.name = "test_tool"

    await middleware.on_tool_execution(mock_call_next, event, mock_context)
    mock_call_next.assert_called_once()


@pytest.mark.asyncio
async def test_extract_tool_args_uses_args_attribute(mock_context, mock_call_next):
    """Should fall back to 'args' if 'arguments' not present."""
    middleware = TealTigerMiddleware(
        event=MagicMock(),
        context=mock_context,
        mode=GovernanceMode.ENFORCE,
        policies=[GovernancePolicy.pii_block(["ssn"])],
        agent_id="test-agent",
    )

    event = MagicMock()
    event.name = "create_record"
    del event.arguments  # Remove 'arguments'
    event.args = {"data": "SSN: 000-00-0000"}

    result = await middleware.on_tool_execution(mock_call_next, event, mock_context)
    assert "GOVERNANCE DENIED" in result


# =============================================
# Utility methods
# =============================================


def test_freeze_unfreeze_round_trip(mock_context):
    """freeze → is_frozen → unfreeze → not frozen."""
    middleware = TealTigerMiddleware(
        event=MagicMock(),
        context=mock_context,
        mode=GovernanceMode.ENFORCE,
        policies=[],
        agent_id="bot-1",
    )

    assert not middleware.is_frozen()
    middleware.freeze()
    assert middleware.is_frozen()
    middleware.unfreeze()
    assert not middleware.is_frozen()


def test_freeze_different_agent(mock_context):
    """Freezing agent B should not affect agent A."""
    middleware = TealTigerMiddleware(
        event=MagicMock(),
        context=mock_context,
        mode=GovernanceMode.ENFORCE,
        policies=[],
        agent_id="agent-a",
    )

    middleware.freeze("agent-b")
    assert not middleware.is_frozen("agent-a")
    assert middleware.is_frozen("agent-b")


def test_governance_deny_error_has_decision_id():
    """GovernanceDenyError should carry the decision_id."""
    err = GovernanceDenyError("test message", decision_id="abc-123")
    assert err.decision_id == "abc-123"
    assert "test message" in str(err)
