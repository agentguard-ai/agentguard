"""Tests for TealTigerFilter — Semantic Kernel governance filter.

Tests cover:
1. Allowed function passes through
2. Denied function (denylist) blocks and terminates
3. Budget exceeded blocks
4. MONITOR mode logs but allows
5. Kill switch blocks all
6. PII in arguments blocks
7. Reserve-then-reconcile budget tracking
8. Audit trail records all decisions
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from tealtiger_semantic_kernel.filter import TealTigerFilter
from tealtiger_semantic_kernel.policy import (
    GovernancePolicy,
    FunctionPolicy,
    PIIScanPolicy,
    SecretScanPolicy,
)
from tealtiger_semantic_kernel.budget import BudgetTracker
from tealtiger_semantic_kernel.decision import DecisionAction
from tealtiger_semantic_kernel.exceptions import GovernanceDenyError


# --- Fixtures ---


def _make_context(plugin_name: str = "TestPlugin", function_name: str = "test_func", arguments: dict = None):
    """Create a mock filter context simulating Semantic Kernel's FunctionInvocationContext."""
    ctx = MagicMock()
    ctx.function = MagicMock()
    ctx.function.name = function_name
    ctx.function.plugin_name = plugin_name
    ctx.arguments = arguments or {}
    ctx.terminate = False
    return ctx


# --- Test 1: Allowed function passes through ---


@pytest.mark.asyncio
async def test_allowed_function_passes_through():
    """Functions not in denylist should be allowed and next() called."""
    policy = GovernancePolicy(
        mode="ENFORCE",
        function_policy=FunctionPolicy(denylist=["DangerPlugin-*"]),
    )
    gov = TealTigerFilter(policy=policy)
    context = _make_context(plugin_name="SafePlugin", function_name="read_data")
    next_fn = AsyncMock()

    await gov.function_invocation_filter(context, next_fn)

    next_fn.assert_called_once_with(context)
    assert len(gov.audit_trail) == 1
    assert gov.audit_trail[0].action == DecisionAction.ALLOW


@pytest.mark.asyncio
async def test_allowed_auto_function_passes_through():
    """Auto-invocation filter allows safe functions and calls next()."""
    policy = GovernancePolicy(
        mode="ENFORCE",
        function_policy=FunctionPolicy(denylist=["HttpPlugin-*"]),
    )
    gov = TealTigerFilter(policy=policy)
    context = _make_context(plugin_name="MathPlugin", function_name="add")
    next_fn = AsyncMock()

    await gov.auto_function_invocation_filter(context, next_fn)

    next_fn.assert_called_once_with(context)
    assert context.terminate is False


# --- Test 2: Denied function blocks and terminates ---


@pytest.mark.asyncio
async def test_denied_function_raises_error():
    """Function in denylist raises GovernanceDenyError in function_invocation_filter."""
    policy = GovernancePolicy(
        mode="ENFORCE",
        function_policy=FunctionPolicy(denylist=["HttpPlugin-*"]),
    )
    gov = TealTigerFilter(policy=policy)
    context = _make_context(plugin_name="HttpPlugin", function_name="fetch_url")
    next_fn = AsyncMock()

    with pytest.raises(GovernanceDenyError) as exc_info:
        await gov.function_invocation_filter(context, next_fn)

    assert "DENY" in str(exc_info.value)
    next_fn.assert_not_called()


@pytest.mark.asyncio
async def test_denied_auto_function_terminates_loop():
    """Denied auto-invocation sets terminate=True AND does NOT call next()."""
    policy = GovernancePolicy(
        mode="ENFORCE",
        function_policy=FunctionPolicy(denylist=["HttpPlugin-*"]),
    )
    gov = TealTigerFilter(policy=policy)
    context = _make_context(plugin_name="HttpPlugin", function_name="post_data")
    next_fn = AsyncMock()

    await gov.auto_function_invocation_filter(context, next_fn)

    # Critical: terminate = True stops the entire invocation loop
    assert context.terminate is True
    # next() is NOT called — function is skipped
    next_fn.assert_not_called()


# --- Test 3: Budget exceeded blocks ---


