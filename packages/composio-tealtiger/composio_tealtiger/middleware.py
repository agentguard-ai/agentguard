"""TealTiger governance middleware for Composio tool calls.

Uses Composio's native beforeExecute/afterExecute modifier hooks to evaluate
governance policies before tools execute against external services.
"""

import uuid
import time
import re
from typing import Any, Dict, List, Optional


class GovernanceDenyError(Exception):
    """Raised when a tool call is denied by governance policy."""

    def __init__(self, decision: Dict[str, Any]):
        self.decision = decision
        super().__init__(f"Governance DENY: {decision.get('reason', 'Policy violation')}")


# PII patterns for detection
_PII_PATTERNS = {
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "credit_card": re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"),
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),
    "phone": re.compile(r"\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"),
}


class _GovernanceState:
    """Internal state for governance tracking across tool calls."""

    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.session_id = str(uuid.uuid4())
        self.cumulative_cost = 0.0
        self.evaluation_count = 0
        self.decisions: List[Dict[str, Any]] = []
        self._frozen_agents: set = set()

    def is_frozen(self, agent_id: str) -> bool:
        return "*" in self._frozen_agents or agent_id in self._frozen_agents


# Global freeze registry (in-process, shared across all governance states)
_freeze_registry: set = set()


def _detect_pii(text: str) -> List[Dict[str, Any]]:
    """Detect PII patterns in text."""
    findings = []
    for pii_type, pattern in _PII_PATTERNS.items():
        matches = pattern.finditer(text)
        for match in matches:
            findings.append({
                "type": pii_type,
                "start": match.start(),
                "end": match.end(),
            })
    return findings


def _check_tool_allowlist(
    tool_slug: str, policies: List[Dict[str, Any]], agent_id: str
) -> Optional[str]:
    """Check if tool is in the allowlist. Returns denial reason or None."""
    for policy in policies:
        if policy.get("type") != "tool_allowlist":
            continue
        policy_agent = policy.get("agent", "*")
        if policy_agent != "*" and policy_agent != agent_id:
            continue
        allowed_patterns = policy.get("allowed", [])
        for pattern in allowed_patterns:
            if pattern.endswith("*"):
                if tool_slug.startswith(pattern[:-1]):
                    return None
            elif tool_slug == pattern:
                return None
        return f"Tool '{tool_slug}' not in allowlist for agent '{agent_id}'"
    return None


def _check_pii_block(
    text: str, policies: List[Dict[str, Any]]
) -> tuple:
    """Check for PII violations. Returns (denial_reason, findings) or (None, findings)."""
    findings = _detect_pii(text)
    if not findings:
        return None, []

    for policy in policies:
        if policy.get("type") != "pii_block":
            continue
        blocked_categories = policy.get("categories", [])
        for finding in findings:
            if finding["type"] in blocked_categories:
                return (
                    f"PII detected: {finding['type']} in tool arguments",
                    findings,
                )
    return None, findings


def _check_cost_limit(
    cumulative_cost: float, policies: List[Dict[str, Any]]
) -> Optional[str]:
    """Check if cost limit exceeded. Returns denial reason or None."""
    for policy in policies:
        if policy.get("type") != "cost_limit":
            continue
        max_cost = policy.get("max_per_session", float("inf"))
        if cumulative_cost >= max_cost:
            return f"Session cost limit exceeded: ${cumulative_cost:.4f} >= ${max_cost:.2f}"
    return None


def _estimate_cost(tool_slug: str) -> float:
    """Estimate cost of a tool call (simplified)."""
    # Base cost estimate per tool call category
    if "SEARCH" in tool_slug or "GET" in tool_slug or "LIST" in tool_slug:
        return 0.001  # Read operations
    elif "CREATE" in tool_slug or "SEND" in tool_slug or "POST" in tool_slug:
        return 0.005  # Write operations
    else:
        return 0.002  # Default


