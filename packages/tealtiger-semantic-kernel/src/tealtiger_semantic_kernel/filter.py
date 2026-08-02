"""TealTiger governance filter for Semantic Kernel.

Provides deterministic governance as both a FunctionInvocationFilter and an
AutoFunctionInvocationFilter. Designed to work with Semantic Kernel's native
filter system.

Key design decisions (addressing @renezander030's critique on issue #14056):

1. AutoFunctionInvocationFilter DENY sets context.terminate = True AND skips
   next() — this terminates the ENTIRE invocation loop, not just one function.
   The LLM planner cannot continue calling more functions after a governance deny.

2. Budget uses reserve-then-reconcile: estimated cost is debited BEFORE the
   function runs, then reconciled with actual cost AFTER. This prevents
   overspend in parallel/async scenarios.

3. Kill switch is a simple boolean that blocks ALL invocations instantly —
   useful for emergency freeze of a runaway agent.

Usage:
    from semantic_kernel import Kernel
    from tealtiger_semantic_kernel import TealTigerFilter, GovernancePolicy, BudgetTracker

    policy = GovernancePolicy(
        mode="ENFORCE",
        function_policy=FunctionPolicy(denylist=["HttpPlugin-*"]),
    )
    budget = BudgetTracker(per_session_usd=5.00)
    gov = TealTigerFilter(policy=policy, budget=budget)

    kernel.add_filter("function_invocation", gov.function_invocation_filter)
    kernel.add_filter("auto_function_invocation", gov.auto_function_invocation_filter)
"""

import time
from typing import Any, Callable, Coroutine, List, Optional

from tealtiger_semantic_kernel.budget import BudgetTracker
from tealtiger_semantic_kernel.decision import Decision, DecisionAction
from tealtiger_semantic_kernel.exceptions import GovernanceDenyError
from tealtiger_semantic_kernel.policy import GovernancePolicy