@pytest.mark.asyncio
async def test_budget_exceeded_blocks():
    """When budget is exhausted, function invocations are denied."""
    policy = GovernancePolicy(mode="ENFORCE")
    budget = BudgetTracker(per_session_usd=0.01)

    # Exhaust the budget by spending it
    budget.reserve(0.01)
    budget.reconcile(0.01, 0.01)

    gov = TealTigerFilter(policy=policy, budget=budget)
    context = _make_context(plugin_name="AIPlugin", function_name="generate")
    next_fn = AsyncMock()

    with pytest.raises(GovernanceDenyError) as exc_info:
        await gov.function_invocation_filter(context, next_fn)

    assert "Budget exceeded" in str(exc_info.value)
    next_fn.assert_not_called()


@pytest.mark.asyncio
async def test_budget_exceeded_terminates_auto():
    """Budget exceeded in auto-invocation terminates the loop."""
    policy = GovernancePolicy(mode="ENFORCE")
    budget = BudgetTracker(per_session_usd=0.005)

    # Exhaust budget
    budget.reserve(0.005)
    budget.reconcile(0.005, 0.005)

    gov = TealTigerFilter(policy=policy, budget=budget)
    context = _make_context(plugin_name="AIPlugin", function_name="generate")
    next_fn = AsyncMock()

    await gov.auto_function_invocation_filter(context, next_fn)

    assert context.terminate is True
    next_fn.assert_not_called()


# --- Test 4: MONITOR mode logs but allows ---


@pytest.mark.asyncio
async def test_monitor_mode_allows_denied_function():
    """In MONITOR mode, denied functions are logged but execution continues."""
    policy = GovernancePolicy(
        mode="MONITOR",
        function_policy=FunctionPolicy(denylist=["HttpPlugin-*"]),
    )
    gov = TealTigerFilter(policy=policy)
    context = _make_context(plugin_name="HttpPlugin", function_name="fetch_url")
    next_fn = AsyncMock()

    # Should NOT raise — MONITOR mode allows through
    await gov.function_invocation_filter(context, next_fn)

    next_fn.assert_called_once_with(context)
    # But the decision should still be DENY in the audit trail
    assert len(gov.audit_trail) == 1
    assert gov.audit_trail[0].action == DecisionAction.DENY


@pytest.mark.asyncio
async def test_monitor_mode_auto_filter_allows():
    """MONITOR mode in auto-invocation logs but calls next() and doesn't terminate."""
    policy = GovernancePolicy(
        mode="MONITOR",
        function_policy=FunctionPolicy(denylist=["HttpPlugin-*"]),
    )
    gov = TealTigerFilter(policy=policy)
    context = _make_context(plugin_name="HttpPlugin", function_name="fetch_url")
    next_fn = AsyncMock()

    await gov.auto_function_invocation_filter(context, next_fn)

    assert context.terminate is False
    next_fn.assert_called_once_with(context)


# --- Test 5: Kill switch blocks all ---


@pytest.mark.asyncio
async def test_kill_switch_blocks_all():
    """When frozen, ALL function invocations are blocked regardless of policy."""
    policy = GovernancePolicy(mode="ENFORCE")
    gov = TealTigerFilter(policy=policy)
    gov.freeze()

    context = _make_context(plugin_name="SafePlugin", function_name="harmless_func")
    next_fn = AsyncMock()

    with pytest.raises(GovernanceDenyError) as exc_info:
        await gov.function_invocation_filter(context, next_fn)

    assert "Kill switch" in str(exc_info.value)
    next_fn.assert_not_called()


@pytest.mark.asyncio
async def test_kill_switch_auto_terminates():
    """Kill switch in auto-invocation sets terminate=True."""
    policy = GovernancePolicy(mode="ENFORCE")
    gov = TealTigerFilter(policy=policy)
    gov.freeze()

    context = _make_context(plugin_name="SafePlugin", function_name="harmless_func")
    next_fn = AsyncMock()

    await gov.auto_function_invocation_filter(context, next_fn)

    assert context.terminate is True
    next_fn.assert_not_called()


@pytest.mark.asyncio
async def test_kill_switch_unfreeze_resumes():
    """Unfreezing the kill switch allows function invocations to resume."""
    policy = GovernancePolicy(mode="ENFORCE")
    gov = TealTigerFilter(policy=policy)

    gov.freeze()
    assert gov.frozen is True

    gov.unfreeze()
    assert gov.frozen is False

    context = _make_context(plugin_name="SafePlugin", function_name="read_data")
    next_fn = AsyncMock()

    await gov.function_invocation_filter(context, next_fn)
    next_fn.assert_called_once_with(context)


# --- Test 6: PII in arguments blocks ---


