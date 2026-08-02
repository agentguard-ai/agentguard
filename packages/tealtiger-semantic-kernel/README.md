# tealtiger-semantic-kernel

Deterministic governance filter for [Semantic Kernel](https://github.com/microsoft/semantic-kernel) — function-call authorization, PII scanning, cost budgets, and structured audit trail.

**<2ms per evaluation. No LLM in the governance path. Apache 2.0.**

## What it does

`tealtiger-semantic-kernel` adds a governance layer to Semantic Kernel agents using the native [Filter system](https://learn.microsoft.com/en-us/semantic-kernel/concepts/enterprise-readiness/filters). Before any function executes (whether invoked directly or auto-invoked by the LLM planner), the filter evaluates your policy and returns ALLOW or DENY.

| Capability | What it protects |
|---|---|
| **Function allowlist/denylist** | Control which plugins and functions can be called. Block dangerous tools. |
| **PII scanning** | Detect emails, phone numbers, SSNs, credit cards in function arguments. |
| **Secret scanning** | Detect hardcoded API keys, passwords, tokens before they reach external services. |
| **Cost budget** | Per-session and daily USD limits with reserve-then-reconcile tracking. |
| **Kill switch** | Instantly freeze a runaway agent. Terminate the entire invocation loop. |
| **Structured audit** | Every decision logged: correlation_id, action, reason_codes, risk_score, timing. |

## Key Design

Addressing the critique in [issue #14056](https://github.com/microsoft/semantic-kernel/issues/14056):

- **AutoFunctionInvocationFilter**: On DENY, sets `context.terminate = True` AND does NOT call `next()`. This **terminates the entire invocation loop** — the LLM planner cannot continue calling more functions.
- **Budget**: Uses **reserve-then-reconcile** — estimated cost is debited before the function runs, then reconciled with actual cost after. Prevents overspend in parallel scenarios.

## Quick Start

### 1. Install

```bash
pip install tealtiger-semantic-kernel
```

### 2. Configure and register

```python
import semantic_kernel as sk
from tealtiger_semantic_kernel import (
    TealTigerFilter,
    GovernancePolicy,
    FunctionPolicy,
    PIIScanPolicy,
    BudgetTracker,
)

# Define policy
policy = GovernancePolicy(
    mode="ENFORCE",
    function_policy=FunctionPolicy(
        denylist=["HttpPlugin-*", "*-delete_*"],
        allowlist=["MathPlugin-*", "TextPlugin-*"],
    ),
    pii_scan=PIIScanPolicy(enabled=True, action="block"),
)

# Budget: $5 per session, $20 daily
budget = BudgetTracker(per_session_usd=5.00, per_agent_daily_usd=20.00)

# Create filter
gov = TealTigerFilter(policy=policy, budget=budget, session_id="session-001")

# Register with Semantic Kernel
kernel = sk.Kernel()
kernel.add_filter("function_invocation", gov.function_invocation_filter)
kernel.add_filter("auto_function_invocation", gov.auto_function_invocation_filter)
```

### 3. Done

Every function call — whether directly invoked or auto-invoked by the LLM planner — is evaluated against your governance policy before execution.

## Governance Modes

| Mode | Behavior |
|---|---|
| `ENFORCE` | Block violations. Auto-invocations terminate the loop. Direct invocations raise `GovernanceDenyError`. |
| `MONITOR` | Log violations but allow execution. For rollout testing. |
| `OBSERVE` | Passthrough with full audit trail. Zero enforcement. |

Start with `OBSERVE` to see what your agent does, then move to `MONITOR`, then `ENFORCE`.

## Policy Configuration

### Function allowlist/denylist

Patterns use `plugin_name-function_name` with glob matching:

```python
FunctionPolicy(
    denylist=[
        "HttpPlugin-*",           # Block entire plugin
        "*-delete_*",             # Block any delete function
        "FilePlugin-write_file",  # Block specific function
    ],
    allowlist=[
        "MathPlugin-*",           # Allow entire plugin
        "TextPlugin-summarize",   # Allow specific function
    ],
)
```

Denylist is checked first. If allowlist is non-empty, functions must match at least one pattern.

### PII Scanning

```python
PIIScanPolicy(
    enabled=True,
    action="block",  # "block" | "redact" | "log"
    categories=["email", "phone", "ssn", "credit_card"],
)
```

### Secret Scanning

```python
SecretScanPolicy(
    enabled=True,
    action="block",
    categories=["api_key", "password", "token", "private_key", "aws_key"],
)
```

## Budget Tracking

Reserve-then-reconcile prevents overspend:

```python
budget = BudgetTracker(per_session_usd=5.00, per_agent_daily_usd=20.00)

# Before function call:
budget.reserve(0.05)  # Returns False if would exceed limit

# After function call:
budget.reconcile(actual_cost=0.03, reserved=0.05)  # Frees $0.02 back

# Check current state:
print(f"Spent: ${budget.spent:.4f}")
print(f"Remaining: ${budget.remaining:.4f}")
```

## Kill Switch

```python
# Emergency freeze
gov.freeze()

# Resume normal operation
gov.unfreeze()
```

When frozen, ALL invocations are blocked with `context.terminate = True`.

## Audit Trail

```python
# Get all decisions
for decision in gov.audit_trail:
    print(decision.to_dict())
```

Each decision includes:

```json
{
  "correlation_id": "uuid-v4",
  "timestamp_ms": 1719849600000,
  "action": "DENY",
  "reason": "Function denied: 'HttpPlugin-fetch_url' matches denylist pattern 'HttpPlugin-*'",
  "reason_codes": ["FUNCTION_DENIED"],
  "risk_score": 0.9,
  "evaluation_time_ms": 0.4,
  "function_name": "fetch_url",
  "plugin_name": "HttpPlugin",
  "session_id": "session-001",
  "cumulative_cost": 0.0340
}
```

## How it works

```
LLM decides to call a function
    → Semantic Kernel AutoFunctionInvocationFilter fires
    → TealTigerFilter evaluates governance policy (<2ms)
    → If ALLOW:
        Reserve budget → call next(context) → reconcile budget
    → If DENY (ENFORCE mode):
        Set context.terminate = True
        Do NOT call next()
        → Entire invocation loop terminates
        → LLM planner cannot call more functions
    → Decision appended to audit trail
```

## Related

- [TealTiger](https://github.com/agentguard-ai/tealtiger) — Core governance SDK
- [Semantic Kernel Filters](https://learn.microsoft.com/en-us/semantic-kernel/concepts/enterprise-readiness/filters) — Filter system reference
- [GitHub Issue #14056](https://github.com/microsoft/semantic-kernel/issues/14056) — Governance integration proposal

## License

Apache 2.0