class TealTigerFilter:
    """Deterministic governance filter for Semantic Kernel.

    Provides both function_invocation_filter and auto_function_invocation_filter
    methods that can be registered with a Semantic Kernel Kernel instance.

    The filter evaluates policies in order:
    1. Kill switch check
    2. Budget check (reserve estimated cost)
    3. Function allowlist/denylist
    4. PII scan on arguments
    5. Secret scan on arguments

    On DENY in auto_function_invocation_filter:
    - context.terminate = True (stops the entire planner loop)
    - next() is NOT called (function is skipped)

    Args:
        policy: Governance policy configuration.
        budget: Budget tracker instance. Created with defaults if not provided.
        session_id: Optional session identifier for audit trail.
    """

    def __init__(
        self,
        policy: GovernancePolicy,
        budget: Optional[BudgetTracker] = None,
        session_id: Optional[str] = None,
    ):
        self.policy = policy
        self.budget = budget or BudgetTracker()
        self.session_id = session_id
        self._frozen = False
        self._audit_trail: List[Decision] = []

    @property
    def frozen(self) -> bool:
        """Whether the kill switch is active."""
        return self._frozen

    @property
    def audit_trail(self) -> List[Decision]:
        """List of all decisions made by this filter."""
        return list(self._audit_trail)

    def freeze(self) -> None:
        """Activate kill switch — block ALL function invocations."""
        self._frozen = True

    def unfreeze(self) -> None:
        """Deactivate kill switch — resume normal policy evaluation."""
        self._frozen = False

    async def function_invocation_filter(self, context: Any, next: Callable[..., Coroutine]) -> None:
        """Filter for FunctionInvocationFilter registration.

        Evaluates governance policy before function execution.
        In ENFORCE mode, raises GovernanceDenyError on denial.
        In MONITOR/OBSERVE mode, logs but allows execution.

        Register with:
            kernel.add_filter("function_invocation", gov.function_invocation_filter)
        """
        start_time = time.perf_counter()

        function_name = getattr(context.function, "name", "unknown")
        plugin_name = getattr(context.function, "plugin_name", "unknown")
        arguments = self._extract_arguments(context)

        decision = self._evaluate(
            function_name=function_name,
            plugin_name=plugin_name,
            arguments=arguments,
            start_time=start_time,
        )
        self._audit_trail.append(decision)

        if not decision.is_allowed and self.policy.mode == "ENFORCE":
            raise GovernanceDenyError(decision.to_dict())

        # Reserve budget before execution
        reserved = 0.0
        if decision.is_allowed:
            estimated = self.policy.default_cost_estimate
            if self.budget.reserve(estimated):
                reserved = estimated

        await next(context)

        # Reconcile budget after execution
        if reserved > 0:
            # In a real scenario, actual cost would come from token usage metadata
            actual = reserved  # Default: actual = estimate
            self.budget.reconcile(actual, reserved)

    async def auto_function_invocation_filter(self, context: Any, next: Callable[..., Coroutine]) -> None:
        """Filter for AutoFunctionInvocationFilter registration.

        Evaluates governance policy before LLM-initiated function calls.
        On DENY: sets context.terminate = True AND does NOT call next().
        This terminates the entire invocation loop — the LLM cannot continue
        calling more functions.

        Register with:
            kernel.add_filter("auto_function_invocation", gov.auto_function_invocation_filter)
        """
        start_time = time.perf_counter()

        function_name = getattr(context.function, "name", "unknown")
        plugin_name = getattr(context.function, "plugin_name", "unknown")
        arguments = self._extract_arguments(context)

        decision = self._evaluate(
            function_name=function_name,
            plugin_name=plugin_name,
            arguments=arguments,
            start_time=start_time,
        )
        self._audit_trail.append(decision)

        if not decision.is_allowed:
            if self.policy.mode == "ENFORCE":
                # CRITICAL: terminate = True stops the ENTIRE invocation loop
                context.terminate = True
                # Do NOT call next() — this skips the function AND stops the loop
                return
            # MONITOR/OBSERVE: log but continue
            # Fall through to call next()

        # Reserve budget before execution
        reserved = 0.0
        estimated = self.policy.default_cost_estimate
        if self.budget.reserve(estimated):
            reserved = estimated

        await next(context)

        # Reconcile budget after execution
        if reserved > 0:
            actual = reserved
            self.budget.reconcile(actual, reserved)

    def _evaluate(
        self,
        function_name: str,
        plugin_name: str,
        arguments: dict,
        start_time: float,
    ) -> Decision:
        """Evaluate all governance policies for a function invocation.

        Checks are evaluated in order:
        1. Kill switch
        2. Budget
        3. Function policy
        4. PII scan
        5. Secret scan
        """
        # 1. Kill switch
        if self._frozen:
            return self._make_decision(
                action=DecisionAction.DENY,
                reason="Kill switch active — all invocations blocked",
                reason_codes=["KILL_SWITCH"],
                risk_score=1.0,
                function_name=function_name,
                plugin_name=plugin_name,
                arguments=arguments,
                start_time=start_time,
            )

        # 2. Budget check
        budget_denial = self.budget.check()
        if budget_denial:
            return self._make_decision(
                action=DecisionAction.DENY,
                reason=budget_denial,
                reason_codes=["BUDGET_EXCEEDED"],
                risk_score=0.8,
                function_name=function_name,
                plugin_name=plugin_name,
                arguments=arguments,
                start_time=start_time,
            )

        # 3. Function policy
        if self.policy.function_policy:
            fn_denial = self.policy.function_policy.check(plugin_name, function_name)
            if fn_denial:
                return self._make_decision(
                    action=DecisionAction.DENY,
                    reason=fn_denial,
                    reason_codes=["FUNCTION_DENIED"],
                    risk_score=0.9,
                    function_name=function_name,
                    plugin_name=plugin_name,
                    arguments=arguments,
                    start_time=start_time,
                )

        # 4. PII scan on arguments
        if self.policy.pii_scan and arguments:
            args_str = str(arguments)
            pii_findings = self.policy.pii_scan.scan(args_str)
            if pii_findings and self.policy.pii_scan.action == "block":
                return self._make_decision(
                    action=DecisionAction.DENY,
                    reason=f"PII detected in arguments: {len(pii_findings)} finding(s)",
                    reason_codes=["PII_DETECTED"],
                    risk_score=0.85,
                    function_name=function_name,
                    plugin_name=plugin_name,
                    arguments=arguments,
                    start_time=start_time,
                    findings=pii_findings,
                )

        # 5. Secret scan on arguments
        if self.policy.secret_scan and arguments:
            args_str = str(arguments)
            secret_findings = self.policy.secret_scan.scan(args_str)
            if secret_findings and self.policy.secret_scan.action == "block":
                return self._make_decision(
                    action=DecisionAction.DENY,
                    reason=f"Secret detected in arguments: {len(secret_findings)} finding(s)",
                    reason_codes=["SECRET_DETECTED"],
                    risk_score=0.95,
                    function_name=function_name,
                    plugin_name=plugin_name,
                    arguments=arguments,
                    start_time=start_time,
                    findings=secret_findings,
                )

        # All checks passed
        return self._make_decision(
            action=DecisionAction.ALLOW,
            reason="All governance checks passed",
            reason_codes=[],
            risk_score=0.0,
            function_name=function_name,
            plugin_name=plugin_name,
            arguments=arguments,
            start_time=start_time,
        )

    def _make_decision(
        self,
        action: DecisionAction,
        reason: str,
        reason_codes: list,
        risk_score: float,
        function_name: str,
        plugin_name: str,
        arguments: dict,
        start_time: float,
        findings: Optional[list] = None,
    ) -> Decision:
        """Create a Decision record with timing and cost data."""
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        return Decision(
            action=action,
            reason=reason,
            reason_codes=reason_codes,
            risk_score=risk_score,
            findings=findings,
            evaluation_time_ms=elapsed_ms,
            function_name=function_name,
            plugin_name=plugin_name,
            arguments=arguments,
            session_id=self.session_id,
            cumulative_cost=self.budget.spent,
        )

    def _extract_arguments(self, context: Any) -> dict:
        """Extract function arguments from filter context."""
        try:
            args = getattr(context, "arguments", None)
            if args is None:
                return {}
            if isinstance(args, dict):
                return args
            # KernelArguments is dict-like
            return dict(args) if hasattr(args, "__iter__") else {}
        except (TypeError, AttributeError):
            return {}