@pytest.mark.asyncio
async def test_pii_in_arguments_blocks():
    """PII detected in function arguments should block the invocation."""
    policy = GovernancePolicy(
        mode="ENFORCE",
        pii_scan=PIIScanPolicy(enabled=True, action="block"),
    )
    gov = TealTigerFilter(policy=policy)

    # Arguments contain an email address (PII)
    context = _make_context(
        plugin_name="EmailPlugin",
        function_name="send_email",
        arguments={"to": "john.doe@example.com", "body": "Hello"},
    )
    next_fn = AsyncMock()

    with pytest.raises(GovernanceDenyError) as exc_info:
        await gov.function_invocation_filter(context, next_fn)

    assert "PII detected" in str(exc_info.value)
    next_fn.assert_not_called()


@pytest.mark.asyncio
async def test_pii_scan_disabled_allows():
    """When PII scanning is disabled, arguments with PII pass through."""
    policy = GovernancePolicy(
        mode="ENFORCE",
        pii_scan=PIIScanPolicy(enabled=False),
    )
    gov = TealTigerFilter(policy=policy)

    context = _make_context(
        plugin_name="EmailPlugin",
        function_name="send_email",
        arguments={"to": "john.doe@example.com"},
    )
    next_fn = AsyncMock()

    await gov.function_invocation_filter(context, next_fn)
    next_fn.assert_called_once_with(context)


# --- Test 7: Reserve-then-reconcile budget tracking ---


def test_budget_reserve_then_reconcile():
    """Budget tracker correctly reserves and reconciles costs."""
    budget = BudgetTracker(per_session_usd=1.00)

    # Reserve $0.50
    assert budget.reserve(0.50) is True
    assert budget.total_committed == 0.50
    assert budget.remaining == 0.50

    # Reserve another $0.30
    assert budget.reserve(0.30) is True
    assert budget.total_committed == 0.80

    # Cannot reserve $0.30 more (would exceed $1.00)
    assert budget.reserve(0.30) is False
    assert budget.total_committed == 0.80

    # Reconcile first call: actual was $0.40 (less than $0.50 reserved)
    budget.reconcile(actual_cost=0.40, reserved=0.50)
    assert budget.spent == 0.40
    assert abs(budget.remaining - 0.30) < 1e-9  # 1.00 - 0.40 spent - 0.30 reserved

    # Now we can reserve $0.25
    assert budget.reserve(0.25) is True


def test_budget_reserve_exceeds_limit():
    """Reservation that would exceed limit is rejected."""
    budget = BudgetTracker(per_session_usd=0.10)

    assert budget.reserve(0.05) is True
    assert budget.reserve(0.05) is True
    # Total committed is now 0.10, next reserve should fail
    assert budget.reserve(0.01) is False


def test_budget_daily_limit():
    """Daily limit is enforced alongside session limit."""
    budget = BudgetTracker(per_session_usd=10.0, per_agent_daily_usd=1.0)

    # Session allows $10, but daily only allows $1
    assert budget.reserve(0.50) is True
    assert budget.reserve(0.50) is True
    # Committed = $1.00, next reserve exceeds daily limit
    assert budget.reserve(0.01) is False


def test_budget_reset():
    """Reset clears all budget tracking."""
    budget = BudgetTracker(per_session_usd=1.00)

    budget.reserve(0.50)
    budget.reconcile(0.50, 0.50)
    assert budget.spent == 0.50

    budget.reset()
    assert budget.spent == 0.0
    assert budget.total_committed == 0.0
    assert budget.remaining == 1.00


# --- Test 8: Audit trail records all decisions ---


@pytest.mark.asyncio
async def test_audit_trail_records_all_decisions():
    """Every filter evaluation is recorded in the audit trail."""
    policy = GovernancePolicy(
        mode="ENFORCE",
        function_policy=FunctionPolicy(denylist=["DangerPlugin-*"]),
    )
    gov = TealTigerFilter(policy=policy, session_id="test-session-001")

    # First call: allowed
    ctx1 = _make_context(plugin_name="SafePlugin", function_name="read")
    await gov.function_invocation_filter(ctx1, AsyncMock())

    # Second call: denied
    ctx2 = _make_context(plugin_name="DangerPlugin", function_name="delete_all")
    with pytest.raises(GovernanceDenyError):
        await gov.function_invocation_filter(ctx2, AsyncMock())

    # Third call: allowed
    ctx3 = _make_context(plugin_name="MathPlugin", function_name="add")
    await gov.function_invocation_filter(ctx3, AsyncMock())

    trail = gov.audit_trail
    assert len(trail) == 3

    # Verify first decision
    assert trail[0].action == DecisionAction.ALLOW
    assert trail[0].function_name == "read"
    assert trail[0].plugin_name == "SafePlugin"
    assert trail[0].session_id == "test-session-001"
    assert trail[0].correlation_id  # UUID is present

    # Verify second decision (denied)
    assert trail[1].action == DecisionAction.DENY
    assert trail[1].function_name == "delete_all"
    assert trail[1].plugin_name == "DangerPlugin"
    assert "FUNCTION_DENIED" in trail[1].reason_codes

    # Verify third decision
    assert trail[2].action == DecisionAction.ALLOW
    assert trail[2].function_name == "add"


