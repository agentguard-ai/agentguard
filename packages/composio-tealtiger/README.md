# composio-tealtiger

Deterministic governance middleware for [Composio](https://composio.dev) tool calls — policy enforcement, PII detection, cost tracking, and structured audit evidence using [TealTiger](https://github.com/agentguard-ai/tealtiger).

No LLM in the governance path. All policy evaluation is deterministic, adding <5ms latency.

## Installation

```bash
pip install composio-tealtiger
```

## Quick Start

### Zero-Config (Observe Mode)

Add governance to any Composio tool call with zero configuration. TealTiger observes all traffic, tracks costs, detects PII, and allows everything through — producing structured audit entries.

```python
from composio import Composio
from composio_tealtiger import governance_modifiers

composio = Composio()

# Get tools with TealTiger governance (observe mode — zero config)
tools = composio.tools.get(
    user_id="user_123",
    toolkits=["github", "slack"],
    **governance_modifiers()
)

# Every tool call is now tracked: cost, PII detection, audit trail
# Nothing is blocked in observe mode — just visibility
```

### Enforce Mode (Policy Enforcement)

```python
from composio import Composio
from composio_tealtiger import governance_modifiers
from tealtiger import TealEngine

# Define governance policies
engine = TealEngine(policies=[
    {"type": "tool_allowlist", "agent": "coder", "allowed": ["GITHUB_*", "HACKERNEWS_*"]},
    {"type": "pii_block", "categories": ["ssn", "credit_card"]},
    {"type": "cost_limit", "max_per_session": 5.00},
])

composio = Composio()

# Get tools with enforcing governance
tools = composio.tools.get(
    user_id="user_123",
    toolkits=["github", "gmail", "slack"],
    **governance_modifiers(engine=engine, mode="ENFORCE")
)

# Agent can use GITHUB_* tools → ALLOWED
# Agent tries GMAIL_SEND_EMAIL → DENIED (not in allowlist)
# Agent passes SSN in tool args → DENIED (PII blocked)
# Agent exceeds $5 budget → DENIED (cost limit)
```

### With Kill Switch

```python
from tealtiger import freeze, unfreeze

# Emergency: stop all tool execution for an agent
freeze("coder-agent")

# After investigation, restore access
unfreeze("coder-agent")
```

## How It Works

`composio-tealtiger` uses Composio's native modifier hooks:

- **`beforeExecute`** — Evaluates governance policies before any tool executes. If the policy denies the action, execution is blocked before reaching the external service.
- **`afterExecute`** — Records the execution result in the audit trail and updates cost tracking.
- **`modifySchema`** — Optionally adds governance metadata (allowed/denied status) to tool schemas for AI context.

```
Agent → Composio → beforeExecute (TealTiger evaluates) → Tool Execution → afterExecute (audit)
                         ↓ (if DENY)
                    GovernanceDenyError (tool never executes)
```

## Features

| Feature | Observe | Enforce |
|---------|---------|---------|
| PII detection (email, SSN, credit card, phone) | ✅ report | ✅ block |
| Tool allowlisting per agent/role | — | ✅ |
| Cost tracking per tool call | ✅ | ✅ |
| Per-session budget limits | — | ✅ |
| Structured audit trail | ✅ | ✅ |
| Correlation IDs (UUID v4) | ✅ | ✅ |
| Kill switch (freeze/unfreeze) | ✅ | ✅ |
| Risk scoring | ✅ | ✅ |

## API Reference

### `governance_modifiers(engine=None, mode="OBSERVE", agent_id=None)`

Returns a dict of Composio modifier hooks configured for TealTiger governance.

**Parameters:**
- `engine` (TealEngine, optional) — Policy engine. If None, uses observe mode.
- `mode` (str) — `"OBSERVE"`, `"MONITOR"`, or `"ENFORCE"`. Default: `"OBSERVE"`.
- `agent_id` (str, optional) — Agent identifier. Auto-generated if not provided.

**Returns:** Dict with `beforeExecute`, `afterExecute`, and optionally `modifySchema` keys.

### `GovernanceDenyError`

Raised when a tool call is denied in ENFORCE mode.

```python
from composio_tealtiger import GovernanceDenyError

try:
    result = composio.tools.execute("GMAIL_SEND_EMAIL", params, **governance_modifiers(engine=engine, mode="ENFORCE"))
except GovernanceDenyError as e:
    print(f"Blocked: {e.decision['reason']}")
    print(f"Codes: {e.decision['reason_codes']}")
```

## Audit Trail

Every governance evaluation produces a structured audit entry:

```json
{
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp_ms": 1720000000000,
  "action": "DENY",
  "mode": "ENFORCE",
  "tool_slug": "GMAIL_SEND_EMAIL",
  "toolkit_slug": "gmail",
  "agent_id": "coder-agent",
  "reason": "Tool not in allowlist for role 'coder'",
  "reason_codes": ["TOOL_NOT_ALLOWED"],
  "pii_detected": [],
  "cost_tracked": 0.0,
  "evaluation_time_ms": 0.42
}
```

## Requirements

- Python 3.9+
- `composio` >= 0.7.0
- `tealtiger` >= 1.1.0

## License

Apache-2.0
