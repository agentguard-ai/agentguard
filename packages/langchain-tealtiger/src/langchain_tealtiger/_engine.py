"""Bridge between LangChain middleware and TealTiger governance engine.

This module adapts the LangChain tool call interface to TealTiger's
GovernanceRequest/DecisionV13 types.
"""

from __future__ import annotations

import asyncio
import importlib
import threading
import time
import uuid
from typing import Any, Dict, List, Optional, Set

from tealtiger.guardrails import PIIDetectionGuardrail

from langchain_tealtiger._types import (
    GovernanceAction,
    GovernanceDecision,
    GovernanceMode,
    SessionSummary,
)


def _run_sync(coro: Any) -> Any:
    """Run an async coroutine from synchronous code, whether or not the calling
    thread already has a running event loop (e.g. because this was invoked from
    inside an `async def` LangGraph node without being awaited directly).
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)

    result: List[Any] = []
    errors: List[BaseException] = []

    def _runner() -> None:
        try:
            result.append(asyncio.run(coro))
        except BaseException as exc:  # noqa: BLE001 - re-raised on the calling thread
            errors.append(exc)

    thread = threading.Thread(target=_runner)
    thread.start()
    thread.join()
    if errors:
        raise errors[0]
    return result[0]


class GovernanceBridge:
    """Bridges LangChain middleware calls to TealTiger governance evaluation.

    This class handles:
    - Policy configuration parsing
    - Tool allowlist/blocklist enforcement
    - Cost limit tracking
    - Rate limit tracking
    - Time-of-day restrictions
    - Decision evidence collection

    The engine is deterministic — no LLM calls, no network requests.
    Typical evaluation time: <1ms.
    """

    def __init__(
        self,
        policies: List[Dict[str, Any]],
        mode: GovernanceMode = GovernanceMode.ENFORCE,
        agent_id: Optional[str] = None,
        freeze_tools: Optional[Set[str]] = None,
        otel_enabled: bool = False,
    ) -> None:
        self._mode = mode
        self._agent_id = agent_id or f"langchain-agent-{uuid.uuid4().hex[:8]}"
        self._freeze_tools = freeze_tools or set()
        self._otel_enabled = otel_enabled

        # Parse policies
        self._tool_allowlist: Optional[Set[str]] = None
        self._tool_blocklist: Set[str] = set()
        self._cost_limit_session: Optional[float] = None
        self._cost_limit_request: Optional[float] = None
        self._rate_limit_max: Optional[int] = None
        self._rate_limit_window: Optional[str] = None
        self._time_restrictions: List[Dict[str, Any]] = []
        self._circuit_breaker_threshold: Optional[int] = None
        self._circuit_breaker_recovery: Optional[str] = None
        self._pii_guardrail: Optional[PIIDetectionGuardrail] = None

        self._parse_policies(policies)

        # Session state
        self._session_cost: float = 0.0
        self._call_count: int = 0
        self._tool_failure_counts: Dict[str, int] = {}
        self._evidence: List[GovernanceDecision] = []

    def _parse_policies(self, policies: List[Dict[str, Any]]) -> None:
        """Parse policy config dicts into internal state."""
        for policy in policies:
            ptype = policy.get("type", "")

            if ptype == "tool_allowlist":
                self._tool_allowlist = set(policy.get("tools", []))
            elif ptype == "tool_blocklist":
                self._tool_blocklist = set(policy.get("tools", []))
            elif ptype == "cost_limit":
                self._cost_limit_session = policy.get("max_per_session")
                self._cost_limit_request = policy.get("max_per_request")
            elif ptype == "rate_limit":
                self._rate_limit_max = policy.get("max_calls")
                self._rate_limit_window = policy.get("window")
            elif ptype == "time_restriction":
                self._time_restrictions.append(policy)
            elif ptype == "circuit_breaker":
                self._circuit_breaker_threshold = policy.get("failure_threshold")
                # `recovery_time` is accepted for forward compatibility with the
                # documented policy shape but is not enforced -- there is no
                # time-based half-open state, matching this engine's existing
                # rate_limit.window precedent (parsed, never read again).
                self._circuit_breaker_recovery = policy.get("recovery_time")
            elif ptype == "pii":
                guardrail_config = {k: v for k, v in policy.items() if k != "type"}
                self._pii_guardrail = PIIDetectionGuardrail(guardrail_config)

    def evaluate(
        self,
        tool_name: str,
        tool_args: Dict[str, Any],
    ) -> GovernanceDecision:
        """Evaluate a tool call against configured policies.

        Args:
            tool_name: Name of the tool being invoked.
            tool_args: Arguments passed to the tool.

        Returns:
            GovernanceDecision with the action to take.
        """
        start = time.perf_counter()
        correlation_id = str(uuid.uuid4())
        triggered: List[str] = []

        # ── FREEZE check (always enforced, regardless of mode) ──
        if tool_name in self._freeze_tools:
            decision = GovernanceDecision(
                action=GovernanceAction.DENY,
                tool_name=tool_name,
                tool_args=tool_args,
                reason=f"FREEZE: tool '{tool_name}' is frozen and cannot be executed",
                reason_codes=["FREEZE_RULE"],
                risk_score=100,
                correlation_id=correlation_id,
                trace_id=_get_current_trace_id(),
                triggered_policies=["freeze"],
            )
            decision.evaluation_time_ms = (time.perf_counter() - start) * 1000
            self._record(decision)
            return decision

        # ── Tool allowlist check ──
        if self._tool_allowlist is not None and tool_name not in self._tool_allowlist:
            triggered.append("tool_allowlist")
            if self._mode == GovernanceMode.ENFORCE:
                decision = GovernanceDecision(
                    action=GovernanceAction.DENY,
                    tool_name=tool_name,
                    tool_args=tool_args,
                    reason=f"Tool '{tool_name}' not in allowlist: {sorted(self._tool_allowlist)}",
                    reason_codes=["TOOL_NOT_ALLOWED"],
                    risk_score=80,
                    correlation_id=correlation_id,
                    trace_id=_get_current_trace_id(),
                    triggered_policies=triggered,
                )
                decision.evaluation_time_ms = (time.perf_counter() - start) * 1000
                self._record(decision)
                return decision

        # ── Tool blocklist check ──
        if tool_name in self._tool_blocklist:
            triggered.append("tool_blocklist")
            if self._mode == GovernanceMode.ENFORCE:
                decision = GovernanceDecision(
                    action=GovernanceAction.DENY,
                    tool_name=tool_name,
                    tool_args=tool_args,
                    reason=f"Tool '{tool_name}' is blocklisted",
                    reason_codes=["TOOL_BLOCKED"],
                    risk_score=80,
                    correlation_id=correlation_id,
                    trace_id=_get_current_trace_id(),
                    triggered_policies=triggered,
                )
                decision.evaluation_time_ms = (time.perf_counter() - start) * 1000
                self._record(decision)
                return decision

        # ── Rate limit check ──
        if self._rate_limit_max is not None and self._call_count >= self._rate_limit_max:
            triggered.append("rate_limit")
            if self._mode == GovernanceMode.ENFORCE:
                decision = GovernanceDecision(
                    action=GovernanceAction.DENY,
                    tool_name=tool_name,
                    tool_args=tool_args,
                    reason=f"Rate limit exceeded: {self._call_count}/{self._rate_limit_max} calls",
                    reason_codes=["RATE_LIMIT_EXCEEDED"],
                    risk_score=70,
                    correlation_id=correlation_id,
                    trace_id=_get_current_trace_id(),
                    triggered_policies=triggered,
                )
                decision.evaluation_time_ms = (time.perf_counter() - start) * 1000
                self._record(decision)
                return decision

        # ── Cost limit check ──
        if self._cost_limit_session is not None and self._session_cost >= self._cost_limit_session:
            triggered.append("cost_limit")
            if self._mode == GovernanceMode.ENFORCE:
                decision = GovernanceDecision(
                    action=GovernanceAction.DENY,
                    tool_name=tool_name,
                    tool_args=tool_args,
                    reason=(
                        f"Session cost limit exceeded: "
                        f"${self._session_cost:.2f}/${self._cost_limit_session:.2f}"
                    ),
                    reason_codes=["COST_LIMIT_EXCEEDED"],
                    risk_score=60,
                    correlation_id=correlation_id,
                    trace_id=_get_current_trace_id(),
                    triggered_policies=triggered,
                )
                decision.evaluation_time_ms = (time.perf_counter() - start) * 1000
                self._record(decision)
                return decision

        # ── Circuit breaker check ──
        if (
            self._circuit_breaker_threshold is not None
            and self._tool_failure_counts.get(tool_name, 0) >= self._circuit_breaker_threshold
        ):
            triggered.append("circuit_breaker")
            if self._mode == GovernanceMode.ENFORCE:
                decision = GovernanceDecision(
                    action=GovernanceAction.DENY,
                    tool_name=tool_name,
                    tool_args=tool_args,
                    reason=(
                        f"Circuit breaker open for tool '{tool_name}': "
                        f"{self._tool_failure_counts[tool_name]}/"
                        f"{self._circuit_breaker_threshold} consecutive failures"
                    ),
                    reason_codes=["CIRCUIT_BREAKER_OPEN"],
                    risk_score=75,
                    correlation_id=correlation_id,
                    trace_id=_get_current_trace_id(),
                    triggered_policies=triggered,
                )
                decision.evaluation_time_ms = (time.perf_counter() - start) * 1000
                self._record(decision)
                return decision

        # ── All checks passed ──
        decision = GovernanceDecision(
            action=GovernanceAction.ALLOW,
            tool_name=tool_name,
            tool_args=tool_args,
            reason="Request allowed and compliant with all policies",
            reason_codes=["POLICY_COMPLIANT"],
            risk_score=0,
            correlation_id=correlation_id,
            trace_id=_get_current_trace_id(),
            triggered_policies=triggered,
        )
        decision.evaluation_time_ms = (time.perf_counter() - start) * 1000
        self._call_count += 1
        self._record(decision)
        return decision

    def evaluate_content(
        self,
        content: str,
        stage: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> GovernanceDecision:
        """Evaluate free-text content (model input/output, or a tool result) for
        PII using `tealtiger.guardrails.PIIDetectionGuardrail`, configured via a
        `{"type": "pii", ...}` policy. Always ALLOW if no `pii` policy was
        configured. `stage` is one of "input", "output", "tool_result".
        """
        start = time.perf_counter()
        correlation_id = str(uuid.uuid4())
        synthetic_tool_name = f"<{stage}>"

        if self._pii_guardrail is None:
            decision = GovernanceDecision(
                action=GovernanceAction.ALLOW,
                tool_name=synthetic_tool_name,
                tool_args={},
                reason="No content policy configured",
                reason_codes=["POLICY_COMPLIANT"],
                correlation_id=correlation_id,
                trace_id=_get_current_trace_id(),
            )
            decision.evaluation_time_ms = (time.perf_counter() - start) * 1000
            self._record(decision)
            return decision

        result = _run_sync(self._pii_guardrail.evaluate(content, context=context))
        detections = result.metadata.get("detections", [])

        if not detections:
            decision = GovernanceDecision(
                action=GovernanceAction.ALLOW,
                tool_name=synthetic_tool_name,
                tool_args={},
                reason=result.reason,
                reason_codes=["POLICY_COMPLIANT"],
                correlation_id=correlation_id,
                trace_id=_get_current_trace_id(),
            )
            decision.evaluation_time_ms = (time.perf_counter() - start) * 1000
            self._record(decision)
            return decision

        reason_codes = [f"PII_{d['type'].upper()}" for d in detections]
        triggered = ["pii"]

        if self._mode != GovernanceMode.ENFORCE:
            # Matches every tool-call policy check above: outside ENFORCE mode,
            # violations are recorded but never block or modify content.
            action = GovernanceAction.ALLOW
            redacted_content = None
        elif result.action == "block":
            action = GovernanceAction.DENY
            redacted_content = None
        elif result.action in ("redact", "mask"):
            action = GovernanceAction.REDACT
            redacted_content = result.metadata.get("redacted_text") or result.metadata.get(
                "masked_text"
            )
        else:
            # Guardrail explicitly configured to allow despite detections.
            action = GovernanceAction.ALLOW
            redacted_content = None

        decision = GovernanceDecision(
            action=action,
            tool_name=synthetic_tool_name,
            tool_args={},
            reason=result.reason,
            reason_codes=reason_codes,
            risk_score=result.risk_score,
            correlation_id=correlation_id,
            trace_id=_get_current_trace_id(),
            triggered_policies=triggered,
            redacted_content=redacted_content,
        )
        decision.evaluation_time_ms = (time.perf_counter() - start) * 1000
        self._record(decision)
        return decision

    def record_cost(self, cost: float) -> None:
        """Record cost for a completed tool call."""
        self._session_cost += cost

    def record_tool_success(self, tool_name: str) -> None:
        """Reset a tool's consecutive-failure count, closing its circuit breaker."""
        self._tool_failure_counts[tool_name] = 0

    def record_tool_failure(self, tool_name: str, reason: str) -> None:  # noqa: ARG002
        """Increment a tool's consecutive-failure count, possibly opening its
        circuit breaker (see the `circuit_breaker` policy's `failure_threshold`).
        """
        self._tool_failure_counts[tool_name] = self._tool_failure_counts.get(tool_name, 0) + 1

    def reset_session(self) -> None:
        """Reset session state (called at agent start)."""
        self._session_cost = 0.0
        self._call_count = 0
        self._tool_failure_counts = {}
        self._evidence = []

    def get_summary(self) -> SessionSummary:
        """Get governance summary for the session."""
        return SessionSummary(
            total_evaluations=len(self._evidence),
            allowed=sum(1 for e in self._evidence if e.action == GovernanceAction.ALLOW),
            denied=sum(1 for e in self._evidence if e.action == GovernanceAction.DENY),
            modified=sum(
                1
                for e in self._evidence
                if e.action in (GovernanceAction.MODIFY, GovernanceAction.REDACT)
            ),
            session_cost=self._session_cost,
            mode=self._mode,
            evidence=list(self._evidence),
        )

    @property
    def evidence(self) -> List[GovernanceDecision]:
        """Access the evidence trail."""
        return list(self._evidence)

    def _record(self, decision: GovernanceDecision) -> None:
        """Record a decision in the evidence trail."""
        self._evidence.append(decision)


def _get_current_trace_id() -> str | None:
    """Return the current OpenTelemetry trace ID, if the optional API is present."""
    try:
        trace = importlib.import_module("opentelemetry.trace")
    except ImportError:
        return None

    try:
        span = trace.get_current_span()
        context = span.get_span_context()
        trace_id = int(getattr(context, "trace_id", 0))
    except (AttributeError, TypeError, ValueError):
        return None

    if trace_id == 0:
        return None

    return format(trace_id, "032x")