@pytest.mark.asyncio
async def test_audit_trail_includes_timing():
    """Audit decisions include evaluation timing."""
    policy = GovernancePolicy(mode="ENFORCE")
    gov = TealTigerFilter(policy=policy)

    context = _make_context()
    await gov.function_invocation_filter(context, AsyncMock())

    decision = gov.audit_trail[0]
    assert decision.evaluation_time_ms >= 0
    assert decision.timestamp_ms > 0


@pytest.mark.asyncio
async def test_decision_serialization():
    """Decision.to_dict() produces a complete audit record."""
    policy = GovernancePolicy(mode="ENFORCE")
    gov = TealTigerFilter(policy=policy, session_id="sess-123")

    context = _make_context(plugin_name="TestPlugin", function_name="do_thing")
    await gov.function_invocation_filter(context, AsyncMock())

    record = gov.audit_trail[0].to_dict()
    assert "correlation_id" in record
    assert "timestamp_ms" in record
    assert record["action"] == "ALLOW"
    assert record["function_name"] == "do_thing"
    assert record["plugin_name"] == "TestPlugin"
    assert record["session_id"] == "sess-123"


# --- Additional edge cases ---


@pytest.mark.asyncio
async def test_secret_in_arguments_blocks():
    """Secrets detected in function arguments should block the invocation."""
    policy = GovernancePolicy(
        mode="ENFORCE",
        secret_scan=SecretScanPolicy(enabled=True, action="block"),
    )
    gov = TealTigerFilter(policy=policy)

    context = _make_context(
        plugin_name="ConfigPlugin",
        function_name="set_config",
        arguments={"config": "api_key = 'test_fake_key_placeholder_xxxxx'"},
    )
    next_fn = AsyncMock()

    with pytest.raises(GovernanceDenyError) as exc_info:
        await gov.function_invocation_filter(context, next_fn)

    assert "Secret detected" in str(exc_info.value)
    next_fn.assert_not_called()


@pytest.mark.asyncio
async def test_observe_mode_never_blocks():
    """OBSERVE mode never blocks, even with violations."""
    policy = GovernancePolicy(
        mode="OBSERVE",
        function_policy=FunctionPolicy(denylist=["*"]),  # deny everything
    )
    gov = TealTigerFilter(policy=policy)

    context = _make_context(plugin_name="AnyPlugin", function_name="any_func")
    next_fn = AsyncMock()

    await gov.function_invocation_filter(context, next_fn)

    # Should still pass through in OBSERVE mode
    next_fn.assert_called_once_with(context)


@pytest.mark.asyncio
async def test_function_allowlist_enforcement():
    """Only functions matching allowlist patterns are permitted."""
    policy = GovernancePolicy(
        mode="ENFORCE",
        function_policy=FunctionPolicy(
            allowlist=["MathPlugin-*", "TextPlugin-summarize"],
        ),
    )
    gov = TealTigerFilter(policy=policy)

    # Allowed: matches MathPlugin-*
    ctx1 = _make_context(plugin_name="MathPlugin", function_name="add")
    await gov.function_invocation_filter(ctx1, AsyncMock())
    assert gov.audit_trail[-1].action == DecisionAction.ALLOW

    # Allowed: exact match TextPlugin-summarize
    ctx2 = _make_context(plugin_name="TextPlugin", function_name="summarize")
    await gov.function_invocation_filter(ctx2, AsyncMock())
    assert gov.audit_trail[-1].action == DecisionAction.ALLOW

    # Denied: not in allowlist
    ctx3 = _make_context(plugin_name="HttpPlugin", function_name="fetch")
    with pytest.raises(GovernanceDenyError):
        await gov.function_invocation_filter(ctx3, AsyncMock())
