"""Type definitions for langchain-tealtiger middleware."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class GovernanceMode(str, Enum):
    """Governance enforcement mode."""

    ENFORCE = "ENFORCE"
    """Block denied actions, redact PII. Production default."""

    MONITOR = "MONITOR"
    """Allow all actions, log decisions. Good for staging."""

    REPORT_ONLY = "REPORT_ONLY"
    """Allow all, generate reports only. Good for initial rollout."""


class GovernanceAction(str, Enum):
    """Action taken by the governance engine."""

    ALLOW = "ALLOW"
    DENY = "DENY"
    MODIFY = "MODIFY"
    REDACT = "REDACT"
    PENDING = "PENDING"


@dataclass
class PolicyConfig:
    """Configuration for a single governance policy.

    Examples:
        # Tool allowlist
        PolicyConfig(type="tool_allowlist", tools=["search", "calculator"])

        # Cost limit
        PolicyConfig(type="cost_limit", max_per_session=5.00)

        # Rate limit
        PolicyConfig(type="rate_limit", max_calls=100, window="1h")

        # Time restriction
        PolicyConfig(type="time_restriction", tools=["database_write"],
                     allowed_hours={"start": "09:00", "end": "17:00"})
    """

    type: str
    """Policy type identifier."""

    tools: Optional[List[str]] = None
    """Tool names this policy applies to (for allowlist/blocklist)."""

    max_per_session: Optional[float] = None
    """Maximum cost per session (for cost_limit)."""

    max_per_request: Optional[float] = None
    """Maximum cost per request (for cost_limit)."""

    max_calls: Optional[int] = None
    """Maximum number of calls (for rate_limit)."""

    window: Optional[str] = None
    """Time window for rate limits (e.g., '1h', '24h')."""

    allowed_hours: Optional[Dict[str, str]] = None
    """Allowed time window (for time_restriction)."""

    params: Dict[str, Any] = field(default_factory=dict)
    """Additional policy-specific parameters."""


@dataclass
class GovernanceDecision:
    """Result of a governance evaluation."""

    action: GovernanceAction
    """Action taken: ALLOW, DENY, MODIFY, or PENDING."""

    tool_name: str
    """Tool that was evaluated."""

    tool_args: Dict[str, Any]
    """Arguments that were evaluated."""

    reason: str = ""
    """Human-readable reason for the decision."""

    reason_codes: List[str] = field(default_factory=list)
    """Machine-readable reason codes."""

    risk_score: int = 0
    """Risk score (0-100)."""

    correlation_id: str = ""
    """Correlation ID for tracing."""

    trace_id: str | None = None
    """Current OpenTelemetry trace ID when available."""

    evaluation_time_ms: float = 0.0
    """Time taken for evaluation in milliseconds."""

    triggered_policies: List[str] = field(default_factory=list)
    """Policies that triggered this decision."""

    metadata: Dict[str, Any] = field(default_factory=dict)
    """Additional metadata."""

    redacted_content: str | None = None
    """Content with PII removed, set only for `action == GovernanceAction.REDACT`."""


@dataclass
class SessionSummary:
    """Summary of governance decisions for a session."""

    total_evaluations: int = 0
    """Total number of evaluations performed."""

    allowed: int = 0
    """Number of ALLOW decisions."""

    denied: int = 0
    """Number of DENY decisions."""

    modified: int = 0
    """Number of MODIFY decisions."""

    session_cost: float = 0.0
    """Accumulated session cost."""

    mode: GovernanceMode = GovernanceMode.ENFORCE
    """Governance mode used."""

    evidence: List[GovernanceDecision] = field(default_factory=list)
    """Full evidence trail of all decisions."""
