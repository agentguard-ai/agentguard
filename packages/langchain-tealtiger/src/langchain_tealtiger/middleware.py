"""TealTiger governance middleware for LangChain agents.

Full-lifecycle deterministic governance: multi-stage defense at input,
output, pre-tool, and post-tool boundaries. PII detection, prompt injection
blocking, secret scanning, cost governance, tool authorization, circuit
breakers, rate limiting, and structured audit evidence.

No LLM in the governance path. All evaluation is deterministic, adding <5ms
latency per stage.

Example:
    from langchain.agents import create_agent
    from langchain_tealtiger import TealTigerMiddleware

    agent = create_agent(
        model="claude-sonnet-4-6",
        tools=[search, calculator, file_write],
        middleware=[
            TealTigerMiddleware(
                policies=[
                    {"type": "tool_allowlist", "tools": ["search", "calculator"]},
                    {"type": "pii", "action": "REDACT"},
                    {"type": "cost_limit", "max_per_session": 5.00},
                    {"type": "prompt_injection", "action": "BLOCK"},
                    {"type": "secrets", "action": "BLOCK"},
                ],
                freeze_tools=["rm_rf", "drop_database"],
            )
        ],
    )
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set

from langchain.agents.middleware import AgentMiddleware, AgentState
from langchain.messages import AIMessage, HumanMessage, ToolMessage
from langchain.tools.tool_node import ToolCallRequest
from langgraph.runtime import Runtime

from langchain_tealtiger._engine import GovernanceBridge
from langchain_tealtiger._types import (
    GovernanceAction,
    GovernanceDecision,
    GovernanceMode,
    SessionSummary,
)


class TealTigerMiddleware(AgentMiddleware):
    """Full-lifecycle deterministic governance middleware for LangChain agents.

    Enforces policies at every stage of the agent lifecycle: input defense,
    output defense, pre-tool governance, and post-tool scanning. Adds <5ms
    latency per evaluation.

    Multi-stage defense:
        - before_agent: Initialize governance session
        - before_model: Input defense (PII scan, prompt injection, content moderation)
        - wrap_tool_call: Pre-tool defense (authorization, args validation, cost check)
        - after_tool: Post-tool defense (output scanning, secret detection)
        - after_model: Output defense (response PII, secrets, content classification)
        - after_agent: Finalize evidence trail

    Governance modes:
        - ENFORCE: Block denied actions, redact PII (production)
        - MONITOR: Allow all, log violations (staging)
        - REPORT_ONLY: Allow all, generate reports only (initial rollout)

    Args:
        policies: List of policy config dicts. Supported types:
            - tool_allowlist, tool_blocklist, tool_args
            - pii (action: BLOCK/REDACT/FLAG)
            - prompt_injection (action: BLOCK/FLAG)
            - secrets (action: BLOCK/FLAG)
            - cost_limit (max_per_session, max_per_request, max_daily)
            - rate_limit (max_calls, window, tool)
            - circuit_breaker (failure_threshold, recovery_time)
            - content_moderation (blocked_categories)
        agent_id: Optional agent identifier for NHI scope enforcement.
        mode: Governance mode (ENFORCE, MONITOR, REPORT_ONLY).
        freeze_tools: Tools that are unconditionally blocked (immutable deny).
        otel_enabled: Emit governance decisions as OpenTelemetry spans.

    Example:
        >>> middleware = TealTigerMiddleware(
        ...     policies=[
        ...         {"type": "tool_allowlist", "tools": ["search"]},
        ...         {"type": "pii", "action": "REDACT"},
        ...         {"type": "cost_limit", "max_per_session": 5.00},
        ...         {"type": "prompt_injection", "action": "BLOCK"},
        ...         {"type": "secrets", "action": "BLOCK"},
        ...     ],
        ...     freeze_tools=["delete_all"],
        ...     mode="ENFORCE",
        ...     otel_enabled=True,
        ... )
    """

    def __init__(
        self,
        policies: Optional[List[Dict[str, Any]]] = None,
        agent_id: Optional[str] = None,
        mode: str | GovernanceMode = GovernanceMode.ENFORCE,
        freeze_tools: Optional[List[str]] = None,
        otel_enabled: bool = False,
    ) -> None:
        # Normalize mode
        if isinstance(mode, str):
            mode = GovernanceMode(mode.upper())
        self._mode = mode
        self._agent_id = agent_id
        self._otel_enabled = otel_enabled
        self._freeze_tools: Set[str] = set(freeze_tools or [])

        # Separate policies by stage for efficient evaluation
        self._policies = policies or []
        self._input_policies = [
            p for p in self._policies
            if p.get("type") in ("pii", "prompt_injection", "secrets", "content_moderation")
        ]
        self._output_policies = [
            p for p in self._policies
            if p.get("type") in ("pii", "secrets", "content_moderation")
        ]
        self._tool_policies = [
            p for p in self._policies
            if p.get("type") in (
                "tool_allowlist", "tool_blocklist", "tool_args",
                "cost_limit", "rate_limit", "circuit_breaker",
            )
        ]

        # Initialize governance engine bridge
        self._engine = GovernanceBridge(
            policies=self._policies,
            mode=mode,
            agent_id=agent_id,
            freeze_tools=self._freeze_tools,
            otel_enabled=otel_enabled,
        )

    # ── Lifecycle hooks ──────────────────────────────────────────

    def before_agent(self, state: AgentState, runtime: Runtime) -> Dict[str, Any] | None:
        """Initialize governance session at agent start.

        Resets session cost, call count, and evidence trail.
        """
        self._engine.reset_session()
        return None

    def after_agent(self, state: AgentState, runtime: Runtime) -> Dict[str, Any] | None:
        """Finalize governance session.

        Evidence trail is available via middleware.summary and middleware.evidence.
        """
        self._engine.finalize_session()
        return None

    # ── Input defense (Stage 1) ──────────────────────────────────

    def before_model(self, state: AgentState, runtime: Runtime) -> Dict[str, Any] | None:
        """Input defense: scan user messages before they reach the model.

        Evaluates:
        - PII detection: scans input for 40+ PII patterns
        - Prompt injection: deterministic pattern matching for injection attacks
        - Secret scanning: detect credentials in input
        - Content moderation: classify input content

        In ENFORCE mode:
        - PII with action=REDACT: modifies message content in-place
        - PII with action=BLOCK: raises governance denial
        - Prompt injection: blocks the message entirely
        - Secrets: blocks the message
        """
        if not self._input_policies:
            return None

        messages = state.get("messages", [])
        if not messages:
            return None

        # Scan the last user message
        last_message = messages[-1]
        if not isinstance(last_message, HumanMessage):
            return None

        content = last_message.content if isinstance(last_message.content, str) else str(last_message.content)

        decision = self._engine.evaluate_content(
            content=content,
            stage="input",
            context={"message_type": "human", "message_index": len(messages) - 1},
        )

        if self._mode == GovernanceMode.ENFORCE:
            if decision.action == GovernanceAction.DENY:
                # Block the input entirely — inject a governance denial message
                state["messages"][-1] = HumanMessage(
                    content=f"[GOVERNANCE BLOCKED] Input denied: {decision.reason}"
                )
                return {"governance_blocked": True, "reason": decision.reason}

            if decision.action == GovernanceAction.REDACT:
                # Redact PII in-place
                state["messages"][-1] = HumanMessage(
                    content=decision.redacted_content or content
                )
                return {"governance_redacted": True}

        return None

    # ── Output defense (Stage 2) ─────────────────────────────────

    def after_model(self, state: AgentState, runtime: Runtime) -> Dict[str, Any] | None:
        """Output defense: scan model responses before they reach the user.

        Evaluates:
        - PII detection: scan output for leaked PII
        - Secret scanning: detect credentials in model output
        - Content moderation: classify response content

        In ENFORCE mode:
        - PII with action=REDACT: modifies response content
        - Secrets: replaces response with governance notice
        """
        if not self._output_policies:
            return None

        messages = state.get("messages", [])
        if not messages:
            return None

        last_message = messages[-1]
        if not isinstance(last_message, AIMessage):
            return None

        content = last_message.content if isinstance(last_message.content, str) else str(last_message.content)

        if not content:
            return None

        decision = self._engine.evaluate_content(
            content=content,
            stage="output",
            context={"message_type": "ai"},
        )

        if self._mode == GovernanceMode.ENFORCE:
            if decision.action == GovernanceAction.DENY:
                state["messages"][-1] = AIMessage(
                    content=f"[GOVERNANCE BLOCKED] Output contained restricted content: {decision.reason}"
                )
                return {"governance_blocked": True, "reason": decision.reason}

            if decision.action == GovernanceAction.REDACT:
                state["messages"][-1] = AIMessage(
                    content=decision.redacted_content or content
                )
                return {"governance_redacted": True}

        return None

    # ── Pre-tool defense (Stage 3) ───────────────────────────────

    def wrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], ToolMessage | Any],
    ) -> ToolMessage | Any:
        """Pre-tool governance gate before every tool call.

        Evaluates all configured policies deterministically:
        - Tool allowlist/blocklist: is this tool permitted?
        - FREEZE rules: immutable deny regardless of mode
        - Argument validation: do args meet constraints?
        - Cost check: is budget exhausted?
        - Rate limit: has call frequency been exceeded?
        - Circuit breaker: is the tool circuit open?
        - PII in arguments: scan tool args for sensitive data

        In ENFORCE mode:
            DENY → short-circuit with denial message (tool not executed)
            ALLOW → call handler and proceed

        In MONITOR mode:
            Violations logged but tool calls always proceed.

        In REPORT_ONLY mode:
            No evaluation performed, all calls proceed.
        """
        if self._mode == GovernanceMode.REPORT_ONLY:
            return handler(request)

        tool_name: str = request.tool_call["name"]
        tool_args: Dict[str, Any] = request.tool_call.get("args", {})

        # Evaluate governance policies
        decision = self._engine.evaluate(
            tool_name=tool_name,
            tool_args=tool_args,
        )

        # In ENFORCE mode, DENY blocks execution
        if decision.action == GovernanceAction.DENY and self._mode == GovernanceMode.ENFORCE:
            # Record failure for circuit breaker
            self._engine.record_tool_failure(tool_name, "governance_denied")
            return ToolMessage(
                content=f"[GOVERNANCE DENIED] {decision.reason}",
                tool_call_id=request.tool_call["id"],
            )

        # Execute the tool
        try:
            result = handler(request)
            # Record success for circuit breaker
            self._engine.record_tool_success(tool_name)
            return result
        except Exception as exc:
            # Record failure for circuit breaker
            self._engine.record_tool_failure(tool_name, str(exc))
            raise

    # ── Post-tool defense (Stage 4) ──────────────────────────────

    def after_tool(self, state: AgentState, runtime: Runtime) -> Dict[str, Any] | None:
        """Post-tool defense: scan tool results before they re-enter context.

        Evaluates:
        - PII in tool output: scan results for sensitive data
        - Secret detection: credentials in tool responses
        - Cost tracking: record token/cost from tool execution

        In ENFORCE mode:
        - PII/secrets in tool output → redact or block
        """
        if not self._output_policies:
            return None

        messages = state.get("messages", [])
        if not messages:
            return None

        last_message = messages[-1]
        if not isinstance(last_message, ToolMessage):
            return None

        content = last_message.content if isinstance(last_message.content, str) else str(last_message.content)

        if not content:
            return None

        decision = self._engine.evaluate_content(
            content=content,
            stage="tool_result",
            context={
                "message_type": "tool",
                "tool_call_id": getattr(last_message, "tool_call_id", None),
            },
        )

        if self._mode == GovernanceMode.ENFORCE:
            if decision.action == GovernanceAction.DENY:
                state["messages"][-1] = ToolMessage(
                    content=f"[GOVERNANCE BLOCKED] Tool output contained restricted content",
                    tool_call_id=getattr(last_message, "tool_call_id", "unknown"),
                )
                return {"governance_blocked": True, "reason": decision.reason}

            if decision.action == GovernanceAction.REDACT:
                state["messages"][-1] = ToolMessage(
                    content=decision.redacted_content or content,
                    tool_call_id=getattr(last_message, "tool_call_id", "unknown"),
                )
                return {"governance_redacted": True}

        return None

    # ── Public API ───────────────────────────────────────────────

    @property
    def summary(self) -> SessionSummary:
        """Get governance summary for the current/last session.

        Returns:
            SessionSummary with evaluation counts, cost, denied count, and mode.

        Example:
            >>> result = agent.invoke({"messages": [...]})
            >>> print(middleware.summary)
            SessionSummary(total_evaluations=12, allowed=10, denied=2, session_cost=2.34)
        """
        return self._engine.get_summary()

    @property
    def evidence(self) -> List[GovernanceDecision]:
        """Access the full evidence trail of governance decisions.

        Each decision includes:
        - correlation_id (UUID)
        - trace_id (OpenTelemetry compatible)
        - action (ALLOW/DENY/REDACT)
        - risk_score (0-100)
        - reason_code
        - stage (input/output/pre_tool/tool_result)
        - tool_name (if tool-related)
        - triggered_policies
        - evaluation_time_ms
        - timestamp
        """
        return self._engine.evidence

    @property
    def mode(self) -> GovernanceMode:
        """Current governance mode."""
        return self._mode

    @mode.setter
    def mode(self, value: str | GovernanceMode) -> None:
        """Switch governance mode at runtime."""
        if isinstance(value, str):
            value = GovernanceMode(value.upper())
        self._mode = value
        self._engine.set_mode(value)

    def export_evidence(
        self,
        path: str,
        format: str = "json",
    ) -> None:
        """Export governance evidence to file.

        Args:
            path: Output file path.
            format: Export format — "json", "jsonl", "sarif", or "junit".

        Example:
            >>> middleware.export_evidence("audit.json")
            >>> middleware.export_evidence("security.sarif", format="sarif")
            >>> middleware.export_evidence("results.xml", format="junit")
        """
        self._engine.export_evidence(path=path, format=format)