def governance_modifiers(
    engine=None,
    mode: str = "OBSERVE",
    agent_id: Optional[str] = None,
    cost_per_call: Optional[float] = None,
) -> Dict[str, Any]:
    """Create Composio modifier hooks for TealTiger governance.

    Args:
        engine: TealEngine instance with policies. If None, uses observe mode.
        mode: "OBSERVE", "MONITOR", or "ENFORCE".
        agent_id: Agent identifier. Auto-generated if not provided.
        cost_per_call: Override cost estimate per call. If None, uses heuristic.

    Returns:
        Dict with beforeExecute and afterExecute keys for Composio modifiers.
    """
    _agent_id = agent_id or f"composio-agent-{str(uuid.uuid4())[:8]}"
    state = _GovernanceState(_agent_id)
    policies = []

    # Extract policies from TealEngine if provided
    if engine is not None:
        if hasattr(engine, "policies"):
            policies = engine.policies
        elif hasattr(engine, "_policies"):
            policies = engine._policies

    async def before_execute(tool_slug: str, toolkit_slug: str, params: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """Evaluate governance before tool execution."""
        start_time = time.perf_counter()
        state.evaluation_count += 1
        correlation_id = str(uuid.uuid4())

        # Check freeze registry
        if _agent_id in _freeze_registry or "*" in _freeze_registry:
            decision = {
                "correlation_id": correlation_id,
                "timestamp_ms": time.time() * 1000,
                "action": "DENY",
                "mode": mode,
                "tool_slug": tool_slug,
                "toolkit_slug": toolkit_slug,
                "agent_id": _agent_id,
                "reason": f"Agent '{_agent_id}' is frozen",
                "reason_codes": ["AGENT_FROZEN"],
                "pii_detected": [],
                "cost_tracked": 0.0,
                "cumulative_cost": state.cumulative_cost,
                "evaluation_time_ms": (time.perf_counter() - start_time) * 1000,
            }
            state.decisions.append(decision)
            if mode == "ENFORCE":
                raise GovernanceDenyError(decision)
            return params

        # Serialize arguments for scanning
        args_text = str(params.get("arguments", {}))

        # Check tool allowlist
        denial_reason = _check_tool_allowlist(tool_slug, policies, _agent_id)

        # Check PII
        pii_denial, pii_findings = None, []
        if not denial_reason:
            pii_denial, pii_findings = _check_pii_block(args_text, policies)
            if pii_denial:
                denial_reason = pii_denial

        # Check cost limit
        if not denial_reason:
            cost_denial = _check_cost_limit(state.cumulative_cost, policies)
            if cost_denial:
                denial_reason = cost_denial

        # Determine action
        action = "DENY" if denial_reason else "ALLOW"
        reason_codes = []
        if denial_reason:
            if "allowlist" in (denial_reason or "").lower():
                reason_codes.append("TOOL_NOT_ALLOWED")
            elif "pii" in (denial_reason or "").lower():
                reason_codes.append("PII_BLOCKED")
            elif "cost" in (denial_reason or "").lower():
                reason_codes.append("COST_LIMIT_EXCEEDED")
            elif "frozen" in (denial_reason or "").lower():
                reason_codes.append("AGENT_FROZEN")

        # Estimate cost for this call
        call_cost = cost_per_call if cost_per_call is not None else _estimate_cost(tool_slug)
        if action == "ALLOW":
            state.cumulative_cost += call_cost

        eval_time = (time.perf_counter() - start_time) * 1000

        decision = {
            "correlation_id": correlation_id,
            "timestamp_ms": time.time() * 1000,
            "action": action,
            "mode": mode,
            "tool_slug": tool_slug,
            "toolkit_slug": toolkit_slug,
            "agent_id": _agent_id,
            "reason": denial_reason or f"Allowed: {mode.lower()} mode",
            "reason_codes": reason_codes or (["OBSERVE_PASSTHROUGH"] if mode == "OBSERVE" else ["POLICY_ALLOW"]),
            "pii_detected": pii_findings,
            "cost_tracked": call_cost if action == "ALLOW" else 0.0,
            "cumulative_cost": state.cumulative_cost,
            "evaluation_time_ms": eval_time,
        }
        state.decisions.append(decision)

        # Enforce denial
        if action == "DENY" and mode == "ENFORCE":
            raise GovernanceDenyError(decision)

        return params

    async def after_execute(result: Dict[str, Any], tool_slug: str, toolkit_slug: str, **kwargs) -> Dict[str, Any]:
        """Record execution result in audit trail."""
        # Update the last decision with execution outcome
        if state.decisions:
            last_decision = state.decisions[-1]
            last_decision["execution_successful"] = result.get("successful", False)

        return result

    modifiers = {
        "beforeExecute": before_execute,
        "afterExecute": after_execute,
    }

    # Attach state accessor for testing/inspection
    modifiers["_governance_state"] = state

    return modifiers
